"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/app/_components/LocaleProvider";

/** Shared shell for /login and /signup -- same layout, swapped copy, per the design system handoff's Auth screens section. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="auth-shell">
      <Link href="/" className="auth-back" aria-label={t.auth.backToHome}>
        <ChevronLeft size={22} aria-hidden="true" />
      </Link>
      <div className="auth-shell-header">
        <Image src="/balboa-logo.png" alt="" width={52} height={52} className="auth-logo" />
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
