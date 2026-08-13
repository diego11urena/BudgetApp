import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
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
  title: "BudgetApp",
  description: "A budgeting app for Panama.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BudgetApp",
  },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#6c5ce7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${geistMono.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
