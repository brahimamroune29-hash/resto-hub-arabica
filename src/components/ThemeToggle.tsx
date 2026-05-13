import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t("theme.enableLight") : t("theme.enableDark")}
      title={isDark ? t("theme.light") : t("theme.dark")}
      className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition text-muted-foreground"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
