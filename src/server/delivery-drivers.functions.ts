import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { _genericDbError } from "./_errors.server";
import { getBotUsername } from "./telegram.server";

async function getOwnerRestaurantId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw _genericDbError(error);
  if (!data) throw new Error("لا يوجد مطعم");
  return data.id as string;
}

export const listDeliveryDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const rid = await getOwnerRestaurantId(supabase, userId);
    const { data: restRow } = await supabaseAdmin
      .from("restaurants")
      .select("telegram_bot_username")
      .eq("id", rid)
      .maybeSingle();
    const { data, error } = await supabase
      .from("delivery_drivers")
      .select("id, display_name, telegram_chat_id, telegram_username, link_token, is_active, created_at")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: true });
    if (error) throw _genericDbError(error);
    let botUsername = (restRow as any)?.telegram_bot_username ?? "";
    if (!botUsername) {
      try { botUsername = await getBotUsername(); } catch { /* noop */ }
    }
    return {
      botUsername,
      drivers: (data ?? []).map((d) => ({
        id: d.id,
        display_name: d.display_name,
        telegram_username: d.telegram_username,
        linked: !!d.telegram_chat_id,
        is_active: d.is_active,
        link_token: d.link_token,
        deep_link:
          !d.telegram_chat_id && d.link_token && botUsername
            ? `https://t.me/${botUsername}?start=${d.link_token}`
            : null,
      })),
    };
  });

const AddDriverSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
});

export const addDeliveryDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddDriverSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rid = await getOwnerRestaurantId(supabase, userId);
    const token = `drv_${randomBytes(10).toString("hex")}`;
    const { data: row, error } = await supabaseAdmin
      .from("delivery_drivers")
      .insert({
        restaurant_id: rid,
        display_name: data.display_name,
        link_token: token,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !row) throw _genericDbError(error);
    const { data: restRow } = await supabaseAdmin
      .from("restaurants")
      .select("telegram_bot_username")
      .eq("id", rid)
      .maybeSingle();
    let botUsername = (restRow as any)?.telegram_bot_username ?? "";
    if (!botUsername) {
      try { botUsername = await getBotUsername(); } catch { /* noop */ }
    }
    return {
      id: row.id,
      link_token: token,
      deep_link: botUsername ? `https://t.me/${botUsername}?start=${token}` : null,
    };
  });

const DriverIdSchema = z.object({ id: z.string().uuid() });

export const removeDeliveryDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DriverIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rid = await getOwnerRestaurantId(supabase, userId);
    const { error } = await supabaseAdmin
      .from("delivery_drivers")
      .delete()
      .eq("id", data.id)
      .eq("restaurant_id", rid);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const toggleDeliveryDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rid = await getOwnerRestaurantId(supabase, userId);
    const { error } = await supabaseAdmin
      .from("delivery_drivers")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .eq("restaurant_id", rid);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });
