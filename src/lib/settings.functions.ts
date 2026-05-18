import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isHexColor, MENU_LAYOUTS, MENU_THEMES } from "@/lib/menu-themes";
import { _genericDbError } from "./_errors.server";

const UpdateRestaurantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  logo_url: z.string().url().max(2000).nullable(),
  logo_upload: z
    .object({
      name: z.string().min(1).max(255),
      type: z.string().startsWith("image/"),
      base64: z.string().min(1),
    })
    .nullable()
    .optional(),
  google_maps_review_url: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((u) => u.startsWith("https://"), {
      message: "يجب أن يبدأ الرابط بـ https://",
    })
    .nullable(),
});

const MENU_THEME_IDS = Object.keys(MENU_THEMES) as [keyof typeof MENU_THEMES, ...(keyof typeof MENU_THEMES)[]];
const MENU_LAYOUT_IDS = Object.keys(MENU_LAYOUTS) as [keyof typeof MENU_LAYOUTS, ...(keyof typeof MENU_LAYOUTS)[]];

const UpdateMenuThemeSchema = z.object({
  menu_theme: z.string().trim().min(1).max(600).refine((value) => {
    if ((MENU_THEME_IDS as readonly string[]).includes(value)) return true;
    try {
      const parsed = JSON.parse(value) as {
        theme?: unknown;
        color?: unknown;
        layout?: unknown;
        headerColor?: unknown;
        categoryColor?: unknown;
        buttonColor?: unknown;
      };
      const optHex = (v: unknown) => v === undefined || v === null || isHexColor(v);
      return (
        typeof parsed === "object" &&
        parsed !== null &&
        (MENU_THEME_IDS as readonly unknown[]).includes(parsed.theme) &&
        isHexColor(parsed.color) &&
        (MENU_LAYOUT_IDS as readonly unknown[]).includes(parsed.layout) &&
        optHex(parsed.headerColor) &&
        optHex(parsed.categoryColor) &&
        optHex(parsed.buttonColor)
      );
    } catch {
      return false;
    }
  }, "اختيار الستايل غير صحيح"),
});

export const updateRestaurantSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateRestaurantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("restaurants")
      .select("id, logo_url")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (rErr) throw _genericDbError(rErr);
    if (!r) throw new Error("لا يوجد مطعم");

    let finalLogoUrl = data.logo_url;
    if (data.logo_upload) {
      const ext =
        data.logo_upload.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") ||
        "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const bytes = Uint8Array.from(atob(data.logo_upload.base64), (c) =>
        c.charCodeAt(0)
      );
      const { error: upErr } = await supabaseAdmin.storage
        .from("logos")
        .upload(path, bytes, {
          contentType: data.logo_upload.type,
          upsert: true,
        });
      if (upErr) {
        console.error("[settings] logo upload error", upErr);
        throw new Error("فشل رفع الشعار");
      }
      finalLogoUrl = supabaseAdmin.storage.from("logos").getPublicUrl(path).data
        .publicUrl;
      // best-effort delete old
      if (r.logo_url) {
        try {
          const u = new URL(r.logo_url);
          const idx = u.pathname.indexOf("/logos/");
          if (idx >= 0) {
            const oldPath = u.pathname.slice(idx + "/logos/".length);
            await supabaseAdmin.storage.from("logos").remove([oldPath]);
          }
        } catch {}
      }
    }

    const { error } = await supabase
      .from("restaurants")
      .update({
        name: data.name,
        logo_url: finalLogoUrl,
        google_maps_review_url: data.google_maps_review_url,
      })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true, logo_url: finalLogoUrl };
  });

export const updateMenuTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateMenuThemeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: r, error: rErr } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (rErr) throw _genericDbError(rErr);
    if (!r) throw new Error("لا يوجد مطعم");

    const { error } = await supabaseAdmin
      .from("restaurants")
      .update({ menu_theme: data.menu_theme })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

const FeatureSchema = z.object({
  icon: z.string().trim().min(1).max(50),
  text: z.string().trim().min(1).max(80),
});

const MediaUploadSchema = z
  .object({
    name: z.string().min(1).max(255),
    type: z.string().min(1).max(100),
    base64: z.string().min(1),
  })
  .nullable()
  .optional();

const UpdateSplashSchema = z.object({
  splash_enabled: z.boolean(),
  splash_always_show: z.boolean(),
  cover_type: z.enum(["image", "video"]),
  cover_image_url: z.string().url().max(2000).nullable(),
  cover_video_url: z.string().url().max(2000).nullable(),
  cover_upload: MediaUploadSchema,
  tagline: z.string().trim().max(140).nullable(),
  splash_description: z.string().trim().max(500).nullable(),
  features: z.array(FeatureSchema).max(8),
  instagram_url: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^https?:\/\//i.test(v), {
      message: "يجب أن يبدأ الرابط بـ http(s)://",
    }),
  facebook_url: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^https?:\/\//i.test(v), {
      message: "يجب أن يبدأ الرابط بـ http(s)://",
    }),
  whatsapp_number: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
});

export const getSplashSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: r, error } = await supabase
      .from("restaurants")
      .select(
        "id, cover_image_url, cover_video_url, cover_type, tagline, splash_description, features, instagram_url, facebook_url, whatsapp_number, brand_color, splash_enabled, splash_always_show",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw _genericDbError(error);
    if (!r) throw new Error("لا يوجد مطعم");
    return {
      splash_enabled: (r.splash_enabled as boolean | null) ?? true,
      splash_always_show: (r.splash_always_show as boolean | null) ?? false,
      cover_type: (r.cover_type as string) ?? "image",
      cover_image_url: (r.cover_image_url as string | null) ?? null,
      cover_video_url: (r.cover_video_url as string | null) ?? null,
      tagline: (r.tagline as string | null) ?? null,
      splash_description: (r.splash_description as string | null) ?? null,
      features: Array.isArray(r.features) ? (r.features as { icon: string; text: string }[]) : [],
      instagram_url: (r.instagram_url as string | null) ?? null,
      facebook_url: (r.facebook_url as string | null) ?? null,
      whatsapp_number: (r.whatsapp_number as string | null) ?? null,
      brand_color: (r.brand_color as string | null) ?? null,
    };
  });

export const updateSplashSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateSplashSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("restaurants")
      .select("id, cover_image_url, cover_video_url")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (rErr) throw _genericDbError(rErr);
    if (!r) throw new Error("لا يوجد مطعم");

    let coverImageUrl = data.cover_image_url;
    let coverVideoUrl = data.cover_video_url;

    if (data.cover_upload) {
      const isVideo = data.cover_upload.type.startsWith("video/");
      const isImage = data.cover_upload.type.startsWith("image/");
      if (!isVideo && !isImage) throw new Error("نوع الملف غير مدعوم");
      const ext =
        data.cover_upload.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") ||
        (isVideo ? "mp4" : "jpg");
      const path = `${userId}/${Date.now()}.${ext}`;
      const bytes = Uint8Array.from(atob(data.cover_upload.base64), (c) =>
        c.charCodeAt(0),
      );
      const { error: upErr } = await supabaseAdmin.storage
        .from("splash-media")
        .upload(path, bytes, {
          contentType: data.cover_upload.type,
          upsert: true,
        });
      if (upErr) {
        console.error("[splash] upload error", upErr);
        throw new Error("فشل رفع الملف");
      }
      const publicUrl = supabaseAdmin.storage
        .from("splash-media")
        .getPublicUrl(path).data.publicUrl;
      if (isVideo) {
        coverVideoUrl = publicUrl;
      } else {
        coverImageUrl = publicUrl;
      }
    }

    const { error } = await supabase
      .from("restaurants")
      .update({
        splash_enabled: data.splash_enabled,
        splash_always_show: data.splash_always_show,
        cover_type: data.cover_type,
        cover_image_url: coverImageUrl,
        cover_video_url: coverVideoUrl,
        tagline: data.tagline,
        splash_description: data.splash_description,
        features: data.features,
        instagram_url: data.instagram_url,
        facebook_url: data.facebook_url,
        whatsapp_number: data.whatsapp_number,
        brand_color: data.brand_color,
      })
      .eq("id", r.id);
    if (error) throw _genericDbError(error);
    return {
      ok: true,
      cover_image_url: coverImageUrl,
      cover_video_url: coverVideoUrl,
    };
  });
