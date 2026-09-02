import type { Metadata, Viewport } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeScript } from "./_components/ThemeScript";
import { THEME_COOKIE, THEME_VALUES, type ThemePreferenceValue } from "@/lib/theme";
import { LocaleProvider } from "./_components/LocaleProvider";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocaleValue, type LocaleValue } from "@/lib/i18n/locale";
import { auth } from "@/lib/auth";
import { getUserPayFrequency } from "@/lib/cycles";
import type { PayFrequency } from "@/lib/quincena-pace";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Body/UI text — Balboa design system (design.md), replacing Inter.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

async function resolveLocale(): Promise<LocaleValue> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocaleValue(raw) ? raw : DEFAULT_LOCALE;
}

/**
 * Unlike locale/theme, payFrequency has no cookie -- it only ever matters
 * once a request is already authenticated (see PayFrequencyRow's own doc
 * comment), so this is a DB read, not a cookie read. Anonymous/pre-auth
 * pages (landing, login, signup) get the "QUINCENAL" default, matching the
 * app's own branding and today's only cadence -- there's no real preference
 * to reflect yet for a visitor who hasn't signed up.
 */
async function resolvePayFrequency(): Promise<PayFrequency> {
  const session = await auth();
  if (!session?.user?.id) return "QUINCENAL";
  return getUserPayFrequency(session.user.id);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const description = locale === "es" ? "Una aplicación de presupuesto para Panamá." : "A budgeting app for Panama.";
  return {
    title: {
      template: "%s · Balboa",
      default: "Balboa",
    },
    description,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Balboa",
    },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#17395c",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeRaw = cookieStore.get(THEME_COOKIE)?.value;
  const storedTheme: ThemePreferenceValue = THEME_VALUES.includes(themeRaw as ThemePreferenceValue)
    ? (themeRaw as ThemePreferenceValue)
    : "system";
  const dataTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : undefined;

  const locale = await resolveLocale();
  const payFrequency = await resolvePayFrequency();

  return (
    <html
      lang={locale}
      data-theme={dataTheme}
      className={`${manrope.variable} ${sourceSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <LocaleProvider locale={locale} payFrequency={payFrequency}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
