import { describe, expect, it } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";
import { isUniqueConstraintViolation } from "./prisma-errors";

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
