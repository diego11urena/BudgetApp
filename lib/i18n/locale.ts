/**
 * Shared between the root layout (reads the cookie server-side to resolve
 * which dictionary to render), the language-picker form on Profile (writes
 * it), and login/signup (sync the cookie to the account's real DB value on
 * sign-in). Lowercase, matching the cookie value directly -- the DB column
 * stores the uppercase Prisma enum instead (EN/ES); see setLocaleAction.
 *
 * Unlike theme, there's no "system" option here -- a browser's
 * Accept-Language header isn't read anywhere in this app, so there's
 * nothing to defer to. The only two states are an explicit choice (cookie
 * present) or the anonymous-visitor default (see DEFAULT_LOCALE below).
 */
export const LOCALE_COOKIE = "balboa-locale";

export const LOCALE_VALUES = ["en", "es"] as const;
export type LocaleValue = (typeof LOCALE_VALUES)[number];

export const LOCALE_LABEL: Record<LocaleValue, string> = {
  en: "English",
  es: "Español",
};

/**
 * What an anonymous visitor with no cookie yet sees (the landing page,
 * /login, /signup, /forgot-password) -- Spanish, since the app is built
 * for the Panama market. A brand-new signup with no prior preference
 * inherits this too (see signupAction); an EXISTING account never does,
 * since its DB row already has an explicit locale (defaulted to EN by the
 * migration that added this column -- see schema.prisma's own comment).
 */
export const DEFAULT_LOCALE: LocaleValue = "es";

export function isLocaleValue(value: unknown): value is LocaleValue {
  return typeof value === "string" && (LOCALE_VALUES as readonly string[]).includes(value);
}

/**
 * Shared by every server component/route that needs the dictionary but
 * isn't the root layout itself (which resolves this inline since it also
 * needs the value for the <html lang> attribute) -- one place reading the
 * cookie instead of each page re-deriving the same fallback logic.
 */
export async function getRequestLocale(): Promise<LocaleValue> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocaleValue(raw) ? raw : DEFAULT_LOCALE;
}
