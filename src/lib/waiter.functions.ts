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

// ─── Admin: manage waiter accounts ────────────────────────────────────────

export const listWaiters = createServerFn({ method: "GET" })
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
    if (!r) return { waiters: [] };
    const { data } = await supabaseAdmin
      .from("waiter_credentials")
      .select("id, name, is_active, employee_id, created_at")
      .eq("restaurant_id", r.id)
      .order("created_at", { ascending: true });
    return { waiters: data ?? [] };
  });

export const addWaiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ name: z.string().min(1).max(60), pin: z.string().regex(/^\d{4,6}$/) }).parse(d),
  )
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
    const { data: waiter, error } = await supabaseAdmin
      .from("waiter_credentials")
      .insert({ restaurant_id: r.id, name: data.name, pin_hash, pin_salt: salt })
      .select("id, name, is_active")
      .single();
    if (error) throw _genericDbError(error);
    return { waiter };
  });

export const updateWaiterPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ waiterId: z.string().uuid(), pin: z.string().regex(/^\d{4,6}$/) }).parse(d),
  )
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
      .from("waiter_credentials")
      .update({ pin_hash, pin_salt: salt })
      .eq("id", data.waiterId)
      .eq("restaurant_id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const toggleWaiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ waiterId: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
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
    const { error } = await supabaseAdmin
      .from("waiter_credentials")
      .update({ is_active: data.is_active })
      .eq("id", data.waiterId)
      .eq("restaurant_id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const deleteWaiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ waiterId: z.string().uuid() }).parse(d))
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
    await supabaseAdmin.from("waiter_sessions").delete().eq("waiter_credential_id", data.waiterId);
    const { error } = await supabaseAdmin
      .from("waiter_credentials")
      .delete()
      .eq("id", data.waiterId)
      .eq("restaurant_id", r.id);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

// ─── Public: login flow ────────────────────────────────────────────────────

export const getPublicWaiterList = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ restaurantId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: r } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", data.restaurantId)
      .maybeSingle();
    if (!r) return { found: false as const, name: "", logo_url: null, waiters: [] };
    const { data: waiters } = await supabaseAdmin
      .from("waiter_credentials")
      .select("id, name")
      .eq("restaurant_id", data.restaurantId)
      .eq("is_active", true)
      .order("name");
    return {
      found: true as const,
      name: r.name as string,
      logo_url: r.logo_url as string | null,
      waiters: (waiters ?? []).map((w) => ({ id: w.id, name: w.name })),
    };
  });

export const verifyWaiterPin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ waiterId: z.string().uuid(), pin: z.string().regex(/^\d{4,6}$/) })
      .strict()
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { waiterId, pin } = data;

    const { data: attempt } = await supabaseAdmin
      .from("staff_login_attempts")
      .select("failed_count, locked_until")
      .eq("staff_id", waiterId)
      .eq("staff_type", "waiter")
      .maybeSingle();

    if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 60_000);
      throw new Error(`تم قفل المحاولات. حاول بعد ${mins} دقيقة`);
    }

    const { data: cred } = await supabaseAdmin
      .from("waiter_credentials")
      .select("pin_hash, pin_salt, restaurant_id, name, is_active")
      .eq("id", waiterId)
      .maybeSingle();

    if (!cred || !cred.is_active) throw new Error("الحساب غير موجود أو موقوف");

    const ok = verifyPin(pin, cred.pin_salt, cred.pin_hash);
    if (!ok) {
      const failed = (attempt?.failed_count ?? 0) + 1;
      const lockUntil = failed >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      await supabaseAdmin.from("staff_login_attempts").upsert({
        staff_id: waiterId,
        staff_type: "waiter",
        failed_count: lockUntil ? 0 : failed,
        locked_until: lockUntil,
        updated_at: new Date().toISOString(),
      });
      throw new Error(lockUntil ? "محاولات كثيرة. تم القفل لـ 5 دقائق" : "رمز خاطئ");
    }

    await supabaseAdmin.from("staff_login_attempts").upsert({
      staff_id: waiterId,
      staff_type: "waiter",
      failed_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("waiter_sessions").insert({
      waiter_credential_id: waiterId,
      restaurant_id: cred.restaurant_id,
      token,
      expires_at: expiresAt,
    });
    if (error) throw new Error("فشل إنشاء الجلسة");

    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("name, logo_url")
      .eq("id", cred.restaurant_id)
      .maybeSingle();

    return {
      token,
      expiresAt,
      waiterName: cred.name as string,
      waiterId,
      restaurant: {
        id: cred.restaurant_id as string,
        name: rest?.name ?? "",
        logo_url: rest?.logo_url ?? null,
      },
    };
  });

// ─── Session validation ────────────────────────────────────────────────────

async function validateWaiterSession(token: string) {
  const { data: s } = await supabaseAdmin
    .from("waiter_sessions")
    .select("restaurant_id, waiter_credential_id, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (!s || s.revoked) throw new Error("الجلسة منتهية");
  if (new Date(s.expires_at) < new Date()) throw new Error("الجلسة منتهية");
  return {
    restaurantId: s.restaurant_id as string,
    waiterCredentialId: s.waiter_credential_id as string,
  };
}

export const getWaiterContext = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { restaurantId, waiterCredentialId } = await validateWaiterSession(data.token);
    const [{ data: rest }, { data: waiter }] = await Promise.all([
      supabaseAdmin.from("restaurants").select("name, logo_url").eq("id", restaurantId).maybeSingle(),
      supabaseAdmin.from("waiter_credentials").select("name").eq("id", waiterCredentialId).maybeSingle(),
    ]);
    return {
      waiterName: waiter?.name ?? "",
      waiterId: waiterCredentialId,
      restaurant: { id: restaurantId, name: rest?.name ?? "", logo_url: rest?.logo_url ?? null },
    };
  });

export const waiterLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("waiter_sessions")
      .update({ revoked: true })
      .eq("token", data.token);
    return { ok: true };
  });

// ─── Waiter order actions ──────────────────────────────────────────────────

export const waiterListReadyOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { restaurantId, waiterCredentialId } = await validateWaiterSession(data.token);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select(
        "id, total, created_at, status, table_id, order_type, customer_name, daily_number, assigned_waiter_id, notes",
      )
      .eq("restaurant_id", restaurantId)
      .in("status", ["ready", "preparing", "new"])
      .order("created_at", { ascending: true });
    if (!orders?.length) return { orders: [] };
    const tableIds = Array.from(new Set(orders.map((o) => o.table_id).filter(Boolean))) as string[];
    const { data: tbls } = tableIds.length
      ? await supabaseAdmin.from("tables").select("id, table_number").in("id", tableIds)
      : { data: [] as Array<{ id: string; table_number: number }> };
    const tableMap = new Map<string, number>();
    (tbls ?? []).forEach((t) => tableMap.set(t.id, Number(t.table_number)));
    return {
      orders: orders.map((o) => ({
        id: o.id,
        total: o.total,
        status: o.status,
        created_at: o.created_at,
        order_type: o.order_type ?? "dine_in",
        customer_name: o.customer_name ?? null,
        daily_number: o.daily_number ?? null,
        notes: o.notes ?? null,
        table_number: o.table_id ? (tableMap.get(o.table_id) ?? null) : null,
        is_mine: o.assigned_waiter_id === waiterCredentialId,
      })),
      waiterId: waiterCredentialId,
    };
  });

export const waiterClaimOrder = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(10), orderId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { restaurantId, waiterCredentialId } = await validateWaiterSession(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o || o.restaurant_id !== restaurantId) throw new Error("طلب غير موجود");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ assigned_waiter_id: waiterCredentialId })
      .eq("id", data.orderId);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });

export const waiterMarkServed = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(10), orderId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { restaurantId, waiterCredentialId } = await validateWaiterSession(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, restaurant_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o || o.restaurant_id !== restaurantId) throw new Error("طلب غير موجود");
    if (o.status !== "ready") throw new Error("الطلب غير جاهز بعد");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", assigned_waiter_id: waiterCredentialId, served_at: new Date().toISOString() })
      .eq("id", data.orderId);
    if (error) throw _genericDbError(error);
    return { ok: true };
  });
