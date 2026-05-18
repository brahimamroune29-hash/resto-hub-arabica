import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  imageBase64: z.string().min(50), // data URL or raw base64
});

type ParsedItem = { name: string; description?: string; price: number };
type ParsedCategory = { name: string; items: ParsedItem[] };

export const parseMenuImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY غير مهيأ");

    const url = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You extract restaurant menu data from a photo. Return ONLY a JSON object via the tool call. Group items by visible category headings. If no categories appear, use a single category named 'القائمة'. Prices must be numeric (no currency symbol). Translate nothing — keep names in original language.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "استخرج جميع الأصناف من صورة المنيو هذه." },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_menu",
              description: "Save the extracted menu",
              parameters: {
                type: "object",
                properties: {
                  categories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              description: { type: "string" },
                              price: { type: "number" },
                            },
                            required: ["name", "price"],
                          },
                        },
                      },
                      required: ["name", "items"],
                    },
                  },
                },
                required: ["categories"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_menu" } },
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز الحد، حاول لاحقاً");
    if (res.status === 402) throw new Error("الرصيد منتهي. الرجاء التحقق من حساب OpenAI");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`فشل تحليل الصورة (${res.status}) ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("لم يتم استخراج أي بيانات من الصورة");
    let parsed: { categories: ParsedCategory[] };
    try {
      parsed = JSON.parse(args);
    } catch {
      throw new Error("استجابة AI غير صالحة");
    }
    // sanitize
    const categories = (parsed.categories ?? [])
      .map((c) => ({
        name: String(c.name ?? "").trim() || "القائمة",
        items: (c.items ?? [])
          .map((it) => ({
            name: String(it.name ?? "").trim(),
            description: it.description ? String(it.description).trim() : "",
            price: Number(it.price) || 0,
          }))
          .filter((it) => it.name && it.price > 0),
      }))
      .filter((c) => c.items.length > 0);
    if (categories.length === 0) throw new Error("لم يتم العثور على أصناف في الصورة");
    return { categories };
  });