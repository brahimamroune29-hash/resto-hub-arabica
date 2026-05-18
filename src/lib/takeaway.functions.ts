import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { _genericDbError } from "./_errors.server";

const GENERIC_ERR = "حدث خطأ، يرجى المحاولة لاحقاً";

function newToken() {
  return randomBytes(12).toString("hex");
}

async function getOwnerRestaurant(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("restaurants")
    .select("id, takeaway_enabled, takeaway_token")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw _genericDbError(error);
  if (!data) throw new Error("لا يوجد مطعم");
  return data as { id: string; takeaway_enabled: boolean; takeaway_token: string | null };
}

export const getTakeawayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const r = await getOwnerRestaurant(userId);
    return { enabled: !!r.takeaway_enabled, token: r.takeaway_token };
  });

export const enableTakeaway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const r = await getOwnerRestaurant(userId);
    const token = r.takeaway_token ?? newToken();
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ takeaway_enabled: true, takeaway_token: token })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true, token };
  });

export const disableTakeaway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const r = await getOwnerRestaurant(userId);
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ takeaway_enabled: false })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const regenerateTakeawayToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const r = await getOwnerRestaurant(userId);
    const token = newToken();
    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ takeaway_token: token, takeaway_enabled: true })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true, token };
  });

export type TakeawayMenuResult = {
  restaurant: {
    id: string;
    name: string;
    logo_url: string | null;
    menu_theme: string | null;
    splash: {
      splash_enabled: boolean;
      splash_always_show: boolean;
      cover_image_url: string | null;
      cover_video_url: string | null;
      cover_type: string;
      tagline: string | null;
      description: string | null;
      features: { icon: string; text: string }[];
      instagram_url: string | null;
      facebook_url: string | null;
      whatsapp_number: string | null;
      brand_color: string | null;
      rating_avg: number | null;
      rating_count: number;
    };
  };
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

export const getMenuByTakeawayToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => {
    if (!d?.token || typeof d.token !== "string") throw new Error("token مطلوب");
    return d;
  })
  .handler(async ({ data }): Promise<TakeawayMenuResult> => {
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, logo_url, menu_theme, takeaway_enabled, cover_image_url, cover_video_url, cover_type, tagline, splash_description, features, instagram_url, facebook_url, whatsapp_number, brand_color, splash_enabled, splash_always_show")
      .eq("takeaway_token", data.token)
      .maybeSingle();
    if (rErr) {
      console.error("[getMenuByTakeawayToken]", rErr);
      throw new Error(GENERIC_ERR);
    }
    if (!rest || !rest.takeaway_enabled) throw new Error("NOT_FOUND");

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

    let rating_avg: number | null = null;
    let rating_count = 0;
    try {
      const { data: reviews } = await supabaseAdmin
        .from("reviews")
        .select("rating")
        .eq("restaurant_id", rest.id);
      if (reviews && reviews.length > 0) {
        rating_count = reviews.length;
        rating_avg =
          reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;
      }
    } catch {
      // ignore
    }

    const features = Array.isArray((rest as Record<string, unknown>).features)
      ? ((rest as Record<string, unknown>).features as { icon: string; text: string }[])
      : [];

    return {
      restaurant: {
        id: rest.id,
        name: rest.name,
        logo_url: rest.logo_url,
        menu_theme: rest.menu_theme,
        splash: {
          splash_enabled: ((rest as Record<string, unknown>).splash_enabled as boolean | null) ?? true,
          splash_always_show: ((rest as Record<string, unknown>).splash_always_show as boolean | null) ?? false,
          cover_image_url: ((rest as Record<string, unknown>).cover_image_url as string | null) ?? null,
          cover_video_url: ((rest as Record<string, unknown>).cover_video_url as string | null) ?? null,
          cover_type: ((rest as Record<string, unknown>).cover_type as string | null) ?? "image",
          tagline: ((rest as Record<string, unknown>).tagline as string | null) ?? null,
          description: ((rest as Record<string, unknown>).splash_description as string | null) ?? null,
          features,
          instagram_url: ((rest as Record<string, unknown>).instagram_url as string | null) ?? null,
          facebook_url: ((rest as Record<string, unknown>).facebook_url as string | null) ?? null,
          whatsapp_number: ((rest as Record<string, unknown>).whatsapp_number as string | null) ?? null,
          brand_color: ((rest as Record<string, unknown>).brand_color as string | null) ?? null,
          rating_avg,
          rating_count,
        },
      },
      categories: catRes.data ?? [],
      menu_items: (itemsRes.data ?? []).map((m) => ({ ...m, price: Number(m.price) })),
    };
  });

const SubmitTakeawaySchema = z.object({
  token: z.string().min(8).max(128),
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: z.string().trim().min(4).max(40),
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

export const submitTakeawayOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubmitTakeawaySchema.parse(d))
  .handler(async ({ data }) => {
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, takeaway_enabled")
      .eq("takeaway_token", data.token)
      .maybeSingle();
    if (rErr) {
      console.error("[submitTakeawayOrder] restaurant lookup", rErr);
      throw new Error(GENERIC_ERR);
    }
    if (!rest || !rest.takeaway_enabled) throw new Error("NOT_FOUND");

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

    // Atomically reserve the daily code (resets each day at 6am Africa/Algiers)
    const { data: dailyNum, error: dnErr } = await supabaseAdmin.rpc(
      "assign_daily_number",
      { _restaurant_id: rest.id },
    );
    if (dnErr) {
      console.error("[submitTakeawayOrder] assign_daily_number", dnErr);
      throw new Error(GENERIC_ERR);
    }

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: rest.id,
        table_id: null,
        total,
        status: "new",
        acknowledged: false,
        notes: data.notes?.trim() ? data.notes.trim() : null,
        order_type: "takeaway",
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        daily_number: dailyNum as number,
      })
      .select("id, daily_number")
      .single();
    if (oErr || !order) {
      if (oErr) console.error("[submitTakeawayOrder] insert order", oErr);
      throw new Error("تعذّر إنشاء الطلب");
    }

    const { error: oiErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsPayload.map((p) => ({ ...p, order_id: order.id })));
    if (oiErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("تعذّر إنشاء الطلب");
    }

    return {
      order_id: order.id,
      daily_number: order.daily_number as number,
      total,
    };
  });

export const getTakeawayOrderStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string; order_id: string }) => {
    if (!d?.token || typeof d.token !== "string") throw new Error("token مطلوب");
    if (!d?.order_id || typeof d.order_id !== "string") throw new Error("order_id مطلوب");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: rest, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("takeaway_token", data.token)
      .maybeSingle();
    if (rErr) throw new Error(GENERIC_ERR);
    if (!rest) throw new Error("NOT_FOUND");

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, status, total, created_at, restaurant_id, daily_number")
      .eq("id", data.order_id)
      .maybeSingle();
    if (oErr) throw new Error(GENERIC_ERR);
    if (!order || order.restaurant_id !== rest.id) throw new Error("NOT_FOUND");

    return {
      order_id: order.id,
      daily_number: order.daily_number as number | null,
      status: order.status as string,
      total: Number(order.total),
      created_at: order.created_at as string,
    };
  });