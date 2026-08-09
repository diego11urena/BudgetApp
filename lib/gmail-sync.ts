import { OAuth2Client } from "google-auth-library";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "./prisma";
import { getOrCreateDraftCycle } from "./cycles";
import { getOrCreateCategory } from "./categories";
import { decryptToken } from "./gmail-crypto";
import { parseTransactionEmail } from "./gmail-parsers";

const BANK_SENDER = "transaccionesbg@bgeneral.com";
const IMPORT_CATEGORY_NAME = "Bank Import";
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
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await client.request<GmailListResponse>({
      url: `${GMAIL_API_BASE}/messages`,
      params: { q: `from:${BANK_SENDER} after:${afterEpochSeconds}`, pageToken },
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

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Checks Gmail for new purchase-notification emails from the bank since the
 * last sync and imports them as transactions. Called from the app layout on
 * every navigation (see app/(app)/layout.tsx) — must never throw, since a
 * revoked token or a Gmail API hiccup can't be allowed to break page loads.
 * No-ops immediately if the user hasn't connected Gmail.
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

    // Forward-only: sync from the last check, or from when the connection
    // was created if this is the first sync — never backfills older mail,
    // so connecting Gmail doesn't suddenly dump old purchases into whatever
    // cycle happens to be open right now.
    const sinceMs = (connection.lastSyncedAt ?? connection.createdAt).getTime();
    const candidateIds = await listMessageIds(client, Math.floor(sinceMs / 1000));

    if (candidateIds.length > 0) {
      const existing = await prisma.cycleTransaction.findMany({
        where: { sourceMessageId: { in: candidateIds } },
        select: { sourceMessageId: true },
      });
      const knownIds = new Set(
        existing.map((t) => t.sourceMessageId).filter((id): id is string => id !== null),
      );

      for (const id of filterNewMessageIds(candidateIds, knownIds)) {
        const message = await getMessage(client, id);
        const body = extractBodyText(message.payload);
        const parsed = body ? parseTransactionEmail(body) : null;
        if (!parsed) continue;

        const cycle = await getOrCreateDraftCycle(userId);
        const category = await getOrCreateCategory(prisma, userId, IMPORT_CATEGORY_NAME, "EXPENSE");

        try {
          await prisma.cycleTransaction.create({
            data: {
              cycleId: cycle.id,
              type: parsed.type,
              name: parsed.merchant,
              amount: parsed.amount,
              expenseCategoryId: category.id,
              occurredAt: new Date(Number(message.internalDate)),
              sourceMessageId: message.id,
            },
          });
        } catch (error) {
          if (!isUniqueConstraintViolation(error)) throw error;
          // Already imported (e.g. a race between two near-simultaneous
          // syncs) — the unique constraint on sourceMessageId is the final
          // backstop behind the knownIds pre-filter above.
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
