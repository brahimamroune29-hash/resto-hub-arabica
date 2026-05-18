import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  imageBase64: z.string().min(50),
  mimeType: z.string().default("image/jpeg"),
});

type ParsedItem = {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

type ParsedReceipt = {
  supplier_name?: string | null;
  total_amount?: number | string | null;
  previous_debt?: number | string | null;
  grand_total_debt?: number | string | null;
  paid_amount?: number | string | null;
  items?: ParsedItem[];
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const easternDigits = "۰۱۲۳۴۵۶۷۸۹";
  const raw = String(value ?? "")
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(easternDigits.indexOf(d)))
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(".") ? raw.replace(/,/g, "") : raw.replace(",", ".");
  return Number(normalized) || 0;
};

export const analyzeReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY missing");

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    const sysPrompt =
      "أنت محلل فواتير شراء لمطعم. استخرج بيانات المورد والمبالغ وكل سطر منتج من الصورة. " +
      "أعد JSON فقط بهذا الشكل: " +
      `{"supplier_name":"اسم المورد","total_amount":<مجموع الفاتورة الحالية>,"previous_debt":<الدين السابق>,"grand_total_debt":<الدين الإجمالي/الباقي>,"paid_amount":<المبلغ المدفوع>,"items":[{"name":"اسم المنتج","quantity":<رقم>,"unit":"كغ|لتر|حبة|علبة|...","unit_price":<سعر الوحدة بالدج>}]}. ` +
      "إذا لم تجد قيمة من القيم المالية أعدها 0، وإذا لم تجد اسم المورد أعد نصاً فارغاً. " +
      "إذا الفاتورة تعرض السعر الإجمالي فقط، احسب unit_price = total/quantity. " +
      "لا تضف أي شرح خارج JSON.";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "حلل هذه الفاتورة:" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("تم تجاوز حد الطلبات، حاول لاحقاً");
      if (res.status === 402) throw new Error("نفذ رصيد الذكاء الاصطناعي");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: ParsedReceipt = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }
    const items = (parsed.items ?? [])
      .filter((x) => x && x.name && Number(x.quantity) > 0)
      .map((x) => ({
        name: String(x.name).trim(),
        quantity: Number(x.quantity) || 0,
        unit: String(x.unit ?? "حبة").trim(),
        unit_price: toNumber(x.unit_price),
      }));

    return {
      supplierName: String(parsed.supplier_name ?? "").trim() || null,
      totalAmount: toNumber(parsed.total_amount),
      previousDebt: toNumber(parsed.previous_debt),
      grandTotalDebt: toNumber(parsed.grand_total_debt),
      paidAmount: toNumber(parsed.paid_amount),
      items,
    };
  });