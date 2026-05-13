import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { setHtmlDir } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  useEffect(() => {
    setHtmlDir(i18n.language || "ar");
  }, [i18n.language]);

  const change = (lng: "ar" | "en" | "fr") => {
    i18n.changeLanguage(lng);
    setHtmlDir(lng);
    try {
      localStorage.setItem("lang", lng);
    } catch {}
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Language"
          className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition"
        >
          <Globe className="w-5 h-5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem onClick={() => change("ar")} className="cursor-pointer">
          🇸🇦 العربية {i18n.language?.startsWith("ar") && "✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("en")} className="cursor-pointer">
          🇬🇧 English {i18n.language?.startsWith("en") && "✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("fr")} className="cursor-pointer">
          🇫🇷 Français {i18n.language?.startsWith("fr") && "✓"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}