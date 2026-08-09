import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Encrypts the Gmail OAuth refresh token before it's stored — that token
 * grants ongoing read access to the user's mailbox, and once the app is
 * deployed this row lives in a third-party-hosted Postgres, not just the
 * user's own machine.
 *
 * The key is read lazily (not at module load) so importing this file never
 * crashes the app before Gmail integration has actually been set up —
 * GMAIL_TOKEN_ENCRYPTION_KEY only needs to exist once someone actually
 * connects Gmail, not for every ordinary page load.
 */
function getKey(): Buffer {
  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)");
  }
  return key;
}

/** Returns base64(iv || authTag || ciphertext) as a single storable string. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Reverses encryptToken. Throws if the ciphertext was tampered with (GCM auth-tag check fails). */
export function decryptToken(encoded: string): string {
  const combined = Buffer.from(encoded, "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = combined.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
