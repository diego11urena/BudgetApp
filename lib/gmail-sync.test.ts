import { describe, expect, it } from "vitest";
import {
  describeGmailSyncError,
  extractBodyText,
  filterNewMessageIds,
  isGmailAuthError,
  mapWithConcurrency,
  syncWindowStartMs,
} from "./gmail-sync";

describe("filterNewMessageIds", () => {
  it("keeps ids not present in the known set", () => {
    expect(filterNewMessageIds(["a", "b", "c"], new Set())).toEqual(["a", "b", "c"]);
  });

  it("drops ids already present in the known set", () => {
    expect(filterNewMessageIds(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
  });

  it("returns an empty array when every candidate is already known", () => {
    expect(filterNewMessageIds(["a", "b"], new Set(["a", "b"]))).toEqual([]);
  });

  it("returns an empty array for an empty candidate list", () => {
    expect(filterNewMessageIds([], new Set(["a"]))).toEqual([]);
  });
});

function base64url(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64url");
}

describe("extractBodyText", () => {
  it("decodes a simple text/plain payload", () => {
    const payload = { mimeType: "text/plain", body: { data: base64url("Hello world") } };
    expect(extractBodyText(payload)).toBe("Hello world");
  });

  it("finds a text/plain part nested inside a multipart payload, ignoring an accompanying HTML part", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: base64url("Plain version") } },
        { mimeType: "text/html", body: { data: base64url("<p>HTML version</p>") } },
      ],
    };
    expect(extractBodyText(payload)).toBe("Plain version");
  });

  it("finds text/plain even when it's listed after the HTML part", () => {
    const payload = {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: base64url("<p>HTML version</p>") } },
        { mimeType: "text/plain", body: { data: base64url("Plain version") } },
      ],
    };
    expect(extractBodyText(payload)).toBe("Plain version");
  });

  it("falls back to stripping tags from HTML when no plain-text part exists", () => {
    const payload = {
      mimeType: "text/html",
      body: { data: base64url("<p>Hello <b>world</b>&nbsp;!</p>") },
    };
    expect(extractBodyText(payload)).toBe(" Hello  world  ! ");
  });

  it("decodes UTF-8 correctly (no mangling of accented characters)", () => {
    const payload = { mimeType: "text/plain", body: { data: base64url("DIEGO UREÑA") } };
    expect(extractBodyText(payload)).toBe("DIEGO UREÑA");
  });

  it("returns null when no usable part exists", () => {
    const payload = { mimeType: "multipart/mixed", parts: [{ mimeType: "image/png", body: {} }] };
    expect(extractBodyText(payload)).toBeNull();
  });
});

describe("syncWindowStartMs", () => {
  it("uses lastSyncedAt when present, ignoring createdAt", () => {
    const lastSyncedAt = new Date(2026, 6, 15);
    const createdAt = new Date(2026, 0, 1);
    expect(syncWindowStartMs({ lastSyncedAt, createdAt })).toBe(lastSyncedAt.getTime());
  });

  it("falls back to createdAt on the very first sync (lastSyncedAt null)", () => {
    const createdAt = new Date(2026, 0, 1);
    expect(syncWindowStartMs({ lastSyncedAt: null, createdAt })).toBe(createdAt.getTime());
  });
});

// Regression anchor: one failing item used to reject the entire
// Promise.all in mapWithConcurrency's worker, aborting every other
// in-flight item in the same batch -- not just the one that failed.
describe("mapWithConcurrency", () => {
  it("returns every item's own result in input order when nothing fails", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 10);
    expect(results).toEqual([
      { ok: true, value: 10 },
      { ok: true, value: 20 },
      { ok: true, value: 30 },
    ]);
  });

  it("isolates one item's failure -- every other item still completes and reports its own result", async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      if (n === 2) throw new Error("item 2 failed");
      return n * 10;
    });
    expect(results[0]).toEqual({ ok: true, value: 10 });
    expect(results[1]).toMatchObject({ ok: false });
    expect((results[1] as { ok: false; error: unknown }).error).toBeInstanceOf(Error);
    expect(results[2]).toEqual({ ok: true, value: 30 });
    expect(results[3]).toEqual({ ok: true, value: 40 });
  });

  it("never exceeds the given concurrency", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("isGmailAuthError", () => {
  it("recognizes an invalid_grant error as an auth failure", () => {
    expect(isGmailAuthError(new Error("invalid_grant: Token has been expired or revoked."))).toBe(true);
  });

  it("recognizes an unauthorized error as an auth failure", () => {
    expect(isGmailAuthError(new Error("Request had invalid authentication credentials: unauthorized"))).toBe(
      true,
    );
  });

  it("recognizes a decryption failure as an auth failure (corrupted/mismatched stored token)", () => {
    expect(isGmailAuthError(new Error("Unable to decrypt token"))).toBe(true);
  });

  it("does not treat a generic/transient error as an auth failure", () => {
    expect(isGmailAuthError(new Error("ECONNRESET"))).toBe(false);
    expect(isGmailAuthError(new Error("Gmail API rate limit exceeded"))).toBe(false);
  });

  it("does not treat a non-Error value as an auth failure", () => {
    expect(isGmailAuthError("invalid_grant")).toBe(false);
    expect(isGmailAuthError(null)).toBe(false);
  });
});

describe("describeGmailSyncError", () => {
  it("tells the user to reconnect only for a genuine auth failure", () => {
    expect(describeGmailSyncError(new Error("invalid_grant"))).toContain("reconnect");
  });

  it("does NOT tell the user to reconnect for a non-auth failure -- reconnecting isn't the fix and previously risked losing the sync window", () => {
    const message = describeGmailSyncError(new Error("ECONNRESET"));
    expect(message.toLowerCase()).not.toContain("reconnect");
  });
});
