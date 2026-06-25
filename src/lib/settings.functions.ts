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

// ─── Staff account creation (no email required) ──────────────────────────

const VALID_MANAGER_ROLES = [
  "staff",
  "production_manager",
  "operations_manager",
  "hr_manager",
  "purchasing_manager",
] as const;

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6, "كلمة السر 6 أحرف على الأقل"),
        role: z.enum(VALID_MANAGER_ROLES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Get owner's restaurant
    const { data: r } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");

    const email = data.email.trim().toLowerCase();

    // Create the user directly — no email confirmation needed
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        restaurant_id: r.id,
        restaurant_name: r.name,
        staff_role: data.role,
      },
    });

    let newUserId: string;

    if (createErr) {
      const msg = createErr.message.toLowerCase();
      if (!msg.includes("already") && !msg.includes("exists") && !msg.includes("registered")) {
        throw new Error(createErr.message);
      }
      // User exists (ghost from old invite or real) — find them and update password
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw new Error("هذا البريد مسجّل بالفعل في نظام آخر — جرّب بريداً آخر");
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
      });
      newUserId = existing.id;
    } else {
      newUserId = created!.user.id;
    }

    // Assign role in user_roles
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: data.role, restaurant_id: r.id },
        { onConflict: "user_id,restaurant_id" },
      );
    if (roleErr) throw new Error("تم إنشاء الحساب لكن فشل تعيين الدور");

    return { ok: true, userId: newUserId, email };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ staffUserId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the staff belongs to this owner's restaurant
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.staffUserId)
      .eq("restaurant_id", r.id)
      .maybeSingle();
    if (!role) throw new Error("المستخدم غير موجود");

    // Delete role then auth user
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.staffUserId);
    await supabaseAdmin.auth.admin.deleteUser(data.staffUserId);

    return { ok: true };
  });

export const listStaffAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    if (!r) return { staff: [] as { id: string; user_id: string; role: string; email: string }[] };

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role")
      .eq("restaurant_id", r.id)
      .neq("role", "admin");

    if (!roles || roles.length === 0) return { staff: [] as { id: string; user_id: string; role: string; email: string }[] };

    const staff = await Promise.all(
      (roles as { id: string; user_id: string; role: string }[]).map(async (row) => {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        return {
          id: row.id,
          user_id: row.user_id,
          role: row.role,
          email: user?.email ?? "—",
        };
      }),
    );

    return { staff };
  });

export const updateStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ staffUserId: z.string().uuid(), newPassword: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify ownership
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");

    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.staffUserId)
      .eq("restaurant_id", r.id)
      .maybeSingle();
    if (!role) throw new Error("المستخدم غير موجود");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.staffUserId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
