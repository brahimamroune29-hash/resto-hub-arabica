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
      { title: "MenuFlow — The Modern Dining Experience" },
      {
        name: "description",
        content:
          "Elevate your restaurant with a beautiful, real-time QR ordering system. Delight customers and streamline your kitchen — in Arabic, French, or English.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: Landing,
});

const ACCENT = "#c9a431";
const FONT = "'Plus Jakarta Sans', sans-serif";

function QRPattern() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <rect x="4" y="4" width="22" height="22" rx="3" fill="#1a1a1a" />
      <rect x="8" y="8" width="14" height="14" rx="1" fill="#f2f2ee" />
      <rect x="11" y="11" width="8" height="8" rx="1" fill="#1a1a1a" />
      <rect x="46" y="4" width="22" height="22" rx="3" fill="#1a1a1a" />
      <rect x="50" y="8" width="14" height="14" rx="1" fill="#f2f2ee" />
      <rect x="53" y="11" width="8" height="8" rx="1" fill="#1a1a1a" />
      <rect x="4" y="46" width="22" height="22" rx="3" fill="#1a1a1a" />
      <rect x="8" y="50" width="14" height="14" rx="1" fill="#f2f2ee" />
      <rect x="11" y="53" width="8" height="8" rx="1" fill="#1a1a1a" />
      <rect x="32" y="4" width="8" height="4" rx="1" fill="#1a1a1a" />
      <rect x="32" y="12" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="38" y="12" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="4" y="32" width="4" height="8" rx="1" fill="#1a1a1a" />
      <rect x="12" y="32" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="32" y="32" width="36" height="4" rx="1" fill="#1a1a1a" />
      <rect x="32" y="40" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="40" y="40" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="48" y="40" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="56" y="40" width="4" height="8" rx="1" fill="#1a1a1a" />
      <rect x="32" y="48" width="8" height="4" rx="1" fill="#1a1a1a" />
      <rect x="44" y="48" width="8" height="4" rx="1" fill="#1a1a1a" />
      <rect x="32" y="56" width="4" height="8" rx="1" fill="#1a1a1a" />
      <rect x="40" y="60" width="8" height="4" rx="1" fill="#1a1a1a" />
      <rect x="52" y="56" width="4" height="4" rx="1" fill="#1a1a1a" />
      <rect x="60" y="56" width="4" height="8" rx="1" fill="#1a1a1a" />
    </svg>
  );
}

function CardQR() {
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "20px 24px", boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)", width: 200, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M17 20h3M20 17v3" /></svg>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Scan to Order</span>
      </div>
      <QRPattern />
      <div style={{ background: "#f7f7f4", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
        <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>Table 7 · الطاولة ٧</span>
      </div>
    </div>
  );
}

function CardMenuItem() {
  const items = [
    { name: "طاجين الدجاج", price: "580 DA", emoji: "🍲", tag: "Popular" },
    { name: "كسكس اللحم", price: "650 DA", emoji: "🥘" },
    { name: "شوربة الفريك", price: "320 DA", emoji: "🍜" },
  ] as const;
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "18px 20px", boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)", width: 230 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Today's Menu</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f7f7f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{item.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", direction: "rtl" }}>{item.name}</div>
              {"tag" in item && item.tag && <span style={{ fontSize: 10, background: ACCENT + "20", color: ACCENT, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>{item.tag}</span>}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{item.price}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardOrder() {
  const steps = [
    { label: "Received", done: true },
    { label: "In Kitchen", done: true },
    { label: "Ready", done: true },
    { label: "Served", done: false },
  ];
  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "18px 20px", boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)", width: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Order #42</span>
        <span style={{ fontSize: 11, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "3px 10px", fontWeight: 700 }}>Ready ✓</span>
      </div>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: step.done ? ACCENT : "#eee", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {step.done && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7.5 8,3" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ fontSize: 12, color: step.done ? "#1a1a1a" : "#aaa", fontWeight: step.done ? 600 : 400 }}>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

function CardKitchen() {
  const orders = [
    { table: 3, item: "Couscous x2", time: "2 min", hot: true },
    { table: 7, item: "Tajine x1", time: "8 min", hot: false },
    { table: 12, item: "Chorba x3", time: "12 min", hot: false },
  ];
  return (
    <div style={{ background: "#1a1a1a", borderRadius: 20, padding: "18px 20px", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", width: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}></div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>Kitchen Display</span>
      </div>
      {orders.map((o, i) => (
        <div key={i} style={{ background: o.hot ? ACCENT + "22" : "#2a2a2a", borderRadius: 10, padding: "10px 12px", marginBottom: i < 2 ? 8 : 0, border: o.hot ? `1px solid ${ACCENT}55` : "1px solid transparent", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>Table {o.table}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{o.item}</div>
          </div>
          <div style={{ fontSize: 11, color: o.hot ? ACCENT : "#555", fontWeight: 700 }}>{o.time}</div>
        </div>
      ))}
    </div>
  );
}

function Badge() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT + "15", border: `1px solid ${ACCENT}40`, borderRadius: 100, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: ACCENT, marginBottom: 28 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, display: "inline-block", flexShrink: 0 }}></span>
      Now available in Algeria · متاح الآن في الجزائر
    </div>
  );
}

const features = [
  { svg: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M17 20h3M20 17v3" /></>, title: "Scan & Order", desc: "Customers scan a QR code on their table and browse a rich, high-end digital menu in Arabic." },
  { svg: <><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="12" y2="15" /></>, title: "Mobile First", desc: "Designed specifically for phones. A smooth, app-like experience without the need to download anything." },
  { svg: <><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="8" y1="10" x2="8" y2="16" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="16" y1="12" x2="16" y2="16" /></>, title: "Live Kitchen Display", desc: "Orders flow directly to a beautiful, real-time kitchen screen. Color-coded timers keep everything on track." },
  { svg: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></>, title: "Real-time Updates", desc: "Orders update instantly across all devices — from the customer's phone to the kitchen screen." },
  { svg: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>, title: "Multi-language Menu", desc: "Present your menu in Arabic, French, and English seamlessly with one management panel." },
  { svg: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />, title: "Analytics Dashboard", desc: "Track top-selling dishes, peak hours, and revenue from a clean, intuitive admin panel." },
];

function Landing() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes mf-float1 { 0%,100%{transform:translateY(0px) rotate(-4deg)} 50%{transform:translateY(-10px) rotate(-4deg)} }
      @keyframes mf-float2 { 0%,100%{transform:translateY(0px) rotate(3deg)} 50%{transform:translateY(-14px) rotate(3deg)} }
      @keyframes mf-float3 { 0%,100%{transform:translateY(0px) rotate(2deg)} 50%{transform:translateY(-8px) rotate(2deg)} }
      @keyframes mf-float4 { 0%,100%{transform:translateY(0px) rotate(-2deg)} 50%{transform:translateY(-12px) rotate(-2deg)} }
      .mf-float1 { animation: mf-float1 5s ease-in-out infinite; }
      .mf-float2 { animation: mf-float2 6s ease-in-out infinite; }
      .mf-float3 { animation: mf-float3 4.5s ease-in-out infinite; }
      .mf-float4 { animation: mf-float4 5.5s ease-in-out infinite; }
      .mf-floating-card { display: block; }
      @media (max-width: 900px) { .mf-floating-card { display: none; } .mf-nav-links { display: none !important; } }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div dir="ltr" style={{ minHeight: "100vh", background: "#f2f2ee", fontFamily: FONT, color: "#1a1a1a" }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(242,242,238,0.88)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h12" /></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: "#1a1a1a", letterSpacing: -0.5 }}>MenuFlow</span>
        </Link>
        <div className="mf-nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {["Features", "How it works", "Pricing"].map((l) => (
            <a key={l} href="#features" style={{ fontSize: 14, fontWeight: 500, color: "#555", textDecoration: "none" }}>{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/login" style={{ fontSize: 14, fontWeight: 500, color: "#555", textDecoration: "none" }}>Restaurant Login</Link>
          <Link to="/signup" style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 100, padding: "9px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none" }}>Get started →</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", backgroundImage: "radial-gradient(circle, #b8b8b0 1px, transparent 1px)", backgroundSize: "24px 24px", minHeight: "calc(100vh - 60px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 40px", overflow: "hidden" }}>
        <div className="mf-float1 mf-floating-card" style={{ position: "absolute", top: "10%", left: "4%", zIndex: 2 }}><CardMenuItem /></div>
        <div className="mf-float2 mf-floating-card" style={{ position: "absolute", top: "6%", right: "4%", zIndex: 2 }}><CardKitchen /></div>
        <div className="mf-float3 mf-floating-card" style={{ position: "absolute", bottom: "8%", left: "5%", zIndex: 2 }}><CardQR /></div>
        <div className="mf-float4 mf-floating-card" style={{ position: "absolute", bottom: "10%", right: "5%", zIndex: 2 }}><CardOrder /></div>

        <div style={{ textAlign: "center", maxWidth: 620, zIndex: 3, position: "relative" }}>
          <Badge />
          <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: -2, color: "#1a1a1a", marginBottom: 8 }}>The modern dining experience,</h1>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: -2, color: ACCENT, fontStyle: "italic", marginBottom: 28 }}>reimagined.</h1>
          <p style={{ fontSize: 17, color: "#666", lineHeight: 1.7, maxWidth: 460, margin: "0 auto 36px" }}>
            Elevate your restaurant with a beautiful, real-time QR ordering system. Delight customers and streamline your kitchen — in Arabic, French, or English.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/signup" style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 100, padding: "14px 32px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 20px ${ACCENT}55`, textDecoration: "none" }}>
              Try the demo menu →
            </Link>
            <Link to="/login" style={{ background: "#fff", color: "#1a1a1a", border: "1.5px solid rgba(0,0,0,0.12)", borderRadius: 100, padding: "14px 32px", fontSize: 16, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: "#fff", padding: "80px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Why MenuFlow</div>
        <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 60, color: "#1a1a1a", textAlign: "center" }}>Everything your restaurant needs</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, maxWidth: 900, width: "100%" }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: "#fafaf8", borderRadius: 20, padding: "28px 24px", border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: ACCENT + "15", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">{f.svg}</svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#777", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#1a1a1a", color: "#888", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h12" /></svg>
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>MenuFlow</span>
        </div>
        <span style={{ fontSize: 13 }}>© {new Date().getFullYear()} MenuFlow · Algeria</span>
        <div style={{ display: "flex", gap: 24 }}>
          {["Privacy", "Terms", "Contact"].map((l) => (
            <a key={l} href="#" style={{ fontSize: 13, color: "#888", textDecoration: "none" }}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
