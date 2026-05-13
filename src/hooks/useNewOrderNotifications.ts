import { useEffect, useRef, useState } from "react";

/**
 * Plays a beep + browser notification when called.
 * Sound is unlocked via user gesture (toggle button).
 */
export function useNewOrderNotifications() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("notif_sound") === "1";
  });
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (enabled) localStorage.setItem("notif_sound", "1");
    else localStorage.removeItem("notif_sound");
  }, [enabled]);

  function ensureCtx() {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current;
  }

  async function enable() {
    const ctx = ensureCtx();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
    setEnabled(true);
  }

  function disable() {
    setEnabled(false);
  }

  function playBeep() {
    if (!enabled) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Two short beeps
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.25, now + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch {
      // ignore
    }
  }

  function notify(title: string, body?: string) {
    if (!enabled) return;
    playBeep();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(title, { body, icon: "/favicon.ico" });
        setTimeout(() => n.close(), 5000);
      } catch {
        // ignore
      }
    }
  }

  return { enabled, enable, disable, notify };
}