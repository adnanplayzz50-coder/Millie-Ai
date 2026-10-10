export type FontKey = "claude" | "grotesk" | "mono" | "lora" | "outfit";
export type PaletteKey = "violet" | "lavender" | "electric";
export type ThemeKey = "light" | "dark" | "system";

export interface Settings {
  font: FontKey;
  palette: PaletteKey;
  custom_color: string | null;
  theme: ThemeKey;
  wake_word: boolean;
  read_aloud: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  font: "claude",
  palette: "violet",
  custom_color: null,
  theme: "dark",
  wake_word: false,
  read_aloud: false,
};

export const FONTS: { key: FontKey; label: string; sample: string; family: string }[] = [
  { key: "claude", label: "Classic", sample: "Newsreader + Inter", family: "Newsreader, serif" },
  { key: "grotesk", label: "Space Grotesk", sample: "Geometric & crisp", family: "'Space Grotesk', sans-serif" },
  { key: "mono", label: "JetBrains Mono", sample: "Monospaced", family: "'JetBrains Mono', monospace" },
  { key: "lora", label: "Lora", sample: "Warm serif", family: "Lora, serif" },
  { key: "outfit", label: "Outfit", sample: "Soft & round", family: "Outfit, sans-serif" },
];

export const PALETTES: { key: PaletteKey; label: string; swatch: string }[] = [
  { key: "violet", label: "Deep violet", swatch: "oklch(0.5 0.2 295)" },
  { key: "lavender", label: "Soft lavender", swatch: "oklch(0.75 0.11 300)" },
  { key: "electric", label: "Electric purple", swatch: "oklch(0.6 0.28 305)" },
];

const LS_KEY = "millie-settings";

export function isDark(theme: ThemeKey) {
  if (theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return theme === "dark";
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  root.dataset.font = s.font;
  root.dataset.palette = s.palette;
  root.classList.toggle("dark", isDark(s.theme));
  if (s.custom_color) {
    root.style.setProperty("--primary", s.custom_color);
  } else {
    root.style.removeProperty("--primary");
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function cachedSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

/** Inline script that runs before paint to avoid a theme flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem('${LS_KEY}')||'{}');var r=document.documentElement;r.dataset.font=s.font||'claude';r.dataset.palette=s.palette||'violet';var t=s.theme||'dark';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)r.classList.add('dark');if(s.custom_color)r.style.setProperty('--primary',s.custom_color);}catch(e){document.documentElement.classList.add('dark')}})();`;
