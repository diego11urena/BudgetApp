import { OAuth2Client } from "google-auth-library";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "./prisma";
import { getOrCreateDraftCycle } from "./cycles";
import { decryptToken } from "./gmail-crypto";
import { parseTransactionEmail } from "./gmail-parsers";

/** Every sender address whose mail gets scanned for transactions — the bank (credit/debit card purchases) and Yappy (P2P sent/received). */
const BANK_SENDERS = ["transaccionesbg@bgeneral.com", "notificaciones@yappy.com.pa"];
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

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

/** Exported so its P2002-detection rule is unit-testable without a live DB connection. */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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
        // Resolved once per sync, not once per message -- always resolves
        // to the same row within a single sync (the draft cycle doesn't
        // change mid-loop).
        const cycle = await getOrCreateDraftCycle(userId);
        // Per-sync cache so a merchant repeated across several messages in
        // one sync (e.g. two coffee runs) only costs one lookup query.
        const learnedCategoryCache = new Map<string, string | null>();

        for (const id of newIds) {
          const message = await getMessage(client, id);
          const body = extractBodyText(message.payload);
          const parsed = body ? parseTransactionEmail(body) : null;
          if (!parsed) continue;

          // Category and source are independent: category is "what it was
          // for" (left null -- never a fake stand-in -- until a real match
          // is learned or the user picks one), source is "how it arrived"
          // (always known for an import, shown as a separate tag in the UI).
          let expenseCategoryId: string | null = null;
          if (parsed.type === "EXPENSE") {
            const merchantKey = parsed.merchant.toLowerCase();
            if (!learnedCategoryCache.has(merchantKey)) {
              learnedCategoryCache.set(merchantKey, await findLearnedCategoryId(userId, parsed.merchant));
            }
            expenseCategoryId = learnedCategoryCache.get(merchantKey) ?? null;
          }

          try {
            await prisma.cycleTransaction.create({
              data: {
                cycleId: cycle.id,
                type: parsed.type,
                name: parsed.merchant,
                amount: parsed.amount,
                expenseCategoryId,
                source: parsed.source === "yappy" ? "YAPPY" : "BANK_IMPORT",
                occurredAt: new Date(Number(message.internalDate)),
                sourceMessageId: message.id,
              },
            });
          } catch (error) {
            if (!isUniqueConstraintViolation(error)) throw error;
            // Already imported (e.g. a race between two near-simultaneous
            // syncs) — the unique constraint on sourceMessageId is the
            // final backstop behind the knownIds pre-filter above.
          }
        }
      }
    }

    await prisma.gmailConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await prisma.gmailConnection
      .update({ where: { userId }, data: { lastSyncError: message } })
      .catch(() => {
        // If even recording the failure fails, there's nothing more to do —
        // this function must return normally either way.
      });
  }
}
