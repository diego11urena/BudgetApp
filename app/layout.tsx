import type { Metadata, Viewport } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeScript } from "./_components/ThemeScript";
import { THEME_COOKIE, THEME_VALUES, type ThemePreferenceValue } from "@/lib/theme";
import { LocaleProvider } from "./_components/LocaleProvider";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocaleValue, type LocaleValue } from "@/lib/i18n/locale";

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
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
