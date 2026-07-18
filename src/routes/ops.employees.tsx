import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Wallet, UserPlus, Power, Pencil, Trash2, MoreVertical, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurantId } from "@/lib/restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeDeductionsDialog } from "@/components/ops/EmployeeDeductionsDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { tx } from "@/lib/ops-tx";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/ops/employees")({
  component: OpsEmployees,
});

type SalaryType = "monthly" | "daily" | "hourly";

type Employee = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  salary_type: SalaryType;
  base_salary: number;
  is_active: boolean;
};

type Settlement = {
  id: string;
  employee_id: string;
  month: string; // YYYY-MM
  base_salary: number;
  total_deductions: number;
  net_salary: number;
  paid_at: string;
  notes: string | null;
};

const SALARY_LABELS: Record<SalaryType, string> = {
  monthly: tx("شهري"),
  daily: tx("يومي"),
  hourly: tx("بالساعة"),
};

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 2 }).format(n || 0);

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(month: string): string {
  // month: YYYY-MM
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

function OpsEmployees() {
  useTranslation();
  const { restaurantId, loading: restaurantLoading } = useRestaurantId();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    salary_type: "monthly" as SalaryType,
    base_salary: "0",
  });
  const [saving, setSaving] = useState(false);

  // Edit employee
  const [editOpen, setEditOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    phone: "",
    salary_type: "monthly" as SalaryType,
    base_salary: "0",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Deductions dialog
  const [deductOpen, setDeductOpen] = useState(false);
  const [deductEmp, setDeductEmp] = useState<Employee | null>(null);

  const period = currentMonth();

  const loadAll = async (rid: string) => {
    setLoading(true);
    const [emps, pays] = await Promise.all([
      supabase
        .from("employees")
        .select("*")
        .eq("restaurant_id", rid)
        .order("created_at", { ascending: false }),
      supabase
        .from("employee_salary_payments")
        .select("*")
        .eq("restaurant_id", rid)
        .order("paid_at", { ascending: false }),
    ]);
    if (emps.error) toast.error(tx("فشل تحميل الموظفين"));
    setEmployees((emps.data ?? []) as Employee[]);
    setSettlements((pays.data ?? []) as Settlement[]);
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantLoading) return;
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    void loadAll(restaurantId);
  }, [restaurantId, restaurantLoading]);

  const paidThisMonth = useMemo(() => {
    const set = new Set<string>();
    for (const p of settlements) {
      if (p.month === period) set.add(p.employee_id);
    }
    return set;
  }, [settlements, period]);

  const totalThisMonth = useMemo(
    () =>
      settlements
        .filter((p) => p.month === period)
        .reduce((s, p) => s + Number(p.net_salary || 0), 0),
    [settlements, period]
  );

  const pendingCount = useMemo(
    () => employees.filter((e) => e.is_active && !paidThisMonth.has(e.id)).length,
    [employees, paidThisMonth]
  );

  const submitAdd = async () => {
    if (!restaurantId) return;
    if (!form.name.trim() || !form.role.trim()) {
      toast.error(tx("الاسم والدور مطلوبان"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("employees").insert({
      restaurant_id: restaurantId,
      name: form.name.trim(),
      role: form.role.trim(),
      phone: form.phone.trim() || null,
      salary_type: form.salary_type,
      base_salary: Number(form.base_salary) || 0,
    });
    setSaving(false);
    if (error) {
      toast.error(tx("فشل إضافة الموظف"));
      return;
    }
    toast.success(tx("تمت الإضافة"));
    setAddOpen(false);
    setForm({ name: "", role: "", phone: "", salary_type: "monthly", base_salary: "0" });
    await loadAll(restaurantId);
  };

  // Paying = settling the month (base salary − deductions) via the deductions dialog
  const openPay = (e: Employee) => {
    setDeductEmp(e);
    setDeductOpen(true);
  };

  const toggleActive = async (e: Employee) => {
    if (!restaurantId) return;
    const { error } = await supabase
      .from("employees")
      .update({ is_active: !e.is_active })
      .eq("id", e.id);
    if (error) {
      toast.error(tx("فشل التحديث"));
      return;
    }
    await loadAll(restaurantId);
  };

  const openEdit = (e: Employee) => {
    setEditEmp(e);
    setEditForm({
      name: e.name,
      role: e.role,
      phone: e.phone ?? "",
      salary_type: e.salary_type,
      base_salary: String(e.base_salary),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editEmp || !restaurantId) return;
    if (!editForm.name.trim() || !editForm.role.trim()) {
      toast.error(tx("الاسم والدور مطلوبان"));
      return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from("employees")
      .update({
        name: editForm.name.trim(),
        role: editForm.role.trim(),
        phone: editForm.phone.trim() || null,
        salary_type: editForm.salary_type,
        base_salary: Number(editForm.base_salary) || 0,
      })
      .eq("id", editEmp.id);
    setEditSaving(false);
    if (error) {
      toast.error(tx("فشل التعديل"));
      return;
    }
    toast.success(tx("تم التعديل"));
    setEditOpen(false);
    await loadAll(restaurantId);
  };

  const deleteEmployee = async (e: Employee) => {
    if (!restaurantId) return;
    const { error } = await supabase.from("employees").delete().eq("id", e.id);
    if (error) {
      toast.error(tx("فشل الحذف — قد يكون مرتبطاً بمدفوعات"));
      return;
    }
    toast.success(tx("تم الحذف"));
    await loadAll(restaurantId);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tx("الموظفين النشطين")}</div>
              <div className="text-xl font-bold">
                {employees.filter((e) => e.is_active).length}
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">رواتب معلقة ({periodLabel(period)})</div>
              <div className="text-xl font-bold">{pendingCount}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{tx("مدفوع هذا الشهر")}</div>
              <div className="text-xl font-bold">{fmt(totalThisMonth)} دج</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">{tx("الموظفين")}</h3>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> {tx("إضافة موظف")}
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">{tx("الاسم")}</TableHead>
              <TableHead className="text-right">{tx("الدور")}</TableHead>
              <TableHead className="text-right">{tx("الهاتف")}</TableHead>
              <TableHead className="text-right">{tx("نوع الراتب")}</TableHead>
              <TableHead className="text-right">{tx("الأساس")}</TableHead>
              <TableHead className="text-right">{tx("حالة هذا الشهر")}</TableHead>
              <TableHead className="text-right">{tx("إجراءات")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {tx("جاري التحميل...")}
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {tx("لا يوجد موظفين بعد")}
                </TableCell>
              </TableRow>
            ) : (
              employees.map((e) => {
                const paid = paidThisMonth.has(e.id);
                return (
                  <TableRow key={e.id} className={!e.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.role}</TableCell>
                    <TableCell>{e.phone || "-"}</TableCell>
                    <TableCell>{SALARY_LABELS[e.salary_type]}</TableCell>
                    <TableCell>
                      {fmt(Number(e.base_salary))}{" "}
                      {e.salary_type === "monthly"
                        ? tx("دج/شهر")
                        : e.salary_type === "daily"
                          ? tx("دج/يوم")
                          : tx("دج/ساعة")}
                    </TableCell>
                    <TableCell>
                      {!e.is_active ? (
                        <Badge variant="outline">{tx("غير نشط")}</Badge>
                      ) : paid ? (
                        <Badge className="bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/20">
                          {tx("مدفوع")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{tx("معلّق")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!e.is_active || paid}
                          onClick={() => openPay(e)}
                          className="gap-1"
                        >
                          <Wallet className="w-4 h-4" /> {tx("دفع راتب")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActive(e)}
                          className="gap-1"
                        >
                          <Power className="w-4 h-4" />
                          {e.is_active ? tx("إيقاف") : tx("تفعيل")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-right">
                            <DropdownMenuItem onClick={() => { setDeductEmp(e); setDeductOpen(true); }}>
                              <Receipt className="w-4 h-4 ml-2" /> {tx("اقتطاعات وراتب")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(e)}>
                              <Pencil className="w-4 h-4 ml-2" /> {tx("تعديل")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setEmployeeToDelete(e)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 ml-2" /> {tx("حذف")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Recent settlements */}
      <div>
        <h3 className="font-bold text-lg mb-3">{tx("آخر المدفوعات")}</h3>
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">{tx("الموظف")}</TableHead>
                <TableHead className="text-right">{tx("الشهر")}</TableHead>
                <TableHead className="text-right">{tx("الأساس")}</TableHead>
                <TableHead className="text-right">{tx("الخصومات")}</TableHead>
                <TableHead className="text-right">{tx("الصافي")}</TableHead>
                <TableHead className="text-right">{tx("تاريخ الدفع")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    {tx("لا توجد مدفوعات بعد")}
                  </TableCell>
                </TableRow>
              ) : (
                settlements.slice(0, 20).map((p) => {
                  const emp = employees.find((e) => e.id === p.employee_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{emp?.name ?? "—"}</TableCell>
                      <TableCell>{periodLabel(p.month)}</TableCell>
                      <TableCell>{fmt(Number(p.base_salary))} دج</TableCell>
                      <TableCell className="text-destructive">
                        {Number(p.total_deductions) > 0 ? `− ${fmt(Number(p.total_deductions))} دج` : "-"}
                      </TableCell>
                      <TableCell className="font-semibold">{fmt(Number(p.net_salary))} دج</TableCell>
                      <TableCell>
                        {new Date(p.paid_at).toLocaleDateString("ar-DZ")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Add employee modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("إضافة موظف جديد")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الاسم")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{tx("الدور (طباخ، نادل، ...)")}</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </div>
            <div>
              <Label>{tx("الهاتف")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("نوع الراتب")}</Label>
                <Select
                  value={form.salary_type}
                  onValueChange={(v) =>
                    setForm({ ...form, salary_type: v as SalaryType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{tx("شهري")}</SelectItem>
                    <SelectItem value="daily">{tx("يومي")}</SelectItem>
                    <SelectItem value="hourly">{tx("بالساعة")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {form.salary_type === "monthly"
                    ? tx("الراتب الشهري (دج)")
                    : form.salary_type === "daily"
                      ? tx("السعر/اليوم (دج)")
                      : tx("السعر/الساعة (دج)")}
                </Label>
                <Input
                  type="number"
                  value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {tx("إلغاء")}
            </Button>
            <Button onClick={submitAdd} disabled={saving}>
              {saving ? tx("جاري الحفظ...") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit employee modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{tx("تعديل الموظف")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{tx("الاسم")}</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>{tx("الدور")}</Label>
              <Input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} />
            </div>
            <div>
              <Label>{tx("الهاتف")}</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("نوع الراتب")}</Label>
                <Select
                  value={editForm.salary_type}
                  onValueChange={(v) => setEditForm({ ...editForm, salary_type: v as SalaryType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{tx("شهري")}</SelectItem>
                    <SelectItem value="daily">{tx("يومي")}</SelectItem>
                    <SelectItem value="hourly">{tx("بالساعة")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("الأساس (دج)")}</Label>
                <Input type="number" value={editForm.base_salary} onChange={(e) => setEditForm({ ...editForm, base_salary: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{tx("إلغاء")}</Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? tx("جاري الحفظ...") : tx("حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {deductEmp && restaurantId && (
        <EmployeeDeductionsDialog
          open={deductOpen}
          onOpenChange={(o) => {
            setDeductOpen(o);
            if (!o) {
              setDeductEmp(null);
              void loadAll(restaurantId);
            }
          }}
          restaurantId={restaurantId}
          employee={{ id: deductEmp.id, name: deductEmp.name, base_salary: Number(deductEmp.base_salary) }}
        />
      )}

      <ConfirmDialog
        open={employeeToDelete !== null}
        onOpenChange={(o) => { if (!o) setEmployeeToDelete(null); }}
        title={tx("حذف \"") + (employeeToDelete?.name ?? "") + tx("\"؟")}
        description={tx("سجل الرواتب سيُحذف معه.")}
        confirmLabel={tx("حذف")}
        cancelLabel={tx("إلغاء")}
        destructive
        onConfirm={() => {
          if (employeeToDelete) void deleteEmployee(employeeToDelete);
          setEmployeeToDelete(null);
        }}
      />
    </div>
  );
}
