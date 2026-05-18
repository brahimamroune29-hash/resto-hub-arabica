const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const DIRECT_API = "https://api.telegram.org";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Decide whether a failed Telegram call should be retried.
 * Retries: network errors, 5xx, 429 (rate limit), 408 (timeout).
 * No retry: 4xx client errors (bad token, blocked by user, invalid chat, …).
 */
function isTransient(status: number | null, err?: unknown): boolean {
  if (status == null) return true; // network / fetch failure
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  method: string,
): Promise<{ status: number; data: { ok?: boolean; result?: unknown; description?: string; parameters?: { retry_after?: number } } }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: unknown;
        description?: string;
        parameters?: { retry_after?: number };
      };
      if (res.ok && data.ok) return { status: res.status, data };

      if (attempt < MAX_ATTEMPTS && isTransient(res.status)) {
        const retryAfter = data.parameters?.retry_after;
        const wait = retryAfter
          ? retryAfter * 1000
          : BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[telegram ${method}] transient ${res.status} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${wait}ms: ${data.description ?? ""}`,
        );
        await sleep(wait);
        continue;
      }
      return { status: res.status, data };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(null, err)) {
        const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[telegram ${method}] network error (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying in ${wait}ms`,
          err,
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error(`Telegram ${method} failed after ${MAX_ATTEMPTS} attempts`);
}

/**
 * Call a Telegram Bot API method.
 * - If `botToken` is provided, calls api.telegram.org directly with that bot's token.
 * - Otherwise, uses the shared connector gateway (legacy shared bot).
 */
export async function callTelegram(
  method: string,
  body: Record<string, unknown>,
  opts?: { botToken?: string | null },
) {
  const botToken = opts?.botToken?.trim() || null;

  if (botToken) {
    const { status, data } = await fetchWithRetry(
      `${DIRECT_API}/bot${botToken}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      method,
    );
    if (!data.ok) {
      throw new Error(
        `Telegram ${method} failed [${status}]: ${data.description ?? JSON.stringify(data)}`,
      );
    }
    return data.result;
  }

  throw new Error("لم يتم ربط بوت تليغرام لهذا المطعم");
}

let cachedBotUsername: string | null = null;
export async function getBotUsername(botToken?: string | null): Promise<string> {
  if (botToken) {
    const me = (await callTelegram("getMe", {}, { botToken })) as { username: string };
    return me.username;
  }
  if (cachedBotUsername) return cachedBotUsername;
  const me = (await callTelegram("getMe", {})) as { username: string };
  cachedBotUsername = me.username;
  return me.username;
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts?: { botToken?: string | null },
) {
  return callTelegram(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
    opts,
  );
}

export type InlineKeyboard = {
  inline_keyboard: { text: string; callback_data: string }[][];
};

export async function sendTelegramMessageWithKeyboard(
  chatId: number | string,
  text: string,
  keyboard: InlineKeyboard,
  opts?: { botToken?: string | null },
) {
  return callTelegram(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: keyboard,
    },
    opts,
  ) as Promise<{ message_id: number; chat: { id: number } }>;
}

export async function editTelegramMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
  opts?: { botToken?: string | null },
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (keyboard) body.reply_markup = keyboard;
  return callTelegram("editMessageText", body, opts).catch((err) => {
    // Editing can fail if the message text is identical or already edited; ignore.
    console.error("[editTelegramMessageText]", err);
    return null;
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
  opts?: { botToken?: string | null },
) {
  return callTelegram(
    "answerCallbackQuery",
    {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    },
    opts,
  ).catch(() => null);
}

/**
 * Register the webhook for a custom restaurant bot.
 * The secret_token mirrors what the per-restaurant webhook route validates:
 * sha256("telegram-webhook:" + botToken) base64url.
 */
export async function setBotWebhook(
  botToken: string,
  url: string,
  secretToken: string,
) {
  return callTelegram(
    "setWebhook",
    {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "edited_message", "callback_query"],
      drop_pending_updates: true,
    },
    { botToken },
  );
}

export async function deleteBotWebhook(botToken: string) {
  return callTelegram("deleteWebhook", { drop_pending_updates: true }, { botToken });
}