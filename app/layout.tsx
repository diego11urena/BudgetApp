import type { Metadata, Viewport } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
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
    <html lang="en" className={`${manrope.variable} ${sourceSans.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
