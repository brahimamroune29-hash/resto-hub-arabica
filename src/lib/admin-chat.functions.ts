import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "user" | "assistant"; content: string };

async function resolveRestaurantId(supabase: any, userId: string): Promise<string | null> {
  const { data: own } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (own && own.length > 0) return own[0].id;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("restaurant_id")
    .eq("user_id", userId)
    .limit(1);
  return roles?.[0]?.restaurant_id ?? null;
}

async function buildAdminContext(supabase: any, restaurantId: string) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const todayStr = today.toISOString().slice(0, 10);
  const fetchSinceIso = monthStart.toISOString();
  const fetchSinceDate = monthStart.toISOString().slice(0, 10);

  const [
    restRes,
    ordersAll,
    recentOrdersRes,
    items,
    categoriesRes,
    ingredients,
    expensesMonth,
    complaintsRes,
    recentComplaintsRes,
    employeesRes,
    customersRes,
    tablesRes,
    reviewsRes,
    suppliersRes,
    wasteRes,
    deductionsRes,
    salaryPaymentsRes,
    notificationsRes,
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select(
        "name, menu_theme, brand_color, tagline, whatsapp_number, instagram_url, facebook_url, google_maps_review_url, telegram_chat_id, delivery_enabled, takeaway_enabled, chef_enabled, cashier_enabled, splash_enabled, daily_summary_enabled, setup_completed",
      )
      .eq("id", restaurantId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, total, status, created_at, order_type")
      .eq("restaurant_id", restaurantId)
      .eq("status", "paid")
      .gte("created_at", fetchSinceIso)
      .limit(5000),
    supabase
      .from("orders")
      .select("id, daily_number, total, status, order_type, customer_name, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("menu_items")
      .select("id, name, price, is_available, category_id")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("categories")
      .select("id, name, display_order")
      .eq("restaurant_id", restaurantId)
      .order("display_order", { ascending: true }),
    supabase
      .from("ingredients")
      .select("name, current_stock, alert_threshold, unit")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("expenses")
      .select("amount, category, date")
      .eq("restaurant_id", restaurantId)
      .gte("date", fetchSinceDate),
    supabase
      .from("complaints")
      .select("status, created_at, type")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", fetchSinceIso),
    supabase
      .from("complaints")
      .select("type, description, status, customer_name, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("employees")
      .select("name, role, base_salary, is_active, salary_type")
      .eq("restaurant_id", restaurantId),
    supabase
      .from("customers")
      .select("name, total_spent, total_visits, last_visit_at")
      .eq("restaurant_id", restaurantId)
      .order("total_spent", { ascending: false })
      .limit(10),
    supabase.from("tables").select("table_number").eq("restaurant_id", restaurantId),
    supabase
      .from("reviews")
      .select("rating, comment, created_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("suppliers").select("name, phone").eq("restaurant_id", restaurantId),
    supabase
      .from("waste_logs")
      .select("quantity, cost, reason, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", fetchSinceIso),
    supabase
      .from("employee_deductions")
      .select("amount, type, label, date")
      .eq("restaurant_id", restaurantId)
      .gte("date", fetchSinceDate),
    supabase
      .from("employee_salary_payments")
      .select("net_salary, month, paid_at")
      .eq("restaurant_id", restaurantId)
      .order("paid_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("kind, title, body, created_at, read_at")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const allPaid = (ordersAll.data ?? []).map((o: any) => ({
    ...o,
    _date: new Date(o.created_at as string),
  }));
  const inRange = (d: Date, start: Date, end: Date) =>
    d.getTime() >= start.getTime() && d.getTime() < end.getTime();

  const todayOrders = allPaid.filter((o: any) => inRange(o._date, today, tomorrow));
  const ow = allPaid.filter((o: any) => inRange(o._date, weekStart, tomorrow));
  const om = allPaid.filter((o: any) => inRange(o._date, monthStart, tomorrow));
  const sum = (arr: any[]) => arr.reduce((s, o) => s + Number(o.total ?? 0), 0);

  const orderIds = ow.map((o: any) => o.id);
  let topItems: { name: string; qty: number; revenue: number }[] = [];
  if (orderIds.length) {
    const { data: oi } = await supabase
      .from("order_items")
      .select("name_snapshot, price_snapshot, quantity, order_id")
      .in("order_id", orderIds);
    const map = new Map<string, { qty: number; revenue: number }>();
    (oi ?? []).forEach((r: any) => {
      const k = r.name_snapshot ?? "؟";
      const cur = map.get(k) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(r.quantity ?? 0);
      cur.revenue += Number(r.quantity ?? 0) * Number(r.price_snapshot ?? 0);
      map.set(k, cur);
    });
    topItems = [...map.entries()]
      .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }

  const lowStock = (ingredients.data ?? []).filter(
    (i: any) => Number(i.current_stock ?? 0) <= Number(i.alert_threshold ?? 0),
  );

  const reviews = reviewsRes.data ?? [];
  const avgRating = reviews.length
    ? reviews.reduce((s: number, r: any) => s + Number(r.rating ?? 0), 0) / reviews.length
    : null;
  const ratingDist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  reviews.forEach((r: any) => {
    const k = String(r.rating);
    if (ratingDist[k] !== undefined) ratingDist[k]++;
  });

  const orderTypeBreakdown = ow.reduce(
    (acc: Record<string, { count: number; revenue: number }>, o: any) => {
      const k = o.order_type ?? "dine_in";
      acc[k] = acc[k] ?? { count: 0, revenue: 0 };
      acc[k].count++;
      acc[k].revenue += Number(o.total ?? 0);
      return acc;
    },
    {},
  );

  const wasteTotal = (wasteRes.data ?? []).reduce((s: number, w: any) => s + Number(w.cost ?? 0), 0);
  const deductionsTotal = (deductionsRes.data ?? []).reduce(
    (s: number, d: any) => s + Number(d.amount ?? 0),
    0,
  );
  const r = restRes.data ?? ({} as any);

  return JSON.stringify(
    {
      restaurant: {
        name: r.name ?? "المطعم",
        currency: "DZD",
        tagline: r.tagline,
        menu_theme: r.menu_theme,
        brand_color: r.brand_color,
        contact: {
          whatsapp: r.whatsapp_number,
          instagram: r.instagram_url,
          facebook: r.facebook_url,
          google_review_url: r.google_maps_review_url,
        },
        features_enabled: {
          delivery: r.delivery_enabled,
          takeaway: r.takeaway_enabled,
          chef_screen: r.chef_enabled,
          cashier_screen: r.cashier_enabled,
          splash: r.splash_enabled,
          telegram_summary: !!r.telegram_chat_id,
          daily_summary: r.daily_summary_enabled,
        },
        setup_completed: r.setup_completed,
      },
      date_today: todayStr,
      note_for_assistant:
        "كل أرقام المبيعات أدناه تحسب فقط الطلبات المدفوعة (status=paid)، نفس ما تحسبه لوحة التحكم.",
      sales: {
        today_orders_count: todayOrders.length,
        today_revenue: sum(todayOrders),
        this_week_orders: ow.length,
        this_week_revenue: sum(ow),
        this_month_orders: om.length,
        this_month_revenue: sum(om),
        this_week_by_order_type: orderTypeBreakdown,
        avg_order_value_this_week: ow.length ? sum(ow) / ow.length : 0,
      },
      recent_orders: (recentOrdersRes.data ?? []).map((o: any) => ({
        n: o.daily_number,
        total: Number(o.total ?? 0),
        status: o.status,
        type: o.order_type,
        customer: o.customer_name,
        at: o.created_at,
      })),
      top_selling_items_last_7_days: topItems,
      menu: {
        total_items: (items.data ?? []).length,
        unavailable_items: (items.data ?? []).filter((i: any) => !i.is_available).map((i: any) => i.name),
        categories: (categoriesRes.data ?? []).map((c: any) => c.name),
        avg_price: (items.data ?? []).length
          ? (items.data ?? []).reduce((s: number, i: any) => s + Number(i.price ?? 0), 0) /
            (items.data ?? []).length
          : 0,
      },
      tables: {
        count: (tablesRes.data ?? []).length,
        numbers: (tablesRes.data ?? []).map((t: any) => t.table_number),
      },
      inventory: {
        total_ingredients: (ingredients.data ?? []).length,
        low_stock: lowStock.map((i: any) => ({
          name: i.name,
          current: Number(i.current_stock ?? 0),
          threshold: Number(i.alert_threshold ?? 0),
          unit: i.unit,
        })),
        waste_cost_this_month: wasteTotal,
      },
      suppliers: (suppliersRes.data ?? []).map((s: any) => ({ name: s.name, phone: s.phone })),
      expenses_this_month: {
        total: (expensesMonth.data ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0),
        by_category: Object.entries(
          (expensesMonth.data ?? []).reduce((acc: Record<string, number>, e: any) => {
            const k = e.category ?? "أخرى";
            acc[k] = (acc[k] ?? 0) + Number(e.amount ?? 0);
            return acc;
          }, {}),
        ).map(([category, total]) => ({ category, total })),
      },
      complaints_this_month: {
        total: (complaintsRes.data ?? []).length,
        open: (complaintsRes.data ?? []).filter((c: any) => c.status !== "resolved").length,
        recent: (recentComplaintsRes.data ?? []).map((c: any) => ({
          type: c.type,
          status: c.status,
          customer: c.customer_name,
          description: (c.description ?? "").slice(0, 200),
          at: c.created_at,
        })),
      },
      reviews: {
        total: reviews.length,
        average_rating: avgRating,
        distribution: ratingDist,
        latest: reviews.slice(0, 5).map((rv: any) => ({
          rating: rv.rating,
          comment: (rv.comment ?? "").slice(0, 200),
          at: rv.created_at,
        })),
      },
      employees: {
        active: (employeesRes.data ?? []).filter((e: any) => e.is_active).length,
        list: (employeesRes.data ?? []).map((e: any) => ({
          name: e.name,
          role: e.role,
          salary_type: e.salary_type,
          base_salary: Number(e.base_salary ?? 0),
          active: e.is_active,
        })),
        total_monthly_salaries: (employeesRes.data ?? [])
          .filter((e: any) => e.is_active)
          .reduce((s: number, e: any) => s + Number(e.base_salary ?? 0), 0),
        deductions_this_month: deductionsTotal,
        recent_salary_payments: (salaryPaymentsRes.data ?? []).slice(0, 10).map((p: any) => ({
          month: p.month,
          net: Number(p.net_salary ?? 0),
          at: p.paid_at,
        })),
      },
      top_customers: (customersRes.data ?? []).map((c: any) => ({
        name: c.name,
        total_spent: Number(c.total_spent ?? 0),
        visits: Number(c.total_visits ?? 0),
        last_visit: c.last_visit_at,
      })),
      notifications_recent: (notificationsRes.data ?? []).map((n: any) => ({
        kind: n.kind,
        title: n.title,
        body: n.body,
        unread: !n.read_at,
        at: n.created_at,
      })),
    },
    null,
    2,
  );
}

export const askAdminBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(4000),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("الخدمة غير متاحة حالياً");

    const { supabase, userId } = context as { supabase: any; userId: string };
    const restaurantId = await resolveRestaurantId(supabase, userId);
    if (!restaurantId) throw new Error("لم يتم العثور على مطعم لحسابك");

    const ctx = await buildAdminContext(supabase, restaurantId);

    const systemPrompt = `أنت "المساعد الذكي" لإدارة المطعم. عندك وصول كامل لكل بيانات المطعم: المبيعات، الطلبات، المنيو والفئات، المخزون والموردين، الطاولات، الزبائن، الموظفين والرواتب والاستقطاعات، المصاريف، الشكاوى، التقييمات (نجوم + تعليقات)، الإشعارات، وإعدادات المطعم (delivery، takeaway، تليغرام، QR، splash...).

أسلوبك:
- اللهجة عربية بسيطة (جزائرية مفهومة).
- إجابات قصيرة، مباشرة، مع أرقام واضحة.
- استخدم رمز "دج" للعملة.
- جاوب على أي سؤال يخص المطعم بالاعتماد على البيانات أدناه (مبيعات، منيو، طاولات، تقييمات، شكاوى، عمليات، إعدادات...).
- إذا سُئلت عن نصيحة (ايش أضبط، كيف أزيد الأرباح، علاش التقييمات ضعيفة...)، أعطِ 2-4 اقتراحات عملية مبنية على الأرقام.
- لا تخترع أرقاماً أو معلومات غير موجودة. إذا البيانات ناقصة قل ذلك بصراحة واقترح من فين يضبطها (مثلا: "زيد طاولات من الإعدادات > الطاولات").
- إذا سُئلت عن ميزة مفعّلة أو لا (delivery, takeaway, تليغرام...) ارجع لـ features_enabled.
- تجنب Markdown المفرط، نقاط بسيطة فقط عند الحاجة.

بيانات المطعم الحالية (snapshot كامل):
\`\`\`json
${ctx}
\`\`\``;

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m: ChatMsg) => ({ role: m.role, content: m.content })),
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (res.status === 429) throw new Error("الكثير من الطلبات، حاول بعد قليل");
    if (res.status === 402) throw new Error("الخدمة غير متاحة مؤقتاً");
    if (!res.ok) {
      const t = await res.text();
      console.error("[admin-chat] gateway error", res.status, t);
      throw new Error("تعذّر الاتصال بالمساعد");
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "آسف، ما فهمتك";
    return { reply };
  });
