import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Instagram, Facebook, MessageCircle, Star, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { MenuByQrResult } from "@/lib/menu.functions";

type SplashData = MenuByQrResult["restaurant"]["splash"];

type Props = {
  restaurant: { name: string; logo_url: string | null };
  splash: SplashData;
  onContinue: () => void;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return { r: 99, g: 102, b: 241 };
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function FeatureIcon({ name, color }: { name: string; color: string }) {
  const Icon =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[
      name
    ] ?? Sparkles;
  return <Icon className="w-4 h-4" style={{ color }} />;
}

export function RestaurantSplash({ restaurant, splash, onContinue }: Props) {
  const brand = splash.brand_color || "#7c5cff";
  const { r, g, b } = hexToRgb(brand);
  const rgba = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

  const [showCta, setShowCta] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowCta(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Mouse parallax
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = (e.clientX / w - 0.5) * 2;
      const y = (e.clientY / h - 0.5) * 2;
      setTilt({ x, y });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Device gyroscope
  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      const x = Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30));
      const y = Math.max(-1, Math.min(1, (e.beta ?? 0) / 60));
      setTilt({ x, y });
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  const hasSocial =
    splash.instagram_url || splash.facebook_url || splash.whatsapp_number;

  const waLink = splash.whatsapp_number
    ? `https://wa.me/${splash.whatsapp_number.replace(/\D/g, "")}`
    : null;

  return (
    <div
      ref={wrapRef}
      dir="rtl"
      className="fixed inset-0 z-50 overflow-hidden text-white"
      style={{ background: "#080808" }}
    >
      {/* Cover background (image or video) */}
      <div className="absolute inset-0">
        {splash.cover_type === "video" && splash.cover_video_url ? (
          <video
            src={splash.cover_video_url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-40"
          />
        ) : splash.cover_image_url ? (
          <img
            src={splash.cover_image_url}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.85) 60%, #080808 100%)",
          }}
        />
      </div>

      {/* Ambient orbs */}
      <motion.div
        aria-hidden
        className="absolute -top-40 -right-40 w-[34rem] h-[34rem] rounded-full blur-3xl"
        style={{ background: rgba(0.45) }}
        animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 -left-40 w-[36rem] h-[36rem] rounded-full blur-3xl"
        style={{ background: rgba(0.3) }}
        animate={{ x: [0, -25, 20, 0], y: [0, 20, -15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/3 left-1/4 w-[20rem] h-[20rem] rounded-full blur-3xl opacity-60"
        style={{ background: "rgba(255,255,255,0.04)" }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Noise texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 h-full w-full flex flex-col items-center justify-between px-6 py-10 max-w-md mx-auto"
        style={{ perspective: 1200 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, z: -300, scale: 0.6 }}
          animate={{ opacity: 1, z: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${tilt.x * 6}deg) rotateX(${-tilt.y * 6}deg)`,
          }}
          className="mt-6"
        >
          <div
            className="relative w-32 h-32 rounded-[2rem] overflow-hidden ring-1"
            style={{
              boxShadow: `0 30px 80px ${rgba(0.45)}, 0 0 0 1px rgba(255,255,255,0.08)`,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl font-black">
                {restaurant.name[0]}
              </div>
            )}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 50%)",
              }}
            />
          </div>
        </motion.div>

        {/* Name + tagline + description + chips */}
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full">
          <motion.h1
            initial={{ opacity: 0, y: 30, z: -100 }}
            animate={{ opacity: 1, y: 0, z: 0 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl font-black tracking-tight"
            style={{
              fontFamily: "'Cairo', sans-serif",
              fontWeight: 900,
              textShadow: `0 4px 30px ${rgba(0.5)}`,
            }}
          >
            {restaurant.name}
          </motion.h1>

          {splash.tagline && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="mt-3 text-lg font-extralight tracking-wide opacity-90"
              style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 200 }}
            >
              {splash.tagline}
            </motion.p>
          )}

          {splash.rating_count > 0 && splash.rating_avg !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.06)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold">{splash.rating_avg.toFixed(1)}</span>
              <span className="opacity-70 text-sm">·</span>
              <span className="opacity-80 text-sm">
                {splash.rating_count} تقييم
              </span>
            </motion.div>
          )}

          {splash.description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6 }}
              className="mt-5 max-w-sm text-sm leading-relaxed opacity-75 font-light"
              style={{ fontFamily: "'Cairo', sans-serif" }}
            >
              {splash.description}
            </motion.p>
          )}

          {splash.features.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="mt-6 flex flex-wrap items-center justify-center gap-2"
            >
              {splash.features.map((f, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${rgba(0.25)}`,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <FeatureIcon name={f.icon} color={brand} />
                  <span>{f.text}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Bottom: socials + CTA */}
        <div className="w-full flex flex-col items-center gap-5">
          {hasSocial && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.5 }}
              className="flex items-center gap-2.5"
            >
              {splash.instagram_url && (
                <a
                  href={splash.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium hover:scale-105 transition"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <Instagram className="w-4 h-4" />
                  <span>Instagram</span>
                </a>
              )}
              {splash.facebook_url && (
                <a
                  href={splash.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium hover:scale-105 transition"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <Facebook className="w-4 h-4" />
                  <span>Facebook</span>
                </a>
              )}
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium hover:scale-105 transition"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp</span>
                </a>
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {showCta && (
              <motion.button
                key="cta"
                initial={{ opacity: 0, y: 30, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                onClick={onContinue}
                whileTap={{ scale: 0.96 }}
                className="relative overflow-hidden w-full max-w-xs h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 group"
                style={{
                  background: `linear-gradient(135deg, ${brand}, ${rgba(0.7)})`,
                  boxShadow: `0 12px 40px ${rgba(0.55)}, inset 0 1px 0 rgba(255,255,255,0.25)`,
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <span className="relative z-10">انتقل للمنيو</span>
                <ArrowLeft className="relative z-10 w-5 h-5 transition-transform group-hover:-translate-x-1" />
                {/* shimmer */}
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 -inset-x-full w-1/2 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)",
                  }}
                  animate={{ x: ["0%", "300%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
