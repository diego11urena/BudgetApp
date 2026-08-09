import { beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./gmail-crypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

beforeEach(() => {
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

describe("encryptToken / decryptToken", () => {
  it("round-trips a plaintext string", () => {
    const plaintext = "1//0gLONG-REFRESH-TOKEN-STRING";
    const ciphertext = encryptToken(plaintext);
    expect(decryptToken(ciphertext)).toBe(plaintext);
  });

  it("round-trips a string containing non-ASCII characters", () => {
    const plaintext = "token-with-ñ-and-emoji-🔒";
    expect(decryptToken(encryptToken(plaintext))).toBe(plaintext);
  });

  it("produces different ciphertext on repeated calls with the same plaintext (random IV)", () => {
    const plaintext = "same-input-both-times";
    const a = encryptToken(plaintext);
    const b = encryptToken(plaintext);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plaintext);
    expect(decryptToken(b)).toBe(plaintext);
  });

  it("throws when decrypting tampered ciphertext (auth tag check fails)", () => {
    const ciphertext = encryptToken("sensitive-value");
    const bytes = Buffer.from(ciphertext, "base64");
    bytes[bytes.length - 1] ^= 0xff; // flip a bit in the ciphertext
    const tampered = bytes.toString("base64");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws a clear error when the encryption key env var is missing", () => {
    delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("x")).toThrow(/GMAIL_TOKEN_ENCRYPTION_KEY/);
  });

  it("throws a clear error when the encryption key is the wrong length", () => {
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptToken("x")).toThrow(/32 bytes/);
  });
});
