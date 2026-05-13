export type MenuThemeId =
  | "classic_red"
  | "midnight_gold"
  | "ocean_fresh"
  | "forest_green"
  | "sunset_orange";

export type MenuLayoutId =
  | "large_cards"
  | "compact_list"
  | "photo_grid"
  | "featured_magazine"
  | "simple_catalog";

export type MenuTheme = {
  id: MenuThemeId;
  label: string;
  preview: string[]; // swatch colors for picker
  pageBg: string; // tailwind arbitrary class
  headerGradient: string; // from-... via-... to-...
  headerShadow: string;
  primary: string; // hex
  primaryDark: string; // hex
  primarySoftFrom: string; // soft chip bg from
  primarySoftTo: string; // soft chip bg to
};

export type MenuLayout = {
  id: MenuLayoutId;
  label: string;
  description: string;
  previewClass: string;
};

export type MenuAppearance = {
  theme: MenuThemeId;
  color: string;
  layout: MenuLayoutId;
  headerColor?: string;
  categoryColor?: string;
  buttonColor?: string;
};

export const MENU_THEMES: Record<MenuThemeId, MenuTheme> = {
  classic_red: {
    id: "classic_red",
    label: "كلاسيكي أحمر",
    preview: ["#E63946", "#D62828", "#9A1B1B", "#FFE5E5"],
    pageBg: "bg-[oklch(0.98_0.005_30)]",
    headerGradient: "from-[#E63946] via-[#D62828] to-[#9A1B1B]",
    headerShadow: "shadow-[0_8px_30px_-10px_rgba(214,40,40,0.5)]",
    primary: "#E63946",
    primaryDark: "#B91C1C",
    primarySoftFrom: "#FFE5E5",
    primarySoftTo: "#FFD1D1",
  },
  midnight_gold: {
    id: "midnight_gold",
    label: "ليل ذهبي فاخر",
    preview: ["#0d0d0d", "#1a1a1a", "#c9a84c", "#f0d78c"],
    pageBg: "bg-[#0d0d0d]",
    headerGradient: "from-[#1a1a1a] via-[#0d0d0d] to-[#000000]",
    headerShadow: "shadow-[0_8px_30px_-10px_rgba(201,168,76,0.4)]",
    primary: "#c9a84c",
    primaryDark: "#a8862c",
    primarySoftFrom: "#3a2f10",
    primarySoftTo: "#2a210a",
  },
  ocean_fresh: {
    id: "ocean_fresh",
    label: "محيط منعش",
    preview: ["#0c2340", "#1a4a6e", "#2d8a9e", "#5cbdb9"],
    pageBg: "bg-[oklch(0.98_0.01_220)]",
    headerGradient: "from-[#2d8a9e] via-[#1a4a6e] to-[#0c2340]",
    headerShadow: "shadow-[0_8px_30px_-10px_rgba(26,74,110,0.5)]",
    primary: "#1a4a6e",
    primaryDark: "#0c2340",
    primarySoftFrom: "#e0f0f5",
    primarySoftTo: "#c8e2ec",
  },
  forest_green: {
    id: "forest_green",
    label: "غابة طبيعية",
    preview: ["#1a3c2a", "#2d5a3d", "#5a8a5c", "#a0c49d"],
    pageBg: "bg-[oklch(0.98_0.01_140)]",
    headerGradient: "from-[#5a8a5c] via-[#2d5a3d] to-[#1a3c2a]",
    headerShadow: "shadow-[0_8px_30px_-10px_rgba(45,90,61,0.5)]",
    primary: "#2d5a3d",
    primaryDark: "#1a3c2a",
    primarySoftFrom: "#e3eee0",
    primarySoftTo: "#cde0c8",
  },
  sunset_orange: {
    id: "sunset_orange",
    label: "غروب برتقالي",
    preview: ["#ff6b35", "#f7931e", "#e84393", "#6c5ce7"],
    pageBg: "bg-[oklch(0.98_0.01_50)]",
    headerGradient: "from-[#ff6b35] via-[#f7931e] to-[#e84393]",
    headerShadow: "shadow-[0_8px_30px_-10px_rgba(255,107,53,0.5)]",
    primary: "#ff6b35",
    primaryDark: "#d94a14",
    primarySoftFrom: "#ffe5d9",
    primarySoftTo: "#ffd1bd",
  },
};

export const MENU_LAYOUTS: Record<MenuLayoutId, MenuLayout> = {
  large_cards: {
    id: "large_cards",
    label: "كروت كبيرة",
    description: "صور واسعة ومناسبة للأطباق المصورة",
    previewClass: "grid-cols-1",
  },
  compact_list: {
    id: "compact_list",
    label: "قائمة سريعة",
    description: "عرض مختصر وسريع للطلب",
    previewClass: "grid-cols-[1fr_3fr]",
  },
  photo_grid: {
    id: "photo_grid",
    label: "شبكة صور",
    description: "واجهة شبابية بصور مربعة",
    previewClass: "grid-cols-2",
  },
  featured_magazine: {
    id: "featured_magazine",
    label: "مجلة مميزة",
    description: "أول طبق كبير والباقي مختصر",
    previewClass: "grid-cols-[2fr_1fr]",
  },
  simple_catalog: {
    id: "simple_catalog",
    label: "كتالوج بسيط",
    description: "واضح وهادئ بدون ازدحام",
    previewClass: "grid-cols-1",
  },
};

export const DEFAULT_MENU_THEME: MenuThemeId = "classic_red";
export const DEFAULT_MENU_LAYOUT: MenuLayoutId = "large_cards";
export const DEFAULT_MENU_COLOR = MENU_THEMES[DEFAULT_MENU_THEME].primary;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isMenuThemeId(value: unknown): value is MenuThemeId {
  return typeof value === "string" && value in MENU_THEMES;
}

function isMenuLayoutId(value: unknown): value is MenuLayoutId {
  return typeof value === "string" && value in MENU_LAYOUTS;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

export function normalizeHexColor(value?: string | null, fallback: string = DEFAULT_MENU_COLOR): string {
  return isHexColor(value) ? value.toUpperCase() : fallback;
}

export function darkenHex(hex: string, amount = 0.22): string {
  const safe = normalizeHexColor(hex).slice(1);
  const next = [0, 2, 4]
    .map((i) => {
      const n = parseInt(safe.slice(i, i + 2), 16);
      return Math.max(0, Math.round(n * (1 - amount))).toString(16).padStart(2, "0");
    })
    .join("");
  return `#${next}`.toUpperCase();
}

export function softenHex(hex: string, mix = 0.86): string {
  const safe = normalizeHexColor(hex).slice(1);
  const next = [0, 2, 4]
    .map((i) => {
      const n = parseInt(safe.slice(i, i + 2), 16);
      return Math.min(255, Math.round(n * (1 - mix) + 255 * mix)).toString(16).padStart(2, "0");
    })
    .join("");
  return `#${next}`.toUpperCase();
}

export function getMenuTheme(id?: string | null): MenuTheme {
  const appearance = parseMenuAppearance(id);
  const base = MENU_THEMES[appearance.theme];
  const customColor = normalizeHexColor(appearance.color, base.primary);
  return {
    ...base,
    primary: customColor,
    primaryDark: darkenHex(customColor),
    primarySoftFrom: softenHex(customColor, 0.9),
    primarySoftTo: softenHex(customColor, 0.8),
  };
}

export type MenuColors = {
  header: string;
  headerDark: string;
  category: string;
  categoryDark: string;
  button: string;
  buttonDark: string;
  categorySoftFrom: string;
  categorySoftTo: string;
};

export function getMenuColors(id?: string | null): MenuColors {
  const a = parseMenuAppearance(id);
  const base = MENU_THEMES[a.theme];
  const main = normalizeHexColor(a.color, base.primary);
  const header = normalizeHexColor(a.headerColor, main);
  const category = normalizeHexColor(a.categoryColor, main);
  const button = normalizeHexColor(a.buttonColor, main);
  return {
    header,
    headerDark: darkenHex(header),
    category,
    categoryDark: darkenHex(category),
    button,
    buttonDark: darkenHex(button),
    categorySoftFrom: softenHex(category, 0.9),
    categorySoftTo: softenHex(category, 0.8),
  };
}

export function parseMenuAppearance(value?: string | null): MenuAppearance {
  if (!value) {
    return { theme: DEFAULT_MENU_THEME, color: DEFAULT_MENU_COLOR, layout: DEFAULT_MENU_LAYOUT };
  }

  if (isMenuThemeId(value)) {
    return { theme: value, color: MENU_THEMES[value].primary, layout: DEFAULT_MENU_LAYOUT };
  }

  try {
    const parsed = JSON.parse(value) as Partial<MenuAppearance>;
    const theme = isMenuThemeId(parsed.theme) ? parsed.theme : DEFAULT_MENU_THEME;
    const color = normalizeHexColor(parsed.color, MENU_THEMES[theme].primary);
    return {
      theme,
      color,
      layout: isMenuLayoutId(parsed.layout) ? parsed.layout : DEFAULT_MENU_LAYOUT,
      headerColor: normalizeHexColor(parsed.headerColor, color),
      categoryColor: normalizeHexColor(parsed.categoryColor, color),
      buttonColor: normalizeHexColor(parsed.buttonColor, color),
    };
  } catch {
    return { theme: DEFAULT_MENU_THEME, color: DEFAULT_MENU_COLOR, layout: DEFAULT_MENU_LAYOUT };
  }
}

export function serializeMenuAppearance(appearance: MenuAppearance): string {
  const theme = isMenuThemeId(appearance.theme) ? appearance.theme : DEFAULT_MENU_THEME;
  const layout = isMenuLayoutId(appearance.layout) ? appearance.layout : DEFAULT_MENU_LAYOUT;
  const color = normalizeHexColor(appearance.color, MENU_THEMES[theme].primary);
  return JSON.stringify({
    theme,
    color,
    layout,
    headerColor: normalizeHexColor(appearance.headerColor, color),
    categoryColor: normalizeHexColor(appearance.categoryColor, color),
    buttonColor: normalizeHexColor(appearance.buttonColor, color),
  });
}

export function isValidSerializedMenuAppearance(value: string): boolean {
  const parsed = parseMenuAppearance(value);
  return serializeMenuAppearance(parsed).length <= 600;
}
