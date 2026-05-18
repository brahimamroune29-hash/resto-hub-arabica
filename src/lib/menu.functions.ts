import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type MenuByQrResult = {
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
  table: { id: string; table_number: number };
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

export const getMenuByQr = createServerFn({ method: "GET" })
  .inputValidator((data: { qr_token: string }) => {
    if (!data?.qr_token || typeof data.qr_token !== "string") {
      throw new Error("qr_token مطلوب");
    }
    return data;
  })
  .handler(async ({ data }): Promise<MenuByQrResult> => {
    const { data: table, error: tErr } = await supabaseAdmin
      .from("tables")
      .select("id, table_number, restaurant_id")
      .eq("qr_token", data.qr_token)
      .maybeSingle();

    if (tErr) {
      console.error("[getMenuByQr] tables error", tErr);
      throw new Error("حدث خطأ، يرجى المحاولة لاحقاً");
    }
    if (!table) throw new Error("NOT_FOUND");

    const [restRes, catRes, itemsRes] = await Promise.all([
      supabaseAdmin
        .from("restaurants")
        .select(
          "id, name, logo_url, menu_theme, cover_image_url, cover_video_url, cover_type, tagline, splash_description, features, instagram_url, facebook_url, whatsapp_number, brand_color, splash_enabled, splash_always_show",
        )
        .eq("id", table.restaurant_id)
        .maybeSingle(),
      supabaseAdmin
        .from("categories")
        .select("id, name, display_order")
        .eq("restaurant_id", table.restaurant_id)
        .order("display_order", { ascending: true }),
      supabaseAdmin
        .from("menu_items")
        .select("id, name, description, price, image_url, category_id, is_available")
        .eq("restaurant_id", table.restaurant_id)
        .eq("is_available", true),
    ]);

    if (restRes.error || catRes.error || itemsRes.error) {
      console.error("[getMenuByQr] fetch error", {
        rest: restRes.error,
        cat: catRes.error,
        items: itemsRes.error,
      });
      throw new Error("حدث خطأ، يرجى المحاولة لاحقاً");
    }
    if (!restRes.data) throw new Error("NOT_FOUND");

    // Aggregate reviews (best-effort)
    let rating_avg: number | null = null;
    let rating_count = 0;
    try {
      const { data: reviews } = await supabaseAdmin
        .from("reviews")
        .select("rating")
        .eq("restaurant_id", table.restaurant_id);
      if (reviews && reviews.length > 0) {
        rating_count = reviews.length;
        rating_avg =
          reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length;
      }
    } catch {
      // ignore
    }

    const r = restRes.data as Record<string, unknown>;
    const features = Array.isArray(r.features)
      ? (r.features as { icon: string; text: string }[])
      : [];

    return {
      restaurant: {
        id: String(r.id),
        name: String(r.name),
        logo_url: (r.logo_url as string | null) ?? null,
        menu_theme: (r.menu_theme as string | null) ?? null,
        splash: {
          splash_enabled: (r.splash_enabled as boolean | null) ?? true,
          splash_always_show: (r.splash_always_show as boolean | null) ?? false,
          cover_image_url: (r.cover_image_url as string | null) ?? null,
          cover_video_url: (r.cover_video_url as string | null) ?? null,
          cover_type: (r.cover_type as string | null) ?? "image",
          tagline: (r.tagline as string | null) ?? null,
          description: (r.splash_description as string | null) ?? null,
          features,
          instagram_url: (r.instagram_url as string | null) ?? null,
          facebook_url: (r.facebook_url as string | null) ?? null,
          whatsapp_number: (r.whatsapp_number as string | null) ?? null,
          brand_color: (r.brand_color as string | null) ?? null,
          rating_avg,
          rating_count,
        },
      },
      table: { id: table.id, table_number: table.table_number },
      categories: catRes.data ?? [],
      menu_items: (itemsRes.data ?? []).map((m) => ({
        ...m,
        price: Number(m.price),
      })),
    };
  });