const WINDOW_MS = 5 * 60 * 1000; // 5-minute window
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

function storageKey(key: string) {
  return `rl:${key}`;
}

function readEntry(key: string): RateLimitEntry | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    return raw ? (JSON.parse(raw) as RateLimitEntry) : null;
  } catch {
    return null;
  }
}

function writeEntry(key: string, entry: RateLimitEntry) {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {}
}

export function checkRateLimit(key: string): { allowed: boolean; waitSeconds: number } {
  const entry = readEntry(key);
  if (!entry) return { allowed: true, waitSeconds: 0 };

  const elapsed = Date.now() - entry.windowStart;
  if (elapsed > WINDOW_MS) {
    sessionStorage.removeItem(storageKey(key));
    return { allowed: true, waitSeconds: 0 };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    const waitSeconds = Math.ceil((WINDOW_MS - elapsed) / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true, waitSeconds: 0 };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = readEntry(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    writeEntry(key, { attempts: 1, windowStart: now });
  } else {
    writeEntry(key, { ...entry, attempts: entry.attempts + 1 });
  }
}

export function clearRateLimit(key: string): void {
  try {
    sessionStorage.removeItem(storageKey(key));
  } catch {}
}
