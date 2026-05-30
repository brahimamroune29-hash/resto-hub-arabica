import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { getAuthSessionWaitMs, getPostAuthRedirect, waitForAuthSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const session = await waitForAuthSession(getAuthSessionWaitMs());
    if (session) {
      const to = await getPostAuthRedirect(session.user.id);
      throw redirect({ to });
    }
  },
  head: () => ({
    meta: [
      { title: "ساهل DZ — تسيير المطاعم بطريقة سهلة" },
      {
        name: "description",
        content:
          "منصة متكاملة لتسيير المطاعم الجزائرية — إدارة الطلبات، الكاشير، المطبخ، المخزون، الموارد البشرية والمنيو الإلكتروني في منصة واحدة.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  component: Landing,
});

const PRIMARY = "#16a34a";
const PRIMARY_DARK = "#15803d";
const PRIMARY_LIGHT = "#dcfce7";
const FONT = "'Cairo', sans-serif";

const modules = [
  {
    icon: "🍔",
    title: "واجهة الزبون",
    color: "#f59e0b",
    items: ["QR Menu", "طلب من الطاولة", "تتبع الطلب"],
  },
  {
    icon: "👨‍🍳",
    title: "واجهة المطبخ",
    color: "#ef4444",
    items: ["شاشة الطلبات المباشرة", "ترتيب الأولويات", "تنبيهات"],
  },
  {
    icon: "💳",
    title: "واجهة الكاشير",
    color: "#3b82f6",
    items: ["فواتير", "طرق دفع", "تقارير يومية"],
  },
  {
    icon: "📦",
    title: "إدارة المخزون",
    color: "#8b5cf6",
    items: ["خصم تلقائي", "تنبيهات النقص", "تكلفة المنتجات"],
  },
  {
    icon: "👥",
    title: "الموارد البشرية",
    color: "#06b6d4",
    items: ["حضور العمال", "الرواتب والاقتطاعات", "تقييم الأداء"],
  },
];

const reasons = [
  { icon: "✨", text: "سهل الاستخدام", desc: "واجهة بسيطة يفهمها أي موظف بدون تدريب" },
  { icon: "⚡", text: "سريع", desc: "استجابة فورية حتى مع ضغط الطلبات" },
  { icon: "🌍", text: "يدعم العربية", desc: "مصمم أصلاً للواجهة العربية RTL" },
  { icon: "🇩🇿", text: "للمطاعم الجزائرية", desc: "يعمل بالدينار الجزائري ومناسب للسوق المحلي" },
  { icon: "📱", text: "هاتف وPC", desc: "يعمل على كل الأجهزة بدون تطبيق" },
];

function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 4px 14px ${PRIMARY}55`,
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h18M3 12h18M3 17h12" />
      </svg>
    </div>
  );
}

function Landing() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes sdz-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes sdz-fadein { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
      .sdz-float { animation: sdz-float 4s ease-in-out infinite; }
      .sdz-fadein { animation: sdz-fadein 0.7s ease both; }
      .sdz-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.10); }
      .sdz-btn-primary:hover { background: ${PRIMARY_DARK} !important; transform: translateY(-1px); box-shadow: 0 6px 20px ${PRIMARY}55 !important; }
      .sdz-btn-outline:hover { background: #f0fdf4 !important; }
      .sdz-nav-link:hover { color: ${PRIMARY} !important; }
      @media (max-width: 800px) {
        .sdz-hide-mobile { display: none !important; }
        .sdz-hero-title { font-size: 34px !important; }
        .sdz-modules-grid { grid-template-columns: 1fr 1fr !important; }
        .sdz-reasons-grid { grid-template-columns: 1fr 1fr !important; }
      }
      @media (max-width: 500px) {
        .sdz-modules-grid { grid-template-columns: 1fr !important; }
        .sdz-reasons-grid { grid-template-columns: 1fr !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT, color: "#111827" }}>

      {/* ─── NAV ─── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64,
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo size={36} />
          <span style={{ fontWeight: 900, fontSize: 20, color: "#111827", letterSpacing: -0.5 }}>ساهل DZ</span>
        </Link>

        <div className="sdz-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["الميزات", "الأسعار", "تواصل معنا"].map((l) => (
            <a key={l} href="#features" className="sdz-nav-link" style={{ fontSize: 15, fontWeight: 500, color: "#6b7280", textDecoration: "none", transition: "color 0.2s" }}>{l}</a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/login" style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", textDecoration: "none", padding: "8px 16px" }}>
            تسجيل الدخول
          </Link>
          <Link
            to="/signup"
            className="sdz-btn-primary"
            style={{
              background: PRIMARY, color: "#fff", textDecoration: "none",
              borderRadius: 100, padding: "9px 22px", fontSize: 14,
              fontWeight: 700, transition: "all 0.2s",
              boxShadow: `0 4px 14px ${PRIMARY}44`,
            }}
          >
            جرّب الآن ←
          </Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{
        background: "linear-gradient(160deg, #f0fdf4 0%, #fff 55%, #f0fdf4 100%)",
        padding: "80px 32px 60px",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* decorative circles */}
        <div aria-hidden style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: `${PRIMARY}0d`, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: -60, left: -60, width: 260, height: 260, borderRadius: "50%", background: `${PRIMARY}08`, pointerEvents: "none" }} />

        <div className="sdz-fadein" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: PRIMARY_LIGHT, borderRadius: 100, padding: "6px 18px", fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 28 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIMARY, display: "inline-block" }} />
          متاح الآن في الجزائر
        </div>

        <h1 className="sdz-hero-title sdz-fadein" style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.15, letterSpacing: -1.5, color: "#111827", marginBottom: 16, maxWidth: 680, animationDelay: "0.05s" }}>
          تسيير المطاعم…{" "}
          <span style={{ color: PRIMARY }}>بطريقة سهلة</span>
        </h1>

        <p className="sdz-fadein" style={{ fontSize: 18, color: "#6b7280", maxWidth: 520, lineHeight: 1.8, marginBottom: 12, animationDelay: "0.1s" }}>
          كل ما يحتاجه مطعمك… في منصة واحدة
        </p>

        <p className="sdz-fadein" style={{ fontSize: 14, color: PRIMARY, fontWeight: 700, marginBottom: 36, letterSpacing: 0.5, animationDelay: "0.15s" }}>
          إدارة الطلبات • الكاشير • المطبخ • المخزون • الموارد البشرية • المنيو الإلكتروني
        </p>

        <div className="sdz-fadein" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", animationDelay: "0.2s" }}>
          <Link
            to="/signup"
            className="sdz-btn-primary"
            style={{
              background: PRIMARY, color: "#fff", textDecoration: "none",
              borderRadius: 100, padding: "14px 36px", fontSize: 16, fontWeight: 800,
              boxShadow: `0 6px 20px ${PRIMARY}44`, transition: "all 0.2s",
            }}
          >
            ابدأ مجانًا ←
          </Link>
          <Link
            to="/login"
            className="sdz-btn-outline"
            style={{
              background: "#fff", color: "#374151", textDecoration: "none",
              border: "1.5px solid #d1fae5", borderRadius: 100,
              padding: "14px 32px", fontSize: 16, fontWeight: 600, transition: "all 0.2s",
            }}
          >
            مشاهدة تجربة
          </Link>
        </div>

        {/* floating demo card */}
        <div className="sdz-float" style={{ marginTop: 56, background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.10)", maxWidth: 440, width: "100%", textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>لوحة التحكم — مطعم أربيكا</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "طلبات اليوم", val: "٨٧", color: PRIMARY },
              { label: "الإيرادات", val: "٤٢,٠٠٠ دج", color: "#3b82f6" },
              { label: "الهدر", val: "١.٢٪", color: "#f59e0b" },
            ].map((k) => (
              <div key={k.label} style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 10px" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MODULES ─── */}
      <section id="features" style={{ background: "#fff", padding: "72px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>أقسام المنصة</div>
            <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, color: "#111827" }}>
              كل شيء في مكان واحد
            </h2>
          </div>

          <div className="sdz-modules-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {modules.map((m) => (
              <div
                key={m.title}
                className="sdz-card"
                style={{
                  border: "1.5px solid #e5e7eb", borderRadius: 20,
                  padding: "24px 20px", background: "#fff",
                  transition: "all 0.25s", cursor: "default",
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 14 }}>{m.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 12 }}>{m.title}</h3>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {m.items.map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3" stroke={m.color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY ─── */}
      <section style={{ background: "#f0fdf4", padding: "72px 32px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: PRIMARY, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>لماذا ساهل DZ</div>
            <h2 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, color: "#111827" }}>
              ليش المطاعم تختار ساهل DZ؟
            </h2>
          </div>

          <div className="sdz-reasons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {reasons.map((r) => (
              <div
                key={r.text}
                className="sdz-card"
                style={{
                  background: "#fff", borderRadius: 20,
                  padding: "24px 20px",
                  border: "1.5px solid #d1fae5",
                  transition: "all 0.25s",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{r.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{r.text}</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_DARK})`, padding: "72px 32px", textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginBottom: 16, letterSpacing: -1 }}>
          ابدأ تسيير مطعمك بشكل احترافي
        </h2>
        <p style={{ fontSize: 17, color: "rgba(255,255,255,0.85)", marginBottom: 36 }}>
          انضم للمطاعم التي تثق بساهل DZ لتنظيم عملها اليومي
        </p>
        <Link
          to="/signup"
          style={{
            display: "inline-block", background: "#fff", color: PRIMARY,
            textDecoration: "none", borderRadius: 100,
            padding: "16px 48px", fontSize: 17, fontWeight: 900,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          }}
        >
          ابدأ مجانًا الآن ←
        </Link>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: "#111827", color: "#6b7280", padding: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo size={28} />
          <span style={{ color: "#f9fafb", fontWeight: 800, fontSize: 16 }}>ساهل DZ</span>
        </div>
        <span style={{ fontSize: 13 }}>© {new Date().getFullYear()} ساهل DZ · الجزائر</span>
        <div style={{ display: "flex", gap: 24 }}>
          {["الخصوصية", "الشروط", "تواصل معنا"].map((l) => (
            <a key={l} href="#" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
