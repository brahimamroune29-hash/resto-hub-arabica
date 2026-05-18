import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ChatMsg = { role: "user" | "assistant"; content: string };

async function buildMenuContext(qrToken: string): Promise<{ name: string; ctx: string } | null> {
  const { data: table } = await supabaseAdmin
    .from("tables")
    .select("restaurant_id")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (!table) return null;

  const [restRes, catRes, itemsRes] = await Promise.all([
    supabaseAdmin
      .from("restaurants")
      .select("name, tagline, splash_description, whatsapp_number")
      .eq("id", table.restaurant_id)
      .maybeSingle(),
    supabaseAdmin
      .from("categories")
      .select("id, name, display_order")
      .eq("restaurant_id", table.restaurant_id)
      .order("display_order", { ascending: true }),
    supabaseAdmin
      .from("menu_items")
      .select("name, description, price, category_id, is_available")
      .eq("restaurant_id", table.restaurant_id)
      .eq("is_available", true),
  ]);

  const cats = catRes.data ?? [];
  const items = itemsRes.data ?? [];
  const grouped = cats.map((c) => ({
    category: c.name,
    items: items
      .filter((i) => i.category_id === c.id)
      .map((i) => ({
        name: i.name,
        price_dzd: Number(i.price ?? 0),
        description: i.description ?? "",
      })),
  }));
  // uncategorised
  const uncat = items.filter((i) => !cats.find((c) => c.id === i.category_id));
  if (uncat.length) {
    grouped.push({
      category: "أخرى",
      items: uncat.map((i) => ({
        name: i.name,
        price_dzd: Number(i.price ?? 0),
        description: i.description ?? "",
      })),
    });
  }

  const restaurantName = (restRes.data?.name as string) ?? "المطعم";
  const ctx = JSON.stringify(
    {
      restaurant: {
        name: restaurantName,
        tagline: restRes.data?.tagline ?? null,
        about: restRes.data?.splash_description ?? null,
      },
      menu: grouped,
    },
    null,
    2,
  );
  return { name: restaurantName, ctx };
}

export const askMenuBot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        qr_token: z.string().min(1).max(200),
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(2000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("الخدمة غير متاحة حالياً");

    const ctx = await buildMenuContext(data.qr_token);
    if (!ctx) throw new Error("لم يتم العثور على المطعم");

    const systemPrompt = `أنت "نادل ${ctx.name}" — مساعد ذكي ودود يساعد الزبائن على اختيار طعامهم.
تتحدث بلهجة جزائرية بسيطة ومرحة. أجوبتك قصيرة (سطرين-ثلاثة) وعملية.

مهامك:
- اقترح أطباقاً من المنيو حسب ذوق الزبون أو ميزانيته أو حالته (جوعان، خفيف، حلو...).
- أجب عن الأسعار والمكونات الموجودة في المنيو فقط.
- إذا سُئلت عن طبق غير موجود قل بصراحة: "هذا الطبق غير متوفر اليوم" واقترح بديلاً قريباً.
- لا تخترع أسعاراً أو أطباقاً. لا تتحدث عن أمور خارج المطعم/المنيو.
- استخدم رمز "دج" للأسعار. لا تستخدم Markdown مفرط.
- شجّع الزبون لكن بدون مبالغة.

بيانات المنيو الحالية:
\`\`\`json
${ctx.ctx}
\`\`\``;

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m: ChatMsg) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
      }),
    });

    if (res.status === 429) throw new Error("الكثير من الطلبات، حاول بعد قليل");
    if (res.status === 402) throw new Error("الخدمة غير متاحة مؤقتاً");
    if (!res.ok) {
      const t = await res.text();
      console.error("[menu-chat] gateway error", res.status, t);
      throw new Error("تعذّر الاتصال بالمساعد");
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "آسف، ما فهمتك";
    return { reply };
  });