"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Fires the Gmail sync on every navigation into the app shell — the same
 * "on every navigation" behavior layout.tsx used to get for free by
 * `await`-ing syncGmailTransactions(userId) directly in its render path
 * (see app/api/gmail/sync/route.ts), just non-blocking now. Only mounted
 * when the layout already knows the user has a Gmail connection, so
 * unconnected users never see it or pay for the round trip.
 */
export function GmailSyncTrigger() {
  const pathname = usePathname();
  // Since this layout persists across client-side navigations rather than
  // remounting, keying the inner component on pathname forces a fresh
  // mount (and thus a fresh sync) on every new route, without needing to
  // call setSyncing(true) synchronously inside an effect body.
  return <GmailSyncOnMount key={pathname} />;
}

function GmailSyncOnMount() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gmail/sync", { method: "POST" })
      .then((res) => {
        // router.refresh() doesn't itself change pathname, so a successful
        // sync's refresh can't retrigger GmailSyncTrigger's key and loop.
        if (!cancelled && res.ok) router.refresh();
      })
      .catch(() => {
        // Failures are recorded server-side (GmailConnection.lastSyncError)
        // and surfaced on Profile — nothing actionable to do here.
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!syncing) return null;
  return (
    <div className="gmail-sync-indicator" role="status" aria-live="polite">
      Syncing…
    </div>
  );
}
