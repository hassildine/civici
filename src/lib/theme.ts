/** Default sheet / UI accent when none is set. */
export const DEFAULT_ACCENT_COLOR = "#1865AD";

/** Marketing-style app chrome (neutral canvas + white main column). */
export const CIVICI_APP_SHELL_CLASS = "min-h-screen bg-neutral-50 p-4 md:p-6";
export const CIVICI_MAIN_COLUMN_CLASS =
  "flex-1 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8";
export const CIVICI_MAIN_COLUMN_CLASS_TALL =
  "flex-1 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:p-10";

const LEGACY_DEFAULT_ACCENT = "#2563eb";

/** Normalizes stored accent for UI (empty or legacy default → brand default). */
export function resolveSheetAccentColor(accent: string | undefined | null): string {
  const t = accent?.trim() ?? "";
  if (!t) return DEFAULT_ACCENT_COLOR;
  if (t.toLowerCase() === LEGACY_DEFAULT_ACCENT) return DEFAULT_ACCENT_COLOR;
  return t;
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const safe = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized;

  const value = Number.parseInt(safe, 16);
  if (Number.isNaN(value) || safe.length !== 6) {
    return `rgba(24, 101, 173, ${alpha})`;
  }

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
