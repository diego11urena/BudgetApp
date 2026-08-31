import type { Metadata, Viewport } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeScript } from "./_components/ThemeScript";
import { THEME_COOKIE, THEME_VALUES, type ThemePreferenceValue } from "@/lib/theme";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Body/UI text — Balboa design system (design.md), replacing Inter.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · Balboa",
    default: "Balboa",
  },
  description: "A budgeting app for Panama.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Balboa",
  },
};

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
  const raw = cookieStore.get(THEME_COOKIE)?.value;
  const stored: ThemePreferenceValue = THEME_VALUES.includes(raw as ThemePreferenceValue)
    ? (raw as ThemePreferenceValue)
    : "system";
  const dataTheme = stored === "light" || stored === "dark" ? stored : undefined;

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      className={`${manrope.variable} ${sourceSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
