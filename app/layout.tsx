import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

// Body/UI text — Balboa design system (design.md), replacing Inter.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

// Kept for the two numeric-tabular contexts (.hero-pace, .sheet-amount-input)
// — the design system doesn't specify a mono font, and dollar amounts
// benefit from monospace digit alignment regardless of the rest of the type system.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${sourceSans.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
