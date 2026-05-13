import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegramMessage } from "./telegram.server";

const Input = z.object({ ingredientId: z.string().uuid() });

export const sendLowStockAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ing, error } = await supabase
      .from("ingredients")
      .select("id, name, unit, current_stock, alert_threshold, restaurant_id")
      .eq("id", data.ingredientId)
      .maybeSingle();
    if (error || !ing) return { sent: false, reason: "not_found" };
    if (Number(ing.current_stock) >= Number(ing.alert_threshold)) {
      return { sent: false, reason: "above_threshold" };
    }
    const { data: r } = await supabase
      .from("restaurants")
      .select("name, telegram_chat_id, telegram_bot_token")
      .eq("id", ing.restaurant_id)
      .maybeSingle();
    if (!r?.telegram_chat_id) return { sent: false, reason: "no_telegram" };
    const text =
      `⚠️ <b>تنبيه: مخزون ناقص</b>\n` +
      `🏪 ${r.name}\n` +
      `📦 ${ing.name}\n` +
      `الكمية الحالية: <b>${ing.current_stock} ${ing.unit}</b>\n` +
      `العتبة: ${ing.alert_threshold} ${ing.unit}`;
    try {
      await sendTelegramMessage(r.telegram_chat_id, text, {
        botToken: r.telegram_bot_token,
      });
      return { sent: true };
    } catch (e: any) {
      return { sent: false, reason: e?.message ?? "send_failed" };
    }
  });

const PurchaseInput = z.object({
  restaurantId: z.string().uuid(),
  itemCount: z.number().int().nonnegative(),
  totalCost: z.number().nonnegative(),
  source: z.enum(["receipt", "manual"]).default("manual"),
});

export const sendPurchaseNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PurchaseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("name, telegram_chat_id, telegram_bot_token")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!r?.telegram_chat_id) return { sent: false };
    const label = data.source === "receipt" ? "📸 فاتورة شراء (تصوير)" : "🛒 إدخال يدوي";
    const text =
      `${label}\n` +
      `🏪 ${r.name}\n` +
      `عدد المكونات: <b>${data.itemCount}</b>\n` +
      `الإجمالي: <b>${data.totalCost.toFixed(2)} دج</b>\n` +
      `تم تحديث المخزون تلقائياً.`;
    try {
      await sendTelegramMessage(r.telegram_chat_id, text, {
        botToken: r.telegram_bot_token,
      });
      return { sent: true };
    } catch {
      return { sent: false };
    }
  });
