"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/app/_components/LocaleProvider";

// Re-syncs on mount and whenever the tab becomes visible again after sitting
// idle for SYNC_INTERVAL_MS. The timestamp lives in sessionStorage so a full
// reload within the same tab doesn't re-trigger it either. (Previously a
// one-shot boolean flag: a tab left open never synced again.)
const SESSION_KEY = "balboa:gmail-last-sync-at";
const SYNC_INTERVAL_MS = 10 * 60_000;

function isStale(): boolean {
  const last = Number(sessionStorage.getItem(SESSION_KEY));
  return !last || Date.now() - last > SYNC_INTERVAL_MS;
}

/**
 * Fires the Gmail sync (non-blocking; see app/api/gmail/sync/route.ts) on
 * mount and again when the tab regains focus after SYNC_INTERVAL_MS. Only
 * mounted when the layout already knows the user has a Gmail connection.
 */
export function GmailSyncTrigger() {
  const router = useRouter();
  const t = useT();
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    function sync() {
      if (inFlight.current || !isStale()) return;
      inFlight.current = true;
      setSyncing(true);
      fetch("/api/gmail/sync", { method: "POST" })
        .then((res) => {
          // Stamp regardless of res.ok -- a failed sync is recorded server-side
          // (GmailConnection.lastSyncError) and surfaced on Profile; the next
          // interval retries it.
          sessionStorage.setItem(SESSION_KEY, String(Date.now()));
          if (res.ok) router.refresh();
        })
        .catch(() => sessionStorage.setItem(SESSION_KEY, String(Date.now())))
        .finally(() => {
          inFlight.current = false;
          setSyncing(false);
        });
    }
    function onVisible() {
      if (document.visibilityState === "visible") sync();
    }
    sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!syncing) return null;
  return (
    <div className="gmail-sync-indicator" role="status" aria-live="polite">
      {t.profile.gmail.syncing}
    </div>
  );
}
