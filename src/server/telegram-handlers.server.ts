import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  answerCallbackQuery,
  editTelegramMessageText,
  sendTelegramMessage,
  type InlineKeyboard,
} from "./telegram.server";

function extractLinkToken(text: string): string | null {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  if (parts[0] === "/start" && parts[1]) return parts[1].trim();
  if (/^(drv|lk)_[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Telegram update dispatcher. Used by both the shared-bot webhook and
 * the per-restaurant webhook. The `botToken` param controls which bot is
 * used to reply / edit messages. When undefined, the shared connector bot
 * is used.
 *
 * `restaurantScopeId` (when provided) restricts driver/owner link tokens
 * to that single restaurant — i.e. a custom restaurant bot will only
 * accept link tokens belonging to that restaurant.
 */
export async function dispatchTelegramUpdate(
  update: any,
  opts: { botToken?: string | null; restaurantScopeId?: string | null } = {},
) {
  const botToken = opts.botToken ?? null;
  const scopeId = opts.restaurantScopeId ?? null;

  const cb = update.callback_query;
  if (cb) {
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const fromUsername = cb.from?.username ?? "";
    const dataStr = String(cb.data ?? "");
    if (!chatId || !messageId) {
      await answerCallbackQuery(cb.id, "تعذّر معالجة الإجراء", false, { botToken });
      return;
    }
    const [action, orderId] = dataStr.split(":");
    try {
      if (action === "claim" && orderId) {
        await handleClaim(orderId, chatId, fromUsername, cb.id, messageId, botToken);
      } else if (action === "paid" && orderId) {
        await handlePaid(orderId, chatId, cb.id, messageId, botToken);
      } else if (action === "pending" && orderId) {
        await handlePending(orderId, chatId, cb.id, messageId, botToken);
      } else if (action === "cancel" && orderId) {
        await handleCancel(orderId, chatId, cb.id, messageId, botToken);
      } else {
        await answerCallbackQuery(cb.id, undefined, false, { botToken });
      }
    } catch (err) {
      console.error("[telegram callback]", err);
      await answerCallbackQuery(cb.id, "حدث خطأ", false, { botToken });
    }
    return;
  }

  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  const text: string = msg?.text?.trim() ?? "";
  if (!chatId) return;

  if (text.startsWith("/start") || /^(drv|lk)_[A-Za-z0-9_-]+$/.test(text)) {
    await handleStart(text, chatId, msg.from, botToken, scopeId);
    return;
  }
  if (text) {
    await sendTelegramMessage(
      chatId,
      "🤖 هذا البوت يرسل إشعارات طلبات التوصيل فقط.",
      { botToken },
    );
  }
}

async function handleStart(
  text: string,
  chatId: number,
  from: any,
  botToken: string | null,
  scopeId: string | null,
) {
  const token = extractLinkToken(text);
  const username = from?.username ?? from?.first_name ?? "Unknown";
  console.log("[telegram/start]", { chatId, username, rawText: text, token, scopeId });

  if (!token) {
    await sendTelegramMessage(
      chatId,
      "👋 أهلاً! يبدو أن الرابط وصل بدون كود الربط. افتح الرابط الكامل من الإعدادات أو أرسل كود الربط الذي يبدأ بـ <b>drv_</b> هنا.",
      { botToken },
    );
    return;
  }

  if (token.startsWith("drv_")) {
    const q = supabaseAdmin
      .from("delivery_drivers")
      .select("id, restaurant_id, display_name")
      .eq("link_token", token);
    const { data: driver } = await q.maybeSingle();
    if (!driver) {
      const { data: existing } = await supabaseAdmin
        .from("delivery_drivers")
        .select("display_name, restaurant_id")
        .eq("telegram_chat_id", chatId)
        .maybeSingle();
      if (existing) {
        const { data: rest } = await supabaseAdmin
          .from("restaurants")
          .select("name")
          .eq("id", existing.restaurant_id)
          .maybeSingle();
        await sendTelegramMessage(
          chatId,
          `✅ أنت مربوط مسبقاً مع <b>${rest?.name ?? "المطعم"}</b> باسم <b>${existing.display_name}</b>.\nستصلك إشعارات الطلبات تلقائياً.`,
          { botToken },
        );
        return;
      }
      await sendTelegramMessage(
        chatId,
        `❌ رابط الربط غير صالح.\n\nالكود المستلم:\n<code>${token}</code>\n\nاطلب من مالك المطعم توليد رابط جديد من الإعدادات وتأكد من نسخ الكود كاملاً.`,
        { botToken },
      );
      return;
    }
    await supabaseAdmin
      .from("delivery_drivers")
      .update({ telegram_chat_id: chatId, telegram_username: username })
      .eq("id", driver.id);
    const { data: rest } = await supabaseAdmin
      .from("restaurants")
      .select("name")
      .eq("id", driver.restaurant_id)
      .maybeSingle();
    await sendTelegramMessage(
      chatId,
      `✅ تم الربط بنجاح!\n\n🏷️ <b>${rest?.name ?? "المطعم"}</b>\n👤 ${driver.display_name}\n\nستصلك إشعارات طلبات التوصيل، اضغط «استلام الطلب» لتأكيد توصيلك له.`,
      { botToken },
    );
    return;
  }

  // Owner linking
  const oq = supabaseAdmin
    .from("restaurants")
    .select("id, name")
    .eq("telegram_link_token", token);
  const { data: rest } = await oq.maybeSingle();
  if (!rest) {
    await sendTelegramMessage(
      chatId,
      `❌ رابط الربط غير صالح أو تم استخدامه.\n\nالكود المستلم:\n<code>${token}</code>\n\nالرجاء توليد رابط جديد من الإعدادات.`,
      { botToken },
    );
    return;
  }
  await supabaseAdmin
    .from("restaurants")
    .update({
      telegram_chat_id: chatId,
      telegram_username: username,
      telegram_link_token: null,
    })
    .eq("id", rest.id);
  await sendTelegramMessage(
    chatId,
    `✅ تم الربط بنجاح مع <b>${rest.name}</b>!\n\nسأرسل لك إشعارًا فوريًا عند كل طلب توصيل جديد.`,
    { botToken },
  );
}

async function handleClaim(
  orderId: string,
  chatId: number,
  fromUsername: string,
  callbackId: string,
  messageId: number,
  botToken: string | null,
) {
  const { data: claimed } = await supabaseAdmin
    .from("orders")
    .update({ assigned_driver_chat_id: chatId })
    .eq("id", orderId)
    .is("assigned_driver_chat_id", null)
    .select("id, restaurant_id, total, customer_name, customer_phone, customer_address, notes")
    .maybeSingle();

  if (!claimed) {
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("assigned_driver_chat_id, restaurant_id")
      .eq("id", orderId)
      .maybeSingle();
    let takenBy = "another driver";
    if (existing?.assigned_driver_chat_id) {
      const { data: drv } = await supabaseAdmin
        .from("delivery_drivers")
        .select("display_name, telegram_username")
        .eq("restaurant_id", existing.restaurant_id)
        .eq("telegram_chat_id", existing.assigned_driver_chat_id)
        .maybeSingle();
      takenBy = drv?.display_name ?? (drv?.telegram_username ? "@" + drv.telegram_username : takenBy);
    }
    await answerCallbackQuery(callbackId, `تم الاستلام بواسطة ${takenBy}`, true, { botToken });
    await editTelegramMessageText(
      chatId,
      messageId,
      `❌ تم استلام هذا الطلب بواسطة <b>${takenBy}</b>.`,
      undefined,
      { botToken },
    );
    return;
  }

  const { data: driverRow } = await supabaseAdmin
    .from("delivery_drivers")
    .select("id, display_name, telegram_username")
    .eq("restaurant_id", claimed.restaurant_id)
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  const driverName =
    driverRow?.display_name ?? (fromUsername ? "@" + fromUsername : "ديلفري");

  await supabaseAdmin.from("delivery_assignments").insert({
    order_id: orderId,
    restaurant_id: claimed.restaurant_id,
    driver_chat_id: chatId,
    driver_id: driverRow?.id ?? null,
  });

  await answerCallbackQuery(callbackId, "تم استلامك للطلب ✅", false, { botToken });

  const { data: orderItems } = await supabaseAdmin
    .from("order_items")
    .select("name_snapshot, quantity")
    .eq("order_id", orderId);
  const itemsList = (orderItems ?? [])
    .map((p) => `• ${p.name_snapshot} × ${p.quantity}`)
    .join("\n");
  const orderNumFull = orderId.replace(/-/g, "").slice(-6).toUpperCase();
  const notesLine = claimed.notes ? `\n📝 <b>ملاحظة:</b> ${claimed.notes}` : "";
  const totalNum = Number(claimed.total ?? 0);
  const privateText =
    `✅ <b>أنت المسؤول عن الطلب</b> #${orderNumFull}\n\n` +
    `👤 <b>العميل:</b> ${claimed.customer_name ?? "-"}\n` +
    `📞 <b>الهاتف:</b> ${claimed.customer_phone ?? "-"}\n` +
    `📍 <b>العنوان:</b> ${claimed.customer_address ?? "-"}\n\n` +
    `🍽️ <b>الطلب:</b>\n${itemsList}\n\n` +
    `💰 <b>المجموع:</b> ${totalNum.toLocaleString("fr-DZ")} دج` +
    notesLine +
    `\n\nبعد التوصيل وتحصيل المبلغ سأسألك للتأكيد.`;
  const cancelKeyboard: InlineKeyboard = {
    inline_keyboard: [
      [{ text: "❌ إلغاء الاستلام", callback_data: `cancel:${orderId}` }],
    ],
  };

  const { data: msgs } = await supabaseAdmin
    .from("order_telegram_messages")
    .select("chat_id, message_id")
    .eq("order_id", orderId)
    .eq("kind", "new_order");

  const orderNum = orderNumFull;
  for (const m of msgs ?? []) {
    if (Number(m.chat_id) === chatId) {
      await editTelegramMessageText(
        m.chat_id as unknown as number,
        m.message_id as unknown as number,
        privateText,
        cancelKeyboard,
        { botToken },
      );
    } else {
      await editTelegramMessageText(
        m.chat_id as unknown as number,
        m.message_id as unknown as number,
        `❌ تم استلام الطلب #${orderNum} بواسطة <b>${driverName}</b>.`,
        undefined,
        { botToken },
      );
    }
  }
}

async function handleCancel(
  orderId: string,
  chatId: number,
  callbackId: string,
  _messageId: number,
  botToken: string | null,
) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, assigned_driver_chat_id, restaurant_id, total, customer_name, customer_address, notes")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || Number(order.assigned_driver_chat_id) !== chatId) {
    await answerCallbackQuery(callbackId, "هذا الطلب ليس مُسنداً إليك", true, { botToken });
    return;
  }

  const { data: drv } = await supabaseAdmin
    .from("delivery_drivers")
    .select("display_name, telegram_username")
    .eq("restaurant_id", order.restaurant_id)
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  const driverName =
    drv?.display_name ?? (drv?.telegram_username ? "@" + drv.telegram_username : "ديلفري");

  await supabaseAdmin
    .from("orders")
    .update({ assigned_driver_chat_id: null })
    .eq("id", orderId);
  await supabaseAdmin.from("delivery_assignments").delete().eq("order_id", orderId);

  await answerCallbackQuery(callbackId, "تم إلغاء استلامك للطلب", false, { botToken });

  const orderNum = orderId.replace(/-/g, "").slice(-6).toUpperCase();

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("name_snapshot, quantity")
    .eq("order_id", orderId);
  const { data: rest } = await supabaseAdmin
    .from("restaurants")
    .select("name")
    .eq("id", order.restaurant_id)
    .maybeSingle();
  const itemsList = (items ?? [])
    .map((p) => `• ${p.name_snapshot} × ${p.quantity}`)
    .join("\n");
  const notesLine = order.notes ? `\n📝 <b>ملاحظة:</b> ${order.notes}` : "";
  const publicText =
    `⚠️ <b>${driverName} ألغى استلام الطلب — من يريد استلامه؟</b>\n\n` +
    `🛵 <b>طلب توصيل</b>\n` +
    `🏷️ <b>${rest?.name ?? "المطعم"}</b>\n` +
    `🔢 رقم الطلب: <code>#${orderNum}</code>\n\n` +
    `🍽️ <b>الطلب:</b>\n${itemsList}\n\n` +
    `📍 <b>مكان التوصيل:</b> ${(order as any).customer_address ?? "-"}\n\n` +
    `💰 <b>المجموع:</b> ${Number(order.total ?? 0).toLocaleString("fr-DZ")} دج\n\n` +
    `🔒 <i>اسم العميل ورقم هاتفه يظهران بعد استلام الطلب.</i>` +
    notesLine;

  const claimKeyboard: InlineKeyboard = {
    inline_keyboard: [
      [{ text: "🛵 استلام الطلب", callback_data: `claim:${orderId}` }],
    ],
  };

  const { data: msgs } = await supabaseAdmin
    .from("order_telegram_messages")
    .select("chat_id, message_id")
    .eq("order_id", orderId)
    .eq("kind", "new_order");

  for (const m of msgs ?? []) {
    if (Number(m.chat_id) === chatId) {
      await editTelegramMessageText(
        m.chat_id as unknown as number,
        m.message_id as unknown as number,
        `❌ تم إلغاء استلامك للطلب #${orderNum}. تم إعادة عرضه على بقية السائقين.`,
        undefined,
        { botToken },
      );
    } else {
      await editTelegramMessageText(
        m.chat_id as unknown as number,
        m.message_id as unknown as number,
        publicText,
        claimKeyboard,
        { botToken },
      );
    }
  }

  await supabaseAdmin.from("notifications").insert({
    restaurant_id: order.restaurant_id,
    kind: "delivery_cancelled",
    title: `${driverName} ألغى الطلب #${orderNum}`,
    body: "تمت إعادة عرض الطلب على بقية السائقين.",
    order_id: orderId,
  });
}

async function handlePaid(
  orderId: string,
  chatId: number,
  callbackId: string,
  messageId: number,
  botToken: string | null,
) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, assigned_driver_chat_id, restaurant_id, total")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || Number(order.assigned_driver_chat_id) !== chatId) {
    await answerCallbackQuery(callbackId, "هذا الطلب ليس مُسنداً إليك", true, { botToken });
    return;
  }
  await supabaseAdmin
    .from("delivery_assignments")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await supabaseAdmin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", orderId);
  await answerCallbackQuery(callbackId, "شكراً! تم تسجيل الدفع ✅", false, { botToken });
  await editTelegramMessageText(
    chatId,
    messageId,
    `✅ تم تأكيد تسليم الطلب وتحصيل المبلغ.\nتمت إضافته لإيرادات اليوم.`,
    undefined,
    { botToken },
  );
}

async function handlePending(
  orderId: string,
  chatId: number,
  callbackId: string,
  messageId: number,
  botToken: string | null,
) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("assigned_driver_chat_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || Number(order.assigned_driver_chat_id) !== chatId) {
    await answerCallbackQuery(callbackId, "هذا الطلب ليس مُسنداً إليك", true, { botToken });
    return;
  }
  const nextAt = new Date();
  await supabaseAdmin
    .from("delivery_assignments")
    .update({ last_followup_at: nextAt.toISOString() })
    .eq("order_id", orderId);
  await answerCallbackQuery(callbackId, "تمام، سأسألك مجدداً بعد 5 دقائق", false, { botToken });
  await editTelegramMessageText(
    chatId,
    messageId,
    `⏳ تمام، سأذكّرك مجدداً بعد 5 دقائق للتأكيد.`,
    undefined,
    { botToken },
  );
}