import { OAuth2Client } from "google-auth-library";
import { prisma } from "./prisma";
import { findCycleForDate, getOrCreateDraftCycle } from "./cycles";
import { decryptToken } from "./gmail-crypto";
import { parseTransactionEmail } from "./gmail-parsers";
import { isUniqueConstraintViolation } from "./prisma-errors";

/** Every sender address whose mail gets scanned for transactions — the bank (credit/debit card purchases) and Yappy (P2P sent/received). */
const BANK_SENDERS = ["transaccionesbg@bgeneral.com", "notificaciones@yappy.com.pa"];
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

// Gmail's per-user quota isn't documented anywhere in this codebase, so
// this is a conservative cap rather than a measured one — enough to turn a
// long sync from "one request at a time" into meaningfully parallel
// without risking a burst large enough to trip Google's rate limiting.
const MESSAGE_FETCH_CONCURRENCY = 5;

/** One item's outcome from mapWithConcurrency -- never a thrown rejection, so one item's failure can never propagate through the shared Promise.all and take down every other in-flight item. */
export type ConcurrentResult<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** Runs `fn` over `items` with at most `concurrency` in flight at once, preserving input order in the returned array. Each item's own failure is caught and reported per-item (see ConcurrentResult) rather than rejecting the whole batch -- a single bad message must not stop every other message in the same sync from importing. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<ConcurrentResult<R>[]> {
  const results: ConcurrentResult<R>[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = { ok: true, value: await fn(items[i]) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/** Pure — narrows a batch of candidate Gmail message ids down to the ones not already known. Split out from the rest of the sync so it's unit-testable without a database or a live Gmail connection. */
export function filterNewMessageIds(candidateIds: string[], knownIds: Set<string>): string[] {
  return candidateIds.filter((id) => !knownIds.has(id));
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessage {
  id: string;
  internalDate: string;
  payload: GmailMessagePart;
}

interface GmailListResponse {
  messages?: { id: string }[];
  nextPageToken?: string;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

/** Recursively searches a (possibly multipart) message body for the first part matching mimeType. */
function collectByMimeType(part: GmailMessagePart, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = collectByMimeType(child, mimeType);
    if (found) return found;
  }
  return null;
}

/** Prefers a plain-text part anywhere in the message; falls back to stripping tags from HTML. */
export function extractBodyText(payload: GmailMessagePart): string | null {
  const plain = collectByMimeType(payload, "text/plain");
  if (plain) return plain;
  const html = collectByMimeType(payload, "text/html");
  return html ? stripHtml(html) : null;
}

async function listMessageIds(client: OAuth2Client, afterEpochSeconds: number): Promise<string[]> {
  const senderQuery = BANK_SENDERS.map((sender) => `from:${sender}`).join(" OR ");
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await client.request<GmailListResponse>({
      url: `${GMAIL_API_BASE}/messages`,
      params: { q: `(${senderQuery}) after:${afterEpochSeconds}`, pageToken },
    });
    for (const m of res.data.messages ?? []) ids.push(m.id);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function getMessage(client: OAuth2Client, id: string): Promise<GmailMessage> {
  const res = await client.request<GmailMessage>({
    url: `${GMAIL_API_BASE}/messages/${id}`,
    params: { format: "full" },
  });
  return res.data;
}

/**
 * Merchant-name learning: if this user has ever categorized a transaction
 * with this exact name (case-insensitive) into a real category, reuse that
 * category for this newly-imported one instead of leaving it uncategorized
 * again. There's no separate mapping table -- a prior categorization *is*
 * the mapping, so editing a transaction's category anywhere in the app
 * (see updateTransactionAction/categorizeTransactionAction) is what teaches
 * this. Most-recently-used wins if a merchant was ever filed under more
 * than one category.
 */
async function findLearnedCategoryId(userId: string, merchant: string): Promise<string | null> {
  const match = await prisma.cycleTransaction.findFirst({
    where: {
      cycle: { userId },
      name: { equals: merchant, mode: "insensitive" },
      expenseCategoryId: { not: null },
    },
    orderBy: { occurredAt: "desc" },
    select: { expenseCategoryId: true },
  });
  return match?.expenseCategoryId ?? null;
}

/**
 * Forward-only sync window: syncs from the last successful sync, or from
 * when the connection was first created if this is the very first sync —
 * never backfills older mail. Pulled out as its own pure function so the
 * "which timestamp wins" rule is unit-testable without a database.
 */
export function syncWindowStartMs(connection: { lastSyncedAt: Date | null; createdAt: Date }): number {
  return (connection.lastSyncedAt ?? connection.createdAt).getTime();
}

/**
 * Recognizes the handful of well-known Google OAuth error shapes that mean
 * "the stored token itself is no good" (expired/revoked grant, corrupted or
 * mismatched encryption key) — the only case where telling the user to
 * reconnect is actually the right remedy. Exported and pure so the message
 * mapping is unit-testable without a live OAuth failure.
 */
export function isGmailAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("invalid_grant") ||
    message.includes("invalid_token") ||
    message.includes("unauthorized") ||
    message.includes("token has been expired or revoked") ||
    message.includes("decrypt")
  );
}

/**
 * The message stored in GmailConnection.lastSyncError and shown in the UI.
 * Deliberately does NOT suggest reconnecting except for a genuine auth
 * failure — reconnecting is only ever the right fix for that one case, and
 * previously this app told every user to reconnect regardless of cause,
 * which (before the syncWindowStartMs fix above) actively lost data by
 * jumping the sync window forward past whatever the real problem was.
 */
export function describeGmailSyncError(error: unknown): string {
  return isGmailAuthError(error)
    ? "Your Gmail connection has expired — reconnect to keep importing transactions."
    : "Gmail sync hit a temporary problem. We'll automatically try again next time you open the app.";
}

/**
 * Checks Gmail for new transaction-notification emails (bank card purchases,
 * Yappy sent/received) since the last sync and imports them as
 * transactions. Called from the app layout on every navigation (see
 * app/(app)/layout.tsx) — must never throw, since a revoked token or a
 * Gmail API hiccup can't be allowed to break page loads. No-ops immediately
 * if the user hasn't connected Gmail.
 */
export async function syncGmailTransactions(userId: string): Promise<void> {
  const connection = await prisma.gmailConnection.findUnique({ where: { userId } });
  if (!connection) return;

  try {
    const refreshToken = decryptToken(connection.encryptedRefreshToken);
    const client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    client.setCredentials({ refresh_token: refreshToken });

    // So connecting Gmail doesn't suddenly dump old purchases into whatever
    // cycle happens to be open right now.
    const sinceMs = syncWindowStartMs(connection);
    const candidateIds = await listMessageIds(client, Math.floor(sinceMs / 1000));

    // Tracks whether every candidate message was actually imported (or
    // legitimately skipped as a duplicate/non-transaction email) this run.
    // lastSyncedAt only advances when this stays true -- a partial failure
    // must not silently drop whichever messages never got processed, so
    // the next sync retries the *same* window instead (cheap: everything
    // already imported this run is skipped again via sourceMessageId
    // dedup, so only the genuinely-failed messages do real work twice).
    let allProcessed = true;

    if (candidateIds.length > 0) {
      const existing = await prisma.cycleTransaction.findMany({
        where: { sourceMessageId: { in: candidateIds } },
        select: { sourceMessageId: true },
      });
      const knownIds = new Set(
        existing.map((t) => t.sourceMessageId).filter((id): id is string => id !== null),
      );
      const newIds = filterNewMessageIds(candidateIds, knownIds);

      if (newIds.length > 0) {
        // Ensures at least one cycle exists (first-ever sync) and is the
        // fallback below for a message whose own date predates every cycle
        // the user has ever had -- each message's actual cycle is resolved
        // from its own occurredAt, not this one.
        const cycle = await getOrCreateDraftCycle(userId);
        // Per-sync cache so a merchant repeated across several messages in
        // one sync (e.g. two coffee runs) only costs one lookup query.
        const learnedCategoryCache = new Map<string, string | null>();

        // The Gmail fetch itself is the slow part and safe to parallelize
        // (each message.get is independent); the DB reads/writes below stay
        // sequential to avoid overwhelming Prisma's connection pool. Each
        // fetch's own failure is isolated (ConcurrentResult) rather than
        // aborting every other in-flight fetch in the same batch.
        const messageResults = await mapWithConcurrency(newIds, MESSAGE_FETCH_CONCURRENCY, (id) =>
          getMessage(client, id),
        );

        for (const messageResult of messageResults) {
          if (!messageResult.ok) {
            allProcessed = false;
            console.error("[gmail-sync] failed to fetch a message, will retry next sync:", messageResult.error);
            continue;
          }
          const message = messageResult.value;

          // Isolates the rest of this one message's processing (category
          // lookup + insert) so a failure here -- same reasoning as the
          // fetch step above -- skips only this message, not the whole
          // batch. Parsing itself never throws (parseTransactionEmail
          // returns null on no match), so this is really guarding the DB
          // calls, but wrapping the whole block keeps the isolation
          // guarantee obviously true by inspection rather than relying on
          // every future edit inside this block to preserve it.
          try {
            const body = extractBodyText(message.payload);
            const parsed = body ? parseTransactionEmail(body) : null;
            if (!parsed) continue;

            // Category and source are independent: category is "what it
            // was for" (left null -- never a fake stand-in -- until a real
            // match is learned or the user picks one), source is "how it
            // arrived" (always known for an import, shown as a separate
            // tag in the UI).
            let expenseCategoryId: string | null = null;
            if (parsed.type === "EXPENSE") {
              const merchantKey = parsed.merchant.toLowerCase();
              if (!learnedCategoryCache.has(merchantKey)) {
                learnedCategoryCache.set(merchantKey, await findLearnedCategoryId(userId, parsed.merchant));
              }
              expenseCategoryId = learnedCategoryCache.get(merchantKey) ?? null;
            }

            // The cycle this transaction belongs to is whichever one
            // actually covers when it happened, not whichever cycle
            // happens to be open at sync time -- the same rule
            // updateTransactionAction applies when a date changes. Usually
            // the same cycle (Gmail delivers these within seconds/minutes
            // of the purchase), but not when a sync runs late (the app
            // reopened days after a purchase) or backfills an older
            // message: without this, that transaction would silently land
            // in today's cycle instead of the one it was actually spent in.
            const occurredAt = new Date(Number(message.internalDate));
            const targetCycle = (await findCycleForDate(userId, occurredAt)) ?? cycle;

            await prisma.cycleTransaction.create({
              data: {
                cycleId: targetCycle.id,
                type: parsed.type,
                name: parsed.merchant,
                amount: parsed.amount,
                expenseCategoryId,
                importSource: "GMAIL",
                paymentMethod: parsed.paymentMethod,
                description: parsed.description,
                occurredAt,
                sourceMessageId: message.id,
              },
            });
          } catch (error) {
            if (isUniqueConstraintViolation(error)) {
              // Already imported (e.g. a race between two near-simultaneous
              // syncs) — the unique constraint on sourceMessageId is the
              // final backstop behind the knownIds pre-filter above. Not a
              // real failure, doesn't block lastSyncedAt from advancing.
              continue;
            }
            allProcessed = false;
            console.error("[gmail-sync] failed to import a message, will retry next sync:", error);
          }
        }
      }
    }

    // A partial per-item failure is deliberately NOT surfaced as
    // lastSyncError -- most or all of the batch likely still imported
    // successfully, so showing "Last sync failed" here would be both
    // alarming and wrong. It resolves itself silently on the next sync
    // (see allProcessed above), same as this codebase's existing
    // philosophy of failing open rather than escalating a partial,
    // self-healing hiccup into a user-facing error.
    if (allProcessed) {
      await prisma.gmailConnection.update({
        where: { userId },
        data: { lastSyncedAt: new Date(), lastSyncError: null },
      });
    }
  } catch (error) {
    console.error("[gmail-sync] sync failed:", error);
    await prisma.gmailConnection
      .update({ where: { userId }, data: { lastSyncError: describeGmailSyncError(error) } })
      .catch(() => {
        // If even recording the failure fails, there's nothing more to do —
        // this function must return normally either way.
      });
  }
}
