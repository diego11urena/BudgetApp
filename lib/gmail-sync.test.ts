import { describe, expect, it } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import {
  extractBodyText,
  filterNewMessageIds,
  isUniqueConstraintViolation,
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

describe("isUniqueConstraintViolation", () => {
  it("returns true for a Prisma P2002 error", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    expect(isUniqueConstraintViolation(error)).toBe(true);
  });

  it("returns false for a different Prisma error code", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "test",
    });
    expect(isUniqueConstraintViolation(error)).toBe(false);
  });

  it("returns false for a plain Error", () => {
    expect(isUniqueConstraintViolation(new Error("boom"))).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isUniqueConstraintViolation("some string")).toBe(false);
    expect(isUniqueConstraintViolation(null)).toBe(false);
    expect(isUniqueConstraintViolation(undefined)).toBe(false);
  });
});
