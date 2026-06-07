import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
      { title: "أربيكا — مطعم جزائري أصيل" },
      {
        name: "description",
        content: "مطعم أربيكا — أكل جزائري أصيل بنكهة تراثية. اطلب الآن أو تفضل بزيارتنا.",
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

const RED = "#DC2626";
const RED_DARK = "#B91C1C";
const RED_LIGHT = "#FEF2F2";
const FONT = "'Cairo', sans-serif";

const dishes = [
  { icon: "🥘", name: "الشخشوخة", desc: "طبق جزائري تقليدي بنكهة أصيلة" },
  { icon: "🍖", name: "المشاوي", desc: "لحوم مشوية على الفحم بتوابل خاصة" },
  { icon: "🥙", name: "الكفتة", desc: "كفتة طرية بصلصة البيت" },
  { icon: "🍵", name: "الشاي بالنعناع", desc: "شاي مغربي طازج بالنعناع الطبيعي" },
  { icon: "🥗", name: "السلطة الطازجة", desc: "خضروات طازجة بزيت الزيتون" },
  { icon: "🍞", name: "الخبز الجزائري", desc: "خبز مخبوز يومياً في المطعم" },
];

const socials = [
  {
    name: "Instagram",
    handle: "@arabica.resto",
    url: "https://www.instagram.com/arabica.resto/",
    color: "#E1306C",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    name: "Facebook",
    handle: "أربيكا",
    url: "https://www.facebook.com/arabica.resto",
    color: "#1877F2",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    name: "TikTok",
    handle: "@arabica.resto",
    url: "https://www.tiktok.com/@arabica.resto",
    color: "#000000",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.21 8.21 0 004.8 1.54V7.01a4.85 4.85 0 01-1.03-.32z"/>
      </svg>
    ),
  },
];

function ArabicaLogo({ size = 56 }: { size?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        background: RED,
        border: "3px solid #000",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 6px 24px ${RED}66`,
        flexShrink: 0,
      }}>
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="20" fill={RED} />
          <ellipse cx="20" cy="26" rx="10" ry="7" fill="#FBBF7A" />
          <ellipse cx="20" cy="18" rx="8" ry="9" fill="#FBBF7A" />
          <ellipse cx="20" cy="14" rx="9" ry="5" fill="white" />
          <ellipse cx="20" cy="11" rx="7" ry="4" fill="white" />
          <rect x="13" y="10" width="14" height="6" rx="3" fill="white" />
          <ellipse cx="17" cy="21" rx="1.5" ry="1.5" fill="#333" />
          <ellipse cx="23" cy="21" rx="1.5" ry="1.5" fill="#333" />
          <path d="M17 24.5 Q20 26.5 23 24.5" stroke="#333" strokeWidth="1" fill="none" strokeLinecap="round" />
          <rect x="15" y="28" width="10" height="4" rx="2" fill="white" />
          <path d="M14 29 Q10 31 12 35" stroke="#8B5E3C" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M26 29 Q30 31 28 35" stroke="#8B5E3C" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function Landing() {
  const [bannerIdx, setBannerIdx] = useState(0);

  const banners = [
    {
      title: "أكل جزائري أصيل",
      sub: "وصفات تراثية بأيدي طهاة متمرسين",
      bg: "linear-gradient(135deg, #1a0000 0%, #3b0000 50%, #000 100%)",
      emoji: "🥘",
    },
    {
      title: "عروض اليوم",
      sub: "وجبات خاصة بأسعار مميزة كل يوم",
      bg: "linear-gradient(135deg, #000 0%, #1a0000 50%, #3b0000 100%)",
      emoji: "🍖",
    },
    {
      title: "تجربة لا تُنسى",
      sub: "أجواء دافئة وخدمة راقية",
      bg: "linear-gradient(135deg, #0d0d0d 0%, #2d0000 50%, #1a0000 100%)",
      emoji: "✨",
    },
  ];

  useEffect(() => {
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes arb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes arb-fadein { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
      @keyframes arb-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      @keyframes arb-slide { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
      .arb-float { animation: arb-float 4s ease-in-out infinite; }
      .arb-fadein { animation: arb-fadein 0.7s ease both; }
      .arb-slide { animation: arb-slide 0.5s ease both; }
      .arb-card:hover { transform: translateY(-5px); box-shadow: 0 20px 48px rgba(220,38,38,0.18) !important; border-color: ${RED} !important; }
      .arb-social:hover { transform: scale(1.06); }
      .arb-btn-red:hover { background: ${RED_DARK} !important; transform: translateY(-2px); box-shadow: 0 8px 24px ${RED}66 !important; }
      .arb-btn-outline:hover { background: rgba(220,38,38,0.08) !important; border-color: ${RED} !important; color: ${RED} !important; }
      .arb-dot { width:10px;height:10px;border-radius:50%;background:#ffffff44;cursor:pointer;transition:all 0.2s; }
      .arb-dot.active { background:${RED};transform:scale(1.3); }
      @media (max-width: 800px) {
        .arb-hide-mobile { display: none !important; }
        .arb-hero-title { font-size: 36px !important; }
        .arb-dishes-grid { grid-template-columns: 1fr 1fr !important; }
        .arb-socials-grid { grid-template-columns: 1fr !important; }
        .arb-hero-flex { flex-direction: column !important; gap: 32px !important; }
      }
      @media (max-width: 500px) {
        .arb-dishes-grid { grid-template-columns: 1fr !important; }
        .arb-hero-title { font-size: 28px !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const banner = banners[bannerIdx];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#0d0d0d", fontFamily: FONT, color: "#fff" }}>

      {/* ─── NAV ─── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(13,13,13,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${RED}33`,
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 68,
      }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <ArabicaLogo size={44} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#fff", letterSpacing: 1, lineHeight: 1 }}>ARABICA</div>
            <div style={{ fontSize: 10, color: RED, fontWeight: 700, letterSpacing: 2 }}>أربيكا</div>
          </div>
        </a>

        <div className="arb-hide-mobile" style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[
            { label: "القائمة", href: "#menu" },
            { label: "عن المطعم", href: "#about" },
            { label: "تواصل معنا", href: "#contact" },
          ].map((l) => (
            <a key={l.label} href={l.href} style={{ fontSize: 15, fontWeight: 600, color: "#d1d5db", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = RED)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
            >{l.label}</a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            to="/login"
            className="arb-btn-outline"
            style={{
              background: "transparent", color: "#d1d5db",
              textDecoration: "none", border: "1.5px solid #374151",
              borderRadius: 100, padding: "9px 20px", fontSize: 13,
              fontWeight: 700, transition: "all 0.2s",
            }}
          >
            تسجيل الدخول
          </Link>
          <Link
            to="/signup"
            className="arb-btn-red"
            style={{
              background: RED, color: "#fff", textDecoration: "none",
              borderRadius: 100, padding: "9px 20px", fontSize: 13,
              fontWeight: 700, transition: "all 0.2s",
              boxShadow: `0 4px 14px ${RED}44`,
            }}
          >
            إنشاء حساب
          </Link>
        </div>
      </nav>

      {/* ─── HERO BANNER ─── */}
      <section style={{
        background: banner.bg,
        padding: "80px 32px 60px",
        position: "relative", overflow: "hidden",
        transition: "background 0.8s ease",
        borderBottom: `1px solid ${RED}33`,
      }}>
        <div aria-hidden style={{ position: "absolute", top: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: `${RED}08`, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: -80, right: -80, width: 350, height: 350, borderRadius: "50%", background: `${RED}05`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div className="arb-hero-flex" style={{ display: "flex", alignItems: "center", gap: 60 }}>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div className="arb-fadein" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: `${RED}22`, border: `1px solid ${RED}44`,
                borderRadius: 100, padding: "5px 16px", fontSize: 12,
                fontWeight: 700, color: RED, marginBottom: 24,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: RED, display: "inline-block", animation: "arb-pulse 2s infinite" }} />
                مفتوح الآن
              </div>

              <h1 className="arb-hero-title arb-slide" style={{
                fontSize: 56, fontWeight: 900, lineHeight: 1.1,
                color: "#fff", marginBottom: 16, letterSpacing: -1,
              }}>
                {banner.title}
                <br />
                <span style={{ color: RED }}>{banner.sub.split(" ").slice(0, 2).join(" ")}</span>
                {" "}{banner.sub.split(" ").slice(2).join(" ")}
              </h1>

              <p style={{ fontSize: 16, color: "#9ca3af", marginBottom: 36, lineHeight: 1.8 }}>
                نظام إدارة مطعم أربيكا — سجّل دخولك أو أنشئ حساباً جديداً<br />
                لإدارة الطلبات والموظفين والمخزون بسهولة
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link
                  to="/signup"
                  className="arb-btn-red"
                  style={{
                    background: RED, color: "#fff", textDecoration: "none",
                    borderRadius: 100, padding: "14px 36px", fontSize: 16,
                    fontWeight: 800, boxShadow: `0 6px 24px ${RED}55`,
                    transition: "all 0.2s",
                  }}
                >
                  إنشاء حساب ←
                </Link>
                <Link
                  to="/login"
                  className="arb-btn-outline"
                  style={{
                    background: "transparent", color: "#d1d5db",
                    textDecoration: "none", border: "1.5px solid #374151",
                    borderRadius: 100, padding: "14px 32px", fontSize: 16,
                    fontWeight: 600, transition: "all 0.2s",
                  }}
                >
                  تسجيل الدخول
                </Link>
              </div>
            </div>

            {/* Logo float */}
            <div className="arb-float arb-hide-mobile" style={{ flexShrink: 0 }}>
              <ArabicaLogo size={200} />
              <div style={{
                textAlign: "center", marginTop: 12,
                fontWeight: 900, fontSize: 28,
                color: RED, letterSpacing: 4,
                fontFamily: "'Arial Black', sans-serif",
              }}>
                ARABICA
              </div>
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: "flex", gap: 8, marginTop: 40 }}>
            {banners.map((_, i) => (
              <button
                key={i}
                className={`arb-dot${i === bannerIdx ? " active" : ""}`}
                onClick={() => setBannerIdx(i)}
                style={{ border: "none", cursor: "pointer" }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section style={{ background: "#111", padding: "40px 32px", borderBottom: `1px solid #1f1f1f` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, textAlign: "center" }}>
          {[
            { val: "+٥٠٠٠", label: "زبون راضي" },
            { val: "+٣", label: "فروع" },
            { val: "١٠٠٪", label: "مكونات طازجة" },
            { val: "+٥", label: "سنوات خبرة" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 28, fontWeight: 900, color: RED }}>{s.val}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── MENU / DISHES ─── */}
      <section id="menu" style={{ background: "#0d0d0d", padding: "80px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>أشهى الأطباق</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>
              من قائمة أربيكا
            </h2>
          </div>

          <div className="arb-dishes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {dishes.map((d) => (
              <div
                key={d.name}
                className="arb-card"
                style={{
                  background: "#161616", border: "1.5px solid #1f1f1f",
                  borderRadius: 20, padding: "28px 22px",
                  transition: "all 0.25s", cursor: "default",
                }}
              >
                <div style={{ fontSize: 42, marginBottom: 16 }}>{d.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{d.name}</h3>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SOCIAL MEDIA ─── */}
      <section id="contact" style={{ background: "#111", padding: "80px 32px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: RED, letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>تواصل معنا</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: -1 }}>
              تابعنا على السوشيال ميديا
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280", marginTop: 12 }}>
              ابق على اطلاع بأحدث العروض والمستجدات
            </p>
          </div>

          <div className="arb-socials-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="arb-social"
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  background: "#161616", border: "1.5px solid #1f1f1f",
                  borderRadius: 16, padding: "20px 18px",
                  textDecoration: "none", transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = s.color;
                  e.currentTarget.style.background = `${s.color}11`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#1f1f1f";
                  e.currentTarget.style.background = "#161616";
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `${s.color}22`, color: s.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{s.handle}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section id="about" style={{
        background: `linear-gradient(135deg, ${RED_DARK} 0%, #7f1d1d 100%)`,
        padding: "80px 32px", textAlign: "center",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🥘</div>
          <h2 style={{ fontSize: 38, fontWeight: 900, color: "#fff", marginBottom: 16, letterSpacing: -1 }}>
            أكل أصيل… بنكهة جزائرية
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)", lineHeight: 1.9, marginBottom: 36 }}>
            في مطعم أربيكا نؤمن أن الطعام الجيد يجمع الناس.
            وصفاتنا التراثية مُعدَّة بعناية من خيرة المكونات الجزائرية
            لتقديم تجربة لا تُنسى في كل وجبة.
          </p>
          <a
            href="https://www.instagram.com/arabica.resto/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block", background: "#fff", color: RED_DARK,
              textDecoration: "none", borderRadius: 100,
              padding: "15px 48px", fontSize: 16, fontWeight: 900,
              boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
            }}
          >
            تابعنا على إنستغرام ←
          </a>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        background: "#080808",
        borderTop: `1px solid #1f1f1f`,
        padding: "32px",
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ArabicaLogo size={36} />
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 16, letterSpacing: 1 }}>ARABICA</div>
            <div style={{ color: "#6b7280", fontSize: 11 }}>مطعم جزائري أصيل</div>
          </div>
        </div>
        <span style={{ fontSize: 13, color: "#374151" }}>© {new Date().getFullYear()} أربيكا · الجزائر</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="https://www.instagram.com/arabica.resto/" target="_blank" rel="noopener noreferrer"
            style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#E1306C")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >Instagram</a>
          <Link to="/login" style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>
            دخول الموظفين
          </Link>
        </div>
      </footer>
    </div>
  );
}
