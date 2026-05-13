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
  const computed = hashPin(pin, salt);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const PinSchema = z
  .object({ pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits") })
  .strict();

/** Owner: set or update the cashier PIN for their restaurant */
export const setCashierPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Confirm user owns a restaurant
    const { data: r, error: rErr } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (rErr || !r) throw new Error("لا يوجد مطعم لهذا المستخدم");
    const salt = randomBytes(16).toString("hex");
    const pin_hash = hashPin(data.pin, salt);
    // Upsert credentials (admin client bypasses RLS for write)
    const { error: upErr } = await supabaseAdmin
      .from("cashier_credentials")
      .upsert({ restaurant_id: r.id, pin_hash, pin_salt: salt, updated_at: new Date().toISOString() });
    if (upErr) throw _genericDbError(upErr);
    await supabaseAdmin
      .from("restaurants")
      .update({ cashier_enabled: true })
      .eq("id", r.id);
    return { ok: true };
  });

/** Owner: disable the cashier system entirely */
export const disableCashier = createServerFn({ method: "POST" })
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
    await supabaseAdmin.from("cashier_credentials").delete().eq("restaurant_id", r.id);
    await supabaseAdmin.from("cashier_sessions").delete().eq("restaurant_id", r.id);
    await supabaseAdmin.from("restaurants").update({ cashier_enabled: false }).eq("id", r.id);
    return { ok: true };
  });

/** Public: verify a PIN and issue a cashier session token */
export const verifyCashierPin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ restaurantId: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) })
      .strict()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { restaurantId, pin } = data;

    // Check lockout
    const { data: attempt } = await supabaseAdmin
      .from("cashier_login_attempts")
      .select("failed_count, locked_until")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
      const mins = Math.ceil(
        (new Date(attempt.locked_until).getTime() - Date.now()) / 60_000,
      );
      throw new Error(`تم قفل المحاولات. حاول بعد ${mins} دقيقة`);
    }

    const { data: cred } = await supabaseAdmin
      .from("cashier_credentials")
      .select("pin_hash, pin_salt")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (!cred) throw new Error("نظام الكاشير غير مفعّل لهذا المطعم");

    const ok = verifyPin(pin, cred.pin_salt, cred.pin_hash);
    if (!ok) {
      // increment failed attempts
      const failed = (attempt?.failed_count ?? 0) + 1;
      const lockUntil = failed >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      await supabaseAdmin.from("cashier_login_attempts").upsert({
        restaurant_id: restaurantId,
        failed_count: lockUntil ? 0 : failed,
        locked_until: lockUntil,
        updated_at: new Date().toISOString(),
      });
      throw new Error(lockUntil ? "محاولات كثيرة. تم القفل لـ 5 دقائق" : "رمز خاطئ");
    }

    // Reset attempts and issue token
    await supabaseAdmin.from("cashier_login_attempts").upsert({
      restaurant_id: restaurantId,
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    const { error: insErr } = await supabaseAdmin.from("cashier_sessions").insert({
      restaurant_id: restaurantId,
      token,
      expires_at: expiresAt,
    });
    if (insErr) throw new Error("فشل إنشاء الجلسة");

    // Fetch restaurant info
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

async function validateSession(token: string) {
  const { data: s } = await supabaseAdmin
    .from("cashier_sessions")
    .select("restaurant_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!s || s.revoked) throw new Error("الجلسة منتهية");
  if (new Date(s.expires_at) < new Date()) throw new Error("الجلسة منتهية");
  return s.restaurant_id as string;
}

/** Cashier: validate token + return restaurant info */
export const getCashierContext = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const restaurantId = await validateSession(data.token);
    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", restaurantId)
      .maybeSingle();
    return {
      restaurant: { id: restaurantId, name: rest?.name ?? "", logo_url: rest?.logo_url ?? null },
    };
  });

/** Cashier: lookup active orders by table number */
export const cashierLookupTable = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(10), tableNumber: z.coerce.number().int().min(1).max(9999) }).parse(d),
  )
  .handler(async ({ data }) => {
    const restaurantId = await validateSession(data.token);
    const { data: tbl } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("table_number", data.tableNumber)
      .maybeSingle();
    if (!tbl) return { orders: [] as Array<{ id: string; total: number; created_at: string; items: Array<{ name: string; qty: number; price: number }> }> };
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, total, created_at, status, daily_number")
      .eq("restaurant_id", restaurantId)
      .eq("table_id", tbl.id)
      .in("status", ["new", "preparing", "ready"])
      .order("created_at", { ascending: false });
    if (!orders || !orders.length) return { orders: [] };
    const ids = orders.map((o) => o.id);
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("order_id, name_snapshot, quantity, price_snapshot")
      .in("order_id", ids);
    const byOrder = new Map<string, Array<{ name: string; qty: number; price: number }>>();
    (items ?? []).forEach((it) => {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({
        name: it.name_snapshot,
        qty: Number(it.quantity),
        price: Number(it.price_snapshot),
      });
      byOrder.set(it.order_id, arr);
    });
    return {
      orders: orders.map((o) => ({
        id: o.id,
        total: Number(o.total),
        created_at: o.created_at,
        status: o.status,
        daily_number: o.daily_number ?? null,
        items: byOrder.get(o.id) ?? [],
      })),
    };
  });

/** Cashier: mark orders as paid */
export const cashierMarkPaid = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(10), orderIds: z.array(z.string().uuid()).min(1).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    const restaurantId = await validateSession(data.token);
    // Verify all orders belong to this restaurant and not already paid
    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .in("id", data.orderIds);
    if (error) throw _genericDbError(error);
    if (!rows || rows.length !== data.orderIds.length) throw new Error("طلبات غير موجودة");
    for (const o of rows) {
      if (o.restaurant_id !== restaurantId) throw new Error("طلب خارج المطعم");
      if (o.status === "paid") throw new Error("الطلب مدفوع مسبقاً");
    }
    const now = new Date();
    const reviewDue = new Date(now.getTime() + 35 * 60_000).toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        served_at: now.toISOString(),
        review_due_at: reviewDue,
      })
      .in("id", data.orderIds);
    if (upErr) throw _genericDbError(upErr);
    return { ok: true };
  });

/** Cashier: revoke own session */
export const cashierLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("cashier_sessions")
      .update({ revoked: true })
      .eq("token", data.token);
    return { ok: true };
  });

/** Cashier: list all ready orders (waiting to be paid) for this restaurant */
export const cashierListReady = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const restaurantId = await validateSession(data.token);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, total, created_at, status, table_id, daily_number, order_type, customer_name, customer_phone")
      .eq("restaurant_id", restaurantId)
      .eq("status", "ready")
      .in("order_type", ["dine_in", "takeaway"])
      .order("created_at", { ascending: true });
    if (!orders || !orders.length) return { orders: [] as Array<{ id: string; total: number; created_at: string; table_number: number | null; daily_number: number | null; order_type: string; customer_name: string | null; customer_phone: string | null; items: Array<{ name: string; qty: number; price: number }> }> };
    const ids = orders.map((o) => o.id);
    const tableIds = Array.from(new Set(orders.map((o) => o.table_id).filter(Boolean))) as string[];
    const [{ data: items }, { data: tbls }] = await Promise.all([
      supabaseAdmin
        .from("order_items")
        .select("order_id, name_snapshot, quantity, price_snapshot")
        .in("order_id", ids),
      tableIds.length
        ? supabaseAdmin.from("tables").select("id, table_number").in("id", tableIds)
        : Promise.resolve({ data: [] as Array<{ id: string; table_number: number }> }),
    ]);
    const byOrder = new Map<string, Array<{ name: string; qty: number; price: number }>>();
    (items ?? []).forEach((it) => {
      const arr = byOrder.get(it.order_id) ?? [];
      arr.push({ name: it.name_snapshot, qty: Number(it.quantity), price: Number(it.price_snapshot) });
      byOrder.set(it.order_id, arr);
    });
    const tableMap = new Map<string, number>();
    (tbls ?? []).forEach((t) => tableMap.set(t.id, Number(t.table_number)));
    return {
      orders: orders.map((o) => ({
        id: o.id,
        total: Number(o.total),
        created_at: o.created_at,
        table_number: o.table_id ? tableMap.get(o.table_id) ?? null : null,
        daily_number: o.daily_number ?? null,
        order_type: (o as { order_type: string | null }).order_type ?? "dine_in",
        customer_name: (o as { customer_name: string | null }).customer_name ?? null,
        customer_phone: (o as { customer_phone: string | null }).customer_phone ?? null,
        items: byOrder.get(o.id) ?? [],
      })),
    };
  });

/** Owner: check whether their restaurant has cashier enabled */
export const getCashierStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: r } = await supabase
      .from("restaurants")
      .select("id, cashier_enabled")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return { restaurantId: r?.id ?? null, enabled: r?.cashier_enabled ?? false };
  });

export const getPublicCashierLoginInfo = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: r } = await supabaseAdmin
      .from("restaurants")
      .select("name, cashier_enabled")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!r) return { found: false as const, name: "", enabled: false };
    return { found: true as const, name: r.name as string, enabled: !!r.cashier_enabled };
  });