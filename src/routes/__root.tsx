import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import "@/lib/i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { setHtmlDir } from "@/lib/i18n";
import { ThemeProvider } from "@/components/ThemeProvider";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <UtensilsCrossed className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">{t("notFound.title")}</h1>
        <p className="mt-3 text-muted-foreground">
          {t("notFound.desc")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "menuflow" },
      { name: "description", content: "Complete restaurant management: QR ordering, kitchen display, cashier system, analytics, and smart reviews." },
      { property: "og:title", content: "menuflow" },
      { property: "og:description", content: "Complete restaurant management: QR ordering, kitchen display, cashier system, analytics, and smart reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "menuflow" },
      { name: "twitter:description", content: "Complete restaurant management: QR ordering, kitchen display, cashier system, analytics, and smart reviews." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ApdJeilOd8YAfoLMjNk9U3Danmg1/social-images/social-1778679457869-ChatGPT_Image_May_6,_2026,_10_27_56_PM.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/ApdJeilOd8YAfoLMjNk9U3Danmg1/social-images/social-1778679457869-ChatGPT_Image_May_6,_2026,_10_27_56_PM.webp" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl");
  const [lang, setLang] = useState<string>("ar");
  useEffect(() => {
    const base = (i18n.language || "ar").split("-")[0];
    setLang(base);
    setDir(base === "ar" ? "rtl" : "ltr");
    setHtmlDir(base);
  }, [i18n.language]);
  return (
    <html lang={lang} dir={dir}>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('app-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}var l=localStorage.getItem('lang')||'ar';l=l.split('-')[0];document.documentElement.lang=l;document.documentElement.dir=(l==='ar')?'rtl':'ltr';}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!('serviceWorker' in navigator))return;var inIframe=true;try{inIframe=window.self!==window.top;}catch(e){inIframe=true;}var h=window.location.hostname;var preview=h.includes('lovableproject.com')||h.includes('lovable.app')&&h.includes('id-preview')||h==='localhost'||h==='127.0.0.1';if(inIframe||preview){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});return;}window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-center" dir={dir} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}
