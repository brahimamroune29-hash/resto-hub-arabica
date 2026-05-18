import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { _genericDbError } from "./_errors.server";
const GENERIC_ERR = "حدث خطأ، يرجى المحاولة لاحقاً";

const SubmitOrderSchema = z.object({
  qr_token: z.string().min(8).max(128),
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

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SubmitOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: table, error: tErr } = await supabaseAdmin
      .from("tables")
      .select("id, restaurant_id")
      .eq("qr_token", data.qr_token)
      .maybeSingle();
    if (tErr) {
      console.error("[submitOrder] tables lookup error", tErr);
      throw new Error(GENERIC_ERR);
    }
    if (!table) throw new Error("NOT_FOUND");

    const ids = data.items.map((i) => i.menu_item_id);
    const { data: items, error: iErr } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, is_available, restaurant_id")
      .in("id", ids);
    if (iErr) {
      console.error("[submitOrder] menu_items lookup error", iErr);
      throw new Error(GENERIC_ERR);
    }
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
      if (!m || m.restaurant_id !== table.restaurant_id || !m.is_available) {
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
      _restaurant_id: table.restaurant_id,
    });
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: table.restaurant_id,
        table_id: table.id,
        total,
        status: "new",
        acknowledged: false,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        daily_number: (dailyNum as number | null) ?? null,
      })
      .select("id, daily_number")
      .single();
    if (oErr || !order) {
      if (oErr) console.error("[submitOrder] insert order error", oErr);
      throw new Error("تعذّر إنشاء الطلب");
    }

    const { error: oiErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload.map((p) => ({ ...p, order_id: order.id })));
    if (oiErr) {
      console.error("[submitOrder] insert order_items error", oiErr);
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("تعذّر إنشاء الطلب");
    }

    return {
      order_id: order.id,
      order_number: order.daily_number != null
        ? String(order.daily_number).padStart(3, "0")
        : order.id.replace(/-/g, "").slice(-6).toUpperCase(),
    };
  });

export type OrderStatusInfo = {
  id: string;
  status: "new" | "preparing" | "ready" | "paid";
  review_due_at: string | null;
  google_maps_review_url: string | null;
  restaurant_id: string;
  has_review: boolean;
  daily_number: number | null;
};

export const getOrderStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { order_id: string; qr_token: string }) => {
    if (!data?.order_id || !data?.qr_token) throw new Error("معطيات ناقصة");
    return data;
  })
  .handler(async ({ data }): Promise<OrderStatusInfo | null> => {
    // Verify the order belongs to the same restaurant as the qr_token
    const { data: table } = await supabaseAdmin
      .from("tables")
      .select("restaurant_id")
      .eq("qr_token", data.qr_token)
      .maybeSingle();
    if (!table) return null;

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, review_due_at, restaurant_id, daily_number")
      .eq("id", data.order_id)
      .eq("restaurant_id", table.restaurant_id)
      .maybeSingle();
    if (!order) return null;

    const [{ data: rest }, { data: rev }] = await Promise.all([
      supabaseAdmin
        .from("restaurants")
        .select("google_maps_review_url")
        .eq("id", order.restaurant_id)
        .maybeSingle(),
      supabaseAdmin
        .from("reviews")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle(),
    ]);

    return {
      id: order.id,
      status: order.status as OrderStatusInfo["status"],
      review_due_at: order.review_due_at,
      google_maps_review_url: rest?.google_maps_review_url ?? null,
      restaurant_id: order.restaurant_id,
      has_review: !!rev,
      daily_number: (order as { daily_number: number | null }).daily_number ?? null,
    };
  });

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { order_id: string; qr_token: string; rating: number; comment?: string | null }) => {
      if (!data?.order_id) throw new Error("order_id مطلوب");
      if (!data?.qr_token || data.qr_token.length < 8 || data.qr_token.length > 128) {
        throw new Error("qr_token مطلوب");
      }
      if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
        throw new Error("التقييم يجب أن يكون من 1 إلى 5");
      }
      if (data.comment && data.comment.length > 1000) {
        throw new Error("التعليق طويل جداً");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, review_due_at, restaurant_id")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Error("الطلب غير موجود");

    // Verify the caller holds the qr_token for the same restaurant as the order.
    const { data: tableRow } = await supabaseAdmin
      .from("tables")
      .select("restaurant_id")
      .eq("qr_token", data.qr_token)
      .maybeSingle();
    if (!tableRow || tableRow.restaurant_id !== order.restaurant_id) {
      throw new Error("غير مصرح");
    }

    // Enforce review_due_at server-side (client time-gate is bypassable).
    if (order.review_due_at && new Date() < new Date(order.review_due_at as string)) {
      throw new Error("لا يمكن إرسال التقييم بعد");
    }

    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("order_id", data.order_id)
      .maybeSingle();
    if (existing) throw new Error("تم إرسال التقييم سابقاً");

    const shouldRedirect = data.rating >= 4;

    const { error: insErr } = await supabaseAdmin.from("reviews").insert({
      order_id: data.order_id,
      restaurant_id: order.restaurant_id,
      rating: data.rating,
      comment: data.comment ?? null,
      redirected_to_google: shouldRedirect,
    });
    if (insErr) throw _genericDbError(insErr);

    let googleUrl: string | null = null;
    if (shouldRedirect) {
      const { data: rest } = await supabaseAdmin
        .from("restaurants")
        .select("google_maps_review_url")
        .eq("id", order.restaurant_id)
        .maybeSingle();
      googleUrl = rest?.google_maps_review_url ?? null;
    }

    return {
      success: true,
      should_redirect: shouldRedirect,
      google_url: googleUrl,
    };
  });