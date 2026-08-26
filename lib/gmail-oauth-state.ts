import { createHmac, timingSafeEqual } from "crypto";

// Generous enough for a user to complete Google's consent screen, short
// enough that an old /connect link can't be replayed much later.
const STATE_TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  // Its own secret, not AUTH_SECRET (which signs session cookies) --
  // key separation is cheap even with no practical cross-protocol attack
  // today. Falls back to AUTH_SECRET so an existing deployment that
  // hasn't set GMAIL_OAUTH_STATE_SECRET yet keeps working unchanged.
  const secret = process.env.GMAIL_OAUTH_STATE_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("GMAIL_OAUTH_STATE_SECRET (or AUTH_SECRET) is not set");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Binds a Gmail OAuth flow to the userId that started it, so the callback
 * can't be tricked into attaching Gmail access to a different account (a
 * state-fixation/CSRF concern) — there's no Auth.js adapter/Account model in
 * this app to lean on for that, so this is hand-rolled: an HMAC-signed,
 * time-limited token carrying the userId, verified in the callback route.
 */
export function signGmailOAuthState(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const encodedPayload = Buffer.from(payload, "utf-8").toString("base64url");
  return `${encodedPayload}.${sign(payload)}`;
}

/** Returns the userId if the state is validly signed and not expired, otherwise null. */
export function verifyGmailOAuthState(state: string): string | null {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) return null;

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf-8");

  const expected = Buffer.from(sign(payload), "hex");
  const actual = Buffer.from(signature, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const [userId, timestampStr] = payload.split(":");
  const timestamp = Number(timestampStr);
  if (!userId || !Number.isFinite(timestamp)) return null;
  if (Date.now() - timestamp > STATE_TTL_MS) return null;

  return userId;
}
