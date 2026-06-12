import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { _genericDbError } from "./_errors.server";

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 64).toString("hex");
}
function verifyPin(pin: string, salt: string, hash: string) {
  const a = Buffer.from(hashPin(pin, salt), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Admin: manage individual chef accounts ───────────────────────────────

export const listIndividualChefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) return { chefs: [] };
    const { data } = await supabaseAdmin
      .from("individual_chef_credentials")
      .select("id, name, is_active, employee_id, created_at")
      .eq("restaurant_id", r.id)
      .order("created_at", { ascending: true });
    return { chefs: data ?? [] };
  });

export const addIndividualChef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ name: z.string().min(1).max(60), pin: z.string().regex(/^\d{4,6}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");
    const salt = randomBytes(16).toString("hex");
    const pin_hash = hashPin(data.pin, salt);
    const { data: chef, error } = await supabaseAdmin
      .from("individual_chef_credentials")
      .insert({ restaurant_id: r.id, name: data.name, pin_hash, pin_salt: salt })
      .select("id, name, is_active")
      .single();
    if (error) throw _genericDbError(error);
    return { chef };
  });

export const updateIndividualChefPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ chefId: z.string().uuid(), pin: z.string().regex(/^\d{4,6}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");
    const salt = randomBytes(16).toString("hex");
    const pin_hash = hashPin(data.pin, salt);
    const { error } = await supabaseAdmin
      .from("individual_chef_credentials")
      .update({ pin_hash, pin_salt: salt })
      .eq("id", data.chefId)
      .eq("restaurant_id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const toggleIndividualChef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ chefId: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");
    const { error } = await supabaseAdmin
      .from("individual_chef_credentials")
      .update({ is_active: data.is_active })
      .eq("id", data.chefId)
      .eq("restaurant_id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const deleteIndividualChef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ chefId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");
    await supabaseAdmin.from("individual_chef_sessions").delete().eq(
      "chef_credential_id",
      data.chefId,
    );
    const { error } = await supabaseAdmin
      .from("individual_chef_credentials")
      .delete()
      .eq("id", data.chefId)
      .eq("restaurant_id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

// ─── Public: login flow ────────────────────────────────────────────────────

export const getPublicChefList = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: r } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!r) return { found: false as const, name: "", logo_url: null, chefs: [] };
    const { data: chefs } = await supabaseAdmin
      .from("individual_chef_credentials")
      .select("id, name")
      .eq("restaurant_id", data.restaurantId)
      .eq("is_active", true)
      .order("name");
    return {
      found: true as const,
      name: r.name as string,
      logo_url: r.logo_url as string | null,
      chefs: (chefs ?? []).map((c) => ({ id: c.id, name: c.name })),
    };
  });

export const verifyIndividualChefPin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ chefId: z.string().uuid(), pin: z.string().regex(/^\d{4,6}$/) })
      .strict()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { chefId, pin } = data;

    const { data: attempt } = await supabaseAdmin
      .from("staff_login_attempts")
      .select("failed_count, locked_until")
      .eq("staff_id", chefId)
      .eq("staff_type", "chef")
      .maybeSingle();

    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60_000);
      throw new Error(`تم قفل المحاولات. حاول بعد ${mins} دقيقة`);
    }

    const { data: cred } = await supabaseAdmin
      .from("individual_chef_credentials")
      .select("pin_hash, pin_salt, restaurant_id, name, is_active")
      .eq("id", chefId)
      .maybeSingle();

    if (!cred || !cred.is_active) throw new Error("الحساب غير موجود أو موقوف");

    const ok = verifyPin(pin, cred.pin_salt, cred.pin_hash);
    if (!ok) {
      const failed = (attempt?.failed_count ?? 0) + 1;
      const lockUntil = failed >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      await supabaseAdmin.from("staff_login_attempts").upsert({
        staff_id: chefId,
        staff_type: "chef",
        failed_count: lockUntil ? 0 : failed,
        locked_until: lockUntil,
        updated_at: new Date().toISOString(),
      });
      throw new Error(lockUntil ? "محاولات كثيرة. تم القفل لـ 5 دقائق" : "رمز خاطئ");
    }

    await supabaseAdmin.from("staff_login_attempts").upsert({
      staff_id: chefId,
      staff_type: "chef",
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("individual_chef_sessions").insert({
      chef_credential_id: chefId,
      restaurant_id: cred.restaurant_id,
      token,
      expires_at: expiresAt,
    });
    if (error) throw new Error("فشل إنشاء الجلسة");

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", cred.restaurant_id)
      .maybeSingle();

    return {
      token,
      expiresAt,
      chefName: cred.name as string,
      chefId,
      restaurant: {
        id: cred.restaurant_id as string,
        name: rest?.name ?? "",
        logo_url: rest?.logo_url ?? null,
      },
    };
  });

// ─── Session validation (shared helper) ────────────────────────────────────

async function validateIndividualChefSession(token: string) {
  const { data: s } = await supabaseAdmin
    .from("individual_chef_sessions")
    .select("restaurant_id, chef_credential_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!s || s.revoked) throw new Error("الجلسة منتهية");
  if (new Date(s.expires_at) < new Date()) throw new Error("الجلسة منتهية");
  return { restaurantId: s.restaurant_id as string, chefCredentialId: s.chef_credential_id as string };
}

export const getIndividualChefContext = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { restaurantId, chefCredentialId } = await validateIndividualChefSession(data.token);
    const [{ data: rest }, { data: chef }] = await Promise.all([
      supabaseAdmin.from("restaurants").select("name, logo_url").eq("id", restaurantId).maybeSingle(),
      supabaseAdmin.from("individual_chef_credentials").select("name").eq("id", chefCredentialId).maybeSingle(),
    ]);
    return {
      chefName: chef?.name ?? "",
      chefId: chefCredentialId,
      restaurant: { id: restaurantId, name: rest?.name ?? "", logo_url: rest?.logo_url ?? null },
    };
  });

export const individualChefLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("individual_chef_sessions")
      .update({ revoked: true })
      .eq("token", data.token);
    return { ok: true };
  });

// ─── Kitchen actions (same as shared chef, but tracks which chef did it) ──

export const individualChefListActive = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { restaurantId } = await validateIndividualChefSession(data.token);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select(
        "id, total, created_at, status, table_id, acknowledged, notes, order_type, customer_name, customer_phone, customer_address, daily_number, assigned_kitchen_id",
      )
      .eq("restaurant_id", restaurantId)
      .in("status", ["new", "preparing"])
      .order("created_at", { ascending: true });
    if (!orders?.length) return { orders: [] as ReturnType<typeof mapOrders> };
    const ids = orders.map((o) => o.id);
    const tableIds = Array.from(new Set(orders.map((o) => o.table_id).filter(Boolean))) as string[];
    const [{ data: items }, { data: tbls }] = await Promise.all([
      supabaseAdmin.from("order_items").select("order_id, name_snapshot, quantity").in("order_id", ids),
      tableIds.length
        ? supabaseAdmin.from("tables").select("id, table_number").in("id", tableIds)
        : Promise.resolve({ data: [] as Array<{ id: string; table_number: number }> }),
    ]);
    const byOrder = new Map<string, Array<{ name: string; qty: number }>>();
    (items ?? []).forEach((it) => {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({ name: it.name_snapshot, qty: Number(it.quantity) });
      byOrder.set(it.order_id, arr);
    });
    const tableMap = new Map<string, number>();
    (tbls ?? []).forEach((t) => tableMap.set(t.id, Number(t.table_number)));
    return { orders: mapOrders(orders, byOrder, tableMap) };
  });

type OrderRow = {
  id: string; status: string; created_at: string; acknowledged: boolean;
  table_id: string | null; notes: string | null; order_type: string | null;
  customer_name: string | null; customer_phone: string | null; customer_address: string | null;
  daily_number: number | null; assigned_kitchen_id: string | null;
};
function mapOrders(
  orders: OrderRow[],
  byOrder: Map<string, Array<{ name: string; qty: number }>>,
  tableMap: Map<string, number>,
) {
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    created_at: o.created_at,
    acknowledged: !!o.acknowledged,
    table_number: o.table_id ? (tableMap.get(o.table_id) ?? null) : null,
    notes: o.notes ?? null,
    order_type: o.order_type ?? "dine_in",
    customer_name: o.customer_name ?? null,
    customer_phone: o.customer_phone ?? null,
    customer_address: o.customer_address ?? null,
    daily_number: o.daily_number ?? null,
    assigned_kitchen_id: o.assigned_kitchen_id ?? null,
    items: byOrder.get(o.id) ?? [],
  }));
}

export const individualChefStartPreparing = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(10), orderId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { restaurantId, chefCredentialId } = await validateIndividualChefSession(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o || o.restaurant_id !== restaurantId) throw new Error("طلب غير موجود");
    if (o.status !== "new") throw new Error("الطلب ليس جديداً");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "preparing", acknowledged: true, assigned_kitchen_id: chefCredentialId })
      .eq("id", data.orderId);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const individualChefMarkReady = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(10), orderId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { restaurantId } = await validateIndividualChefSession(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o || o.restaurant_id !== restaurantId) throw new Error("طلب غير موجود");
    if (o.status !== "preparing") throw new Error("الطلب ليس قيد التحضير");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "ready" })
      .eq("id", data.orderId);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });
