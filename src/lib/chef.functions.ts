import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { _genericDbError } from "./_errors.server";
function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 64).toString("hex");
}
function verifyPin(pin: string, salt: string, hash: string) {
  const a = Buffer.from(hashPin(pin, salt), "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const PinSchema = z.object({ pin: z.string().regex(/^\d{4}$/) }).strict();

export const setChefPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");
    const salt = randomBytes(16).toString("hex");
    const pin_hash = hashPin(data.pin, salt);
    const { error } = await supabaseAdmin
      .from("chef_credentials")
      .upsert({ restaurant_id: r.id, pin_hash, pin_salt: salt, updated_at: new Date().toISOString() });
    if (error) throw _genericDbError(error);
    await supabaseAdmin.from("restaurants").update({ chef_enabled: true }).eq("id", r.id);
    return { ok: true };
  });

export const disableChef = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!r) throw new Error("لا يوجد مطعم");
    await supabaseAdmin.from("chef_credentials").delete().eq("restaurant_id", r.id);
    await supabaseAdmin.from("chef_sessions").delete().eq("restaurant_id", r.id);
    await supabaseAdmin.from("restaurants").update({ chef_enabled: false }).eq("id", r.id);
    return { ok: true };
  });

export const getChefStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id, chef_enabled")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return { restaurantId: r?.id ?? null, enabled: r?.chef_enabled ?? false };
  });

export const getPublicChefLoginInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: r } = await supabaseAdmin
      .from("restaurants")
      .select("name, chef_enabled")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!r) return { found: false as const, name: "", enabled: false };
    return { found: true as const, name: r.name as string, enabled: !!r.chef_enabled };
  });

export const verifyChefPin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ restaurantId: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) }).strict().parse(d),
  )
  .handler(async ({ data }) => {
    const { restaurantId, pin } = data;
    const { data: attempt } = await supabaseAdmin
      .from("chef_login_attempts")
      .select("failed_count, locked_until")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60_000);
      throw new Error(`تم قفل المحاولات. حاول بعد ${mins} دقيقة`);
    }
    const { data: cred } = await supabaseAdmin
      .from("chef_credentials")
      .select("pin_hash, pin_salt")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!cred) throw new Error("نظام المطبخ غير مفعّل");
    const ok = verifyPin(pin, cred.pin_salt, cred.pin_hash);
    if (!ok) {
      const failed = (attempt?.failed_count ?? 0) + 1;
      const lockUntil = failed >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      await supabaseAdmin.from("chef_login_attempts").upsert({
        restaurant_id: restaurantId,
        failed_count: lockUntil ? 0 : failed,
        locked_until: lockUntil,
        updated_at: new Date().toISOString(),
      });
      throw new Error(lockUntil ? "محاولات كثيرة. تم القفل لـ 5 دقائق" : "رمز خاطئ");
    }
    await supabaseAdmin.from("chef_login_attempts").upsert({
      restaurant_id: restaurantId,
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("chef_sessions")
      .insert({ restaurant_id: restaurantId, token, expires_at: expiresAt });
    if (error) throw new Error("فشل إنشاء الجلسة");
    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", restaurantId)
      .maybeSingle();
    return {
      token,
      expiresAt,
      restaurant: { id: restaurantId, name: rest?.name ?? "", logo_url: rest?.logo_url ?? null },
    };
  });

async function validateChefSession(token: string) {
  const { data: s } = await supabaseAdmin
    .from("chef_sessions")
    .select("restaurant_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!s || s.revoked) throw new Error("الجلسة منتهية");
  if (new Date(s.expires_at) < new Date()) throw new Error("الجلسة منتهية");
  return s.restaurant_id as string;
}

export const getChefContext = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const restaurantId = await validateChefSession(data.token);
    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", restaurantId)
      .maybeSingle();
    return {
      restaurant: { id: restaurantId, name: rest?.name ?? "", logo_url: rest?.logo_url ?? null },
    };
  });

export const chefListActive = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const restaurantId = await validateChefSession(data.token);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, total, created_at, status, table_id, acknowledged, notes, order_type, customer_name, customer_phone, customer_address, daily_number")
      .eq("restaurant_id", restaurantId)
      .in("status", ["new", "preparing"])
      .order("created_at", { ascending: true });
    if (!orders || !orders.length) return { orders: [] as Array<{ id: string; status: string; created_at: string; acknowledged: boolean; table_number: number | null; notes: string | null; order_type: string; customer_name: string | null; customer_phone: string | null; customer_address: string | null; daily_number: number | null; items: Array<{ name: string; qty: number }> }> };
    const ids = orders.map((o) => o.id);
    const tableIds = Array.from(new Set(orders.map((o) => o.table_id).filter(Boolean))) as string[];
    const [{ data: items }, { data: tbls }] = await Promise.all([
      supabaseAdmin
        .from("order_items")
        .select("order_id, name_snapshot, quantity")
        .in("order_id", ids),
      tableIds.length
        ? supabaseAdmin.from("tables").select("id, table_number").in("id", tableIds)
        : Promise.resolve({ data: [] as Array<{ id: string; table_number: number }> }),
    ]);
    const byOrder = new Map<string, Array<{ name: string; qty: number }>>();
    (items ?? []).forEach((it) => {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({ name: it.name_snapshot, qty: Number(it.quantity) });
      byOrder.set(it.order_id, arr);
    });
    const tableMap = new Map<string, number>();
    (tbls ?? []).forEach((t) => tableMap.set(t.id, Number(t.table_number)));
    return {
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status as string,
        created_at: o.created_at,
        acknowledged: !!o.acknowledged,
        table_number: o.table_id ? tableMap.get(o.table_id) ?? null : null,
        notes: (o as { notes: string | null }).notes ?? null,
        order_type: (o as { order_type: string | null }).order_type ?? "dine_in",
        customer_name: (o as { customer_name: string | null }).customer_name ?? null,
        customer_phone: (o as { customer_phone: string | null }).customer_phone ?? null,
        customer_address: (o as { customer_address: string | null }).customer_address ?? null,
        daily_number: (o as { daily_number: number | null }).daily_number ?? null,
        items: byOrder.get(o.id) ?? [],
      })),
    };
  });

export const chefStartPreparing = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10), orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const restaurantId = await validateChefSession(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o || o.restaurant_id !== restaurantId) throw new Error("طلب غير موجود");
    if (o.status !== "new") throw new Error("الطلب ليس جديداً");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "preparing", acknowledged: true })
      .eq("id", data.orderId);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const chefMarkReady = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10), orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const restaurantId = await validateChefSession(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o || o.restaurant_id !== restaurantId) throw new Error("طلب غير موجود");
    if (o.status !== "preparing") throw new Error("الطلب ليس قيد التحضير");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "ready" })
      .eq("id", data.orderId);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const chefLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("chef_sessions").update({ revoked: true }).eq("token", data.token);
    return { ok: true };
  });