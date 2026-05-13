import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <Link
        to="/"
        className="mb-8 text-2xl font-bold text-primary hover:opacity-80 transition-opacity"
      >
        {t("seo.tagline")}
      </Link>
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-md border border-border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}