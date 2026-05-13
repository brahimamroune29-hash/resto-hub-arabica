import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const setupRestaurantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  googleMapsReviewUrl: z.string().url(),
  logo: z
    .object({
      name: z.string().min(1).max(255),
      type: z.string().startsWith("image/"),
      base64: z.string().min(1),
    })
    .nullable(),
});

export const createRestaurantSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => setupRestaurantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let logoUrl: string | null = null;

    if (data.logo) {
      console.log("[setup/server] uploading logo", {
        userId,
        name: data.logo.name,
        type: data.logo.type,
        bytesBase64: data.logo.base64.length,
      });
      const ext =
        data.logo.name
          .split(".")
          .pop()
          ?.replace(/[^a-zA-Z0-9]/g, "") || "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const bytes = Uint8Array.from(atob(data.logo.base64), (char) => char.charCodeAt(0));
      const { error: uploadError } = await supabaseAdmin.storage
        .from("logos")
        .upload(path, bytes, { contentType: data.logo.type, upsert: true });

      if (uploadError) {
        console.error("[setup/server] logo upload error", uploadError);
        throw new Error("فشل رفع الشعار");
      }

      logoUrl = supabaseAdmin.storage.from("logos").getPublicUrl(path).data.publicUrl;
      console.log("[setup/server] logo url", logoUrl);
    }

    const payload = {
      owner_id: userId,
      name: data.name,
      logo_url: logoUrl,
      google_maps_review_url: data.googleMapsReviewUrl,
      setup_completed: true,
    };

    console.log("[setup/server] auth.uid", userId);
    console.log("[setup/server] insert payload", payload);

    const { data: restaurant, error } = await supabaseAdmin
      .from("restaurants")
      .insert(payload)
      .select()
      .maybeSingle();

    console.log("[setup/server] insert result", { restaurant, error });

    if (error) {
      console.error("[setup/server] insert error", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw new Error("تعذّر إنشاء المطعم، يرجى المحاولة لاحقاً");
    }

    return restaurant;
  });
