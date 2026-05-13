import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Send, Loader2, X, Plus, MessageSquare, Trash2, Menu } from "lucide-react";
import { askAdminBot } from "@/lib/admin-chat.functions";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; updatedAt: number; messages: Msg[] };

const STORAGE_KEY = "admin-chatbot-threads-v1";
const ACTIVE_KEY = "admin-chatbot-active-v1";

const SUGGESTIONS = [
  "كم ربحت اليوم؟",
  "ايش الطبق الأكثر مبيعاً هذا الأسبوع؟",
  "ايش المكونات اللي قربت تخلص؟",
  "كيف أزيد أرباحي؟",
  "ايش أكبر مصاريفي هذا الشهر؟",
  "أعطني ملخص سريع عن المطعم",
];

function newThread(): Thread {
  return {
    id: (typeof crypto !== "undefined" && crypto.randomUUID?.()) || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "محادثة جديدة",
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadInitial(): { threads: Thread[]; activeId: string } {
  if (typeof window === "undefined") {
    const t = newThread();
    return { threads: [t], activeId: t.id };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: Thread[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) && parsed.length ? parsed : [newThread()];
    const active = window.localStorage.getItem(ACTIVE_KEY);
    const activeId = active && list.some((t) => t.id === active) ? active : list[0].id;
    if (!raw) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return { threads: list, activeId };
  } catch {
    const t = newThread();
    return { threads: [t], activeId: t.id };
  }
}

export function AdminChatBot() {
  const ask = useServerFn(askAdminBot);
  const [open, setOpen] = useState(false);
  const [showThreads, setShowThreads] = useState(false);

  const initial = useMemo(loadInitial, []);
  const [threads, setThreads] = useState<Thread[]>(initial.threads);
  const [activeId, setActiveId] = useState<string>(initial.activeId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];
  const messages = active?.messages ?? [];

  const persist = useCallback((next: Thread[], nextActive?: string) => {
    setThreads(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      if (nextActive) window.localStorage.setItem(ACTIVE_KEY, nextActive);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_KEY, activeId);
    }
  }, [activeId]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, open, activeId]);

  const createThread = useCallback(() => {
    const t = newThread();
    const next = [t, ...threads];
    persist(next, t.id);
    setActiveId(t.id);
    setShowThreads(false);
  }, [threads, persist]);

  const deleteThread = useCallback(
    (id: string) => {
      const next = threads.filter((t) => t.id !== id);
      const list = next.length ? next : [newThread()];
      const newActive = id === activeId ? list[0].id : activeId;
      persist(list, newActive);
      setActiveId(newActive);
    },
    [threads, activeId, persist],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading || !active) return;
      const userMsg: Msg = { role: "user", content: trimmed };
      const updated: Thread = {
        ...active,
        title: active.messages.length === 0 ? trimmed.slice(0, 40) : active.title,
        messages: [...active.messages, userMsg],
        updatedAt: Date.now(),
      };
      const nextThreads = threads.map((t) => (t.id === active.id ? updated : t));
      persist(nextThreads);
      setInput("");
      setLoading(true);
      try {
        const res = await ask({ data: { messages: updated.messages } });
        const finalThread: Thread = {
          ...updated,
          messages: [...updated.messages, { role: "assistant", content: res.reply }],
          updatedAt: Date.now(),
        };
        persist(threads.map((t) => (t.id === active.id ? finalThread : t)));
      } catch (e: any) {
        const errThread: Thread = {
          ...updated,
          messages: [
            ...updated.messages,
            { role: "assistant", content: e?.message ?? "حدث خطأ، حاول مرة أخرى" },
          ],
          updatedAt: Date.now(),
        };
        persist(threads.map((t) => (t.id === active.id ? errThread : t)));
      } finally {
        setLoading(false);
      }
    },
    [active, threads, loading, ask, persist],
  );

  const sortedThreads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="المساعد الذكي"
        className="fixed bottom-24 md:bottom-6 end-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl flex items-center justify-center hover:scale-105 transition"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-full sm:max-w-md flex flex-col h-full" dir="rtl">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowThreads((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-muted"
                aria-label="المحادثات"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate max-w-[180px]">
                  {active?.title ?? "المساعد الذكي"}
                </div>
                <div className="text-[11px] text-muted-foreground">المساعد الذكي</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={createThread}
                className="p-1.5 rounded-lg hover:bg-muted"
                aria-label="محادثة جديدة"
                title="محادثة جديدة"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Threads list */}
          {showThreads && (
            <div className="border-b max-h-64 overflow-y-auto bg-muted/30">
              <div className="p-2 space-y-1">
                <button
                  onClick={createThread}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-primary/10 text-primary hover:bg-primary/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  محادثة جديدة
                </button>
                {sortedThreads.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center gap-1 rounded-lg ${
                      t.id === activeId ? "bg-primary/15" : "hover:bg-muted"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveId(t.id);
                        setShowThreads(false);
                      }}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-start min-w-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t.title}</span>
                    </button>
                    <button
                      onClick={() => deleteThread(t.id)}
                      className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                      aria-label="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center py-6">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center mb-3">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    اسألني أي شيء عن مطعمك — الأرباح، المخزون، المصاريف، الموظفين...
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-full border bg-muted/50 hover:bg-muted transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {m.role === "user" ? "👤" : <Sparkles className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tl-sm"
                      : "bg-muted rounded-tr-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl bg-muted text-sm flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري التفكير...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t p-3 flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()} size="icon">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
