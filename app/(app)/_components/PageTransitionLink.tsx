"use client";

import { useRouter } from "next/navigation";
import { ReactNode } from "react";

interface PageTransitionLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

export default function PageTransitionLink({
  href,
  children,
  className,
  onTransitionStart,
  onTransitionEnd,
}: PageTransitionLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    onTransitionStart?.();

    // Prefetch the destination to avoid blank flash.
    router.prefetch(href);

    // Add animation class to current page root.
    const root = document.documentElement;
    root.classList.add("takeover-out");

    // Navigate after animation completes.
    setTimeout(() => {
      router.push(href);
      onTransitionEnd?.();
    }, 150); // Match CSS animation duration.
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
