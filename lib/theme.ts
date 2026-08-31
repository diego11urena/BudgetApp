/**
 * Shared between the root layout (reads the cookie server-side to render
 * the initial [data-theme] attribute), the theme-picker form on Profile
 * (writes it), and the inline resolver script (reads it client-side to
 * decide what "system" currently means). Lowercase, matching the
 * [data-theme] attribute value directly -- the DB column stores the
 * uppercase Prisma enum instead (SYSTEM/LIGHT/DARK); see setThemeAction.
 */
export const THEME_COOKIE = "balboa-theme";

export const THEME_VALUES = ["system", "light", "dark"] as const;
export type ThemePreferenceValue = (typeof THEME_VALUES)[number];

export const THEME_LABEL: Record<ThemePreferenceValue, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
