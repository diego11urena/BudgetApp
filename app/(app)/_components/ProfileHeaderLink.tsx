"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";

/**
 * A persistent way into Profile from every page -- Profile itself isn't a
 * bottom-nav tab (see BottomNav's own comment: it holds Categories/Income/
 * Gmail/History/Erase, none of which are frequent enough to earn a slot),
 * but before this it was only reachable from Home's own header, making it
 * invisible from /transactions, /plan, and /history. See the Balboa fix
 * list's batch 11.3. Hidden on /dashboard (whose own Header already
 * renders this exact link) and on /profile itself (no reason to link to
 * the page you're already on).
 */
export function ProfileHeaderLink() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/profile")) return null;

  return (
    <div className="app-topbar">
      <Link href="/profile" className="home-profile-icon" aria-label="Profile">
        <User size={22} aria-hidden="true" />
      </Link>
    </div>
  );
}
