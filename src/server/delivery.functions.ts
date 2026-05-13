import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { _genericDbError } from "./_errors.server";
import {
  sendTelegramMessageWithKeyboard,
  type InlineKeyboard,
} from "./telegram.server";

const GENERIC_ERR = "حدث خطأ، يرجى المحاولة لاحقاً";

function newToken() {
  return randomBytes(12).toString("hex");
}

async function getOwnerRestaurant(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, delivery_enabled, delivery_token")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw _genericDbError(error);
  if (!data) throw new Error("لا يوجد مطعم");
  return data as { id: string; delivery_enabled: boolean; delivery_token: string | null };
}

export const getDeliveryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    return { enabled: !!r.delivery_enabled, token: r.delivery_token };
  });

export const enableDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const token = r.delivery_token ?? newToken();
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ delivery_enabled: true, delivery_token: token })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true, token };
  });

export const disableDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ delivery_enabled: false })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const regenerateDeliveryToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const r = await getOwnerRestaurant(supabase, userId);
    const token = newToken();
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ delivery_token: token, delivery_enabled: true })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true, token };
  });

export type DeliveryMenuResult = {
  restaurant: { id: string; name: string; logo_url: string | null; menu_theme: string | null };
  categories: { id: string; name: string; display_order: number }[];
  menu_items: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category_id: string | null;
    is_available: boolean;
  }[];
};

export const getMenuByDeliveryToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => {
    if (!d?.token || typeof d.token !== "string") throw new Error("token مطلوب");
    return d;
  })
  .handler(async ({ data }): Promise<DeliveryMenuResult> => {
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, logo_url, menu_theme, delivery_enabled")
      .eq("delivery_token", data.token)
      .maybeSingle();
    if (rErr) {
      console.error("[getMenuByDeliveryToken]", rErr);
      throw new Error(GENERIC_ERR);
    }
    if (!rest || !rest.delivery_enabled) throw new Error("NOT_FOUND");

    const [catRes, itemsRes] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, name, display_order")
        .eq("restaurant_id", rest.id)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("menu_items")
        .select("id, name, description, price, image_url, category_id, is_available")
        .eq("restaurant_id", rest.id)
        .eq("is_available", true),
    ]);
    if (catRes.error || itemsRes.error) throw new Error(GENERIC_ERR);

    return {
      restaurant: {
        id: rest.id,
        name: rest.name,
        logo_url: rest.logo_url,
        menu_theme: rest.menu_theme,
      },
      categories: catRes.data ?? [],
      menu_items: (itemsRes.data ?? []).map((m) => ({ ...m, price: Number(m.price) })),
    };
  });

const SubmitDeliverySchema = z.object({
  token: z.string().min(8).max(128),
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: z.string().trim().min(4).max(40),
  customer_address: z.string().trim().min(3).max(500),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
});

export const submitDeliveryOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitDeliverySchema.parse(d))
  .handler(async ({ data }) => {
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, delivery_enabled, telegram_chat_id, telegram_bot_token")
      .eq("delivery_token", data.token)
      .maybeSingle();
    if (rErr) {
      console.error("[submitDeliveryOrder] restaurant lookup", rErr);
      throw new Error(GENERIC_ERR);
    }
    if (!rest || !rest.delivery_enabled) throw new Error("NOT_FOUND");

    const ids = data.items.map((i) => i.menu_item_id);
    const { data: items, error: iErr } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, is_available, restaurant_id")
      .in("id", ids);
    if (iErr) throw new Error(GENERIC_ERR);
    if (!items || items.length === 0) throw new Error("لا توجد أصناف");

    const byId = new Map(items.map((m) => [m.id, m]));
    let total = 0;
    const orderItemsPayload: {
      menu_item_id: string;
      name_snapshot: string;
      price_snapshot: number;
      quantity: number;
    }[] = [];

    for (const it of data.items) {
      const m = byId.get(it.menu_item_id);
      if (!m || m.restaurant_id !== rest.id || !m.is_available) {
        throw new Error("صنف غير متاح");
      }
      const price = Number(m.price);
      total += price * it.quantity;
      orderItemsPayload.push({
        menu_item_id: m.id,
        name_snapshot: m.name,
        price_snapshot: price,
        quantity: it.quantity,
      });
    }

    const { data: dailyNum } = await supabaseAdmin.rpc("assign_daily_number", {
      _restaurant_id: rest.id,
    });
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: rest.id,
        table_id: null,
        total,
        status: "new",
        acknowledged: false,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        order_type: "delivery",
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        customer_address: data.customer_address.trim(),
        daily_number: (dailyNum as number | null) ?? null,
      })
      .select("id")
      .single();
    if (oErr || !order) {
      if (oErr) console.error("[submitDeliveryOrder] insert order", oErr);
      throw new Error("تعذّر إنشاء الطلب");
    }

    const { error: oiErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload.map((p) => ({ ...p, order_id: order.id })));
    if (oiErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("تعذّر إنشاء الطلب");
    }

    // Telegram notifications: broadcast to all linked drivers
    // (and to the restaurant owner's linked Telegram, if any) with a Claim button.
    // NOTE: must be awaited — fire-and-forget is killed in the edge Worker runtime
    // after the HTTP response is sent, so messages would never go out.
    await (async () => {
      try {
        const orderNum = order.id.replace(/-/g, "").slice(-6).toUpperCase();
        const itemsList = orderItemsPayload
          .map((p) => `• ${p.name_snapshot} × ${p.quantity}`)
          .join("\n");
        const notesLine = data.notes?.trim()
          ? `\n📝 <b>ملاحظة:</b> ${data.notes.trim()}`
          : "";
        const text =
          `🛵 <b>طلب توصيل جديد!</b>\n` +
          `🏷️ <b>${rest.name}</b>\n` +
          `🔢 رقم الطلب: <code>#${orderNum}</code>\n\n` +
          `🍽️ <b>الطلب:</b>\n${itemsList}\n\n` +
          `📍 <b>مكان التوصيل:</b> ${data.customer_address}\n\n` +
          `💰 <b>المجموع:</b> ${total.toLocaleString("fr-DZ")} دج\n\n` +
          `🔒 <i>اسم العميل ورقم هاتفه يظهران بعد استلام الطلب.</i>` +
          notesLine;

        const { data: drivers } = await supabaseAdmin
          .from("delivery_drivers")
          .select("telegram_chat_id")
          .eq("restaurant_id", rest.id)
          .eq("is_active", true)
          .not("telegram_chat_id", "is", null);

        const chatIds = new Set<number>();
        for (const d of drivers ?? []) {
          if (d.telegram_chat_id != null) chatIds.add(Number(d.telegram_chat_id));
        }
        if (rest.telegram_chat_id) chatIds.add(Number(rest.telegram_chat_id));

        console.log("[telegram broadcast] start", {
          orderId: order.id,
          restaurantId: rest.id,
          driverCount: drivers?.length ?? 0,
          chatIdsCount: chatIds.size,
          hasCustomBot: !!(rest as any).telegram_bot_token,
        });
        if (chatIds.size === 0) {
          console.warn("[telegram broadcast] no chat ids — skipped", { orderId: order.id });
          return;
        }

        const keyboard: InlineKeyboard = {
          inline_keyboard: [
            [{ text: "🛵 استلام الطلب", callback_data: `claim:${order.id}` }],
          ],
        };

        const botToken = (rest as any).telegram_bot_token as string | null;
        await Promise.all(
          Array.from(chatIds).map(async (chatId) => {
            try {
              const sent = await sendTelegramMessageWithKeyboard(chatId, text, keyboard, { botToken });
              await supabaseAdmin.from("order_telegram_messages").insert({
                order_id: order.id,
                chat_id: chatId,
                message_id: sent.message_id,
                kind: "new_order",
              });
            } catch (err) {
              console.error("[telegram notify driver]", chatId, err);
            }
          }),
        );
      } catch (err) {
        console.error("[telegram broadcast]", err);
      }
    })();

    return {
      order_id: order.id,
      order_number: order.id.replace(/-/g, "").slice(-6).toUpperCase(),
      total,
    };
  });

export const getDeliveryOrderStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string; order_id: string }) => {
    if (!d?.token || typeof d.token !== "string") throw new Error("token مطلوب");
    if (!d?.order_id || typeof d.order_id !== "string") throw new Error("order_id مطلوب");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("delivery_token", data.token)
      .maybeSingle();
    if (rErr) throw new Error(GENERIC_ERR);
    if (!rest) throw new Error("NOT_FOUND");

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, total, created_at, restaurant_id, order_type")
      .eq("id", data.order_id)
      .maybeSingle();
    if (oErr) throw new Error(GENERIC_ERR);
    if (!order || order.restaurant_id !== rest.id) throw new Error("NOT_FOUND");

    return {
      order_id: order.id,
      order_number: order.id.replace(/-/g, "").slice(-6).toUpperCase(),
      status: order.status as string,
      total: Number(order.total),
      created_at: order.created_at as string,
    };
  });