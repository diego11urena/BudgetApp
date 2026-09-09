"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * The outgoing half of the Summary -> Breakdown takeover: fade/scale the
 * current page out, then navigate, letting the destination play its own
 * wipe-in on mount (see BreakdownScreenNew's effect).
 *
 * A real <Link>, not a <button> -- it's a navigation, so it needs an href
 * that cmd-click, middle-click, "copy link address" and assistive tech can
 * all see, plus Next's own viewport prefetching (prefetching at click time,
 * as this did before, is too late to prevent the blank flash it was meant
 * to avoid). Modified clicks are left entirely alone so the browser can
 * open them in a new tab.
 *
 * The .takeover-out class is ALWAYS cleaned up on a timer, and on unmount.
 * It animates with `forwards`, so a navigation that never completes (an
 * aborted route, a back-button, a failed fetch) would otherwise strand
 * <html> at opacity 0 -- an invisible app with no way to recover but a
 * reload.
 */
export default function PageTransitionLink({
  href,
  children,
  className,
  onTransitionStart,
  onTransitionEnd,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}) {
  const router = useRouter();
  const timers = useRef<number[]>([]);

  const clearTakeover = () => {
    document.documentElement.classList.remove("takeover-out");
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(window.clearTimeout);
      clearTakeover();
    };
  }, []);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle new-tab/new-window/download intents itself.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onTransitionStart?.();

    document.documentElement.classList.add("takeover-out");
    // 150ms matches the takeover-out keyframe duration.
    timers.current.push(
      window.setTimeout(() => {
        router.push(href);
        onTransitionEnd?.();
      }, 150),
    );
    // Safety net: whatever happens to the navigation above, the page never
    // stays stuck invisible.
    timers.current.push(window.setTimeout(clearTakeover, 1200));
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
