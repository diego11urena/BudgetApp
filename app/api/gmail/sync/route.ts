import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGmailTransactions } from "@/lib/gmail-sync";
import { checkRateLimit } from "@/lib/rate-limit";

// One call per full page load (see GmailSyncTrigger) — this cap just
// guards against a misbehaving client retrying in a tight loop, not
// against normal browsing.
const GMAIL_SYNC_RATE_LIMIT = { max: 20, windowMs: 60_000 };

/**
 * Fired client-side on mount by GmailSyncTrigger, once per navigation into
 * the app shell — moved out of app/(app)/layout.tsx's render path so a
 * Gmail sync (previously a blocking `await`) can no longer hold up every
 * page load. syncGmailTransactions itself never throws (see its own
 * comment), so this always resolves; the client doesn't need the response
 * body, just to know when to stop showing "Syncing…" and refresh.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`gmail-sync:${session.user.id}`, GMAIL_SYNC_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  await syncGmailTransactions(session.user.id);
  return NextResponse.json({ ok: true });
}
