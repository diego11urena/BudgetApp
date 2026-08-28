"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Once per browser session/tab, not once per navigation -- see the Balboa
// fix list's batch 11.7. This layout (and this component) doesn't remount
// on client-side route changes, so a plain mount-once effect already
// covers "once per session" as long as the tab stays open; the
// sessionStorage flag additionally survives a full page reload within
// that same tab, so reloading /transactions doesn't re-trigger it either.
const SESSION_FLAG = "balboa:gmail-synced-this-session";

/**
 * Fires the Gmail sync once per session -- the same "await
 * syncGmailTransactions(userId) directly in render" this used to do (see
 * app/api/gmail/sync/route.ts), just non-blocking and no longer repeated
 * on every route change. Only mounted when the layout already knows the
 * user has a Gmail connection, so unconnected users never see it or pay
 * for the round trip.
 */
export function GmailSyncTrigger() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_FLAG) !== "true",
  );

  useEffect(() => {
    if (!syncing) return;
    let cancelled = false;
    fetch("/api/gmail/sync", { method: "POST" })
      .then((res) => {
        if (cancelled) return;
        // Set regardless of res.ok -- a failed sync is recorded server-side
        // (GmailConnection.lastSyncError) and surfaced on Profile; retrying
        // it again on every subsequent navigation within the same session
        // would just repeat the same failure.
        sessionStorage.setItem(SESSION_FLAG, "true");
        if (res.ok) router.refresh();
      })
      .catch(() => {
        if (!cancelled) sessionStorage.setItem(SESSION_FLAG, "true");
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
