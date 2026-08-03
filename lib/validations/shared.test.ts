import { describe, expect, it } from "vitest";
import { decimalString } from "./shared";

describe("decimalString", () => {
  it("accepts a plain amount", () => {
    expect(decimalString.safeParse("1234.56").success).toBe(true);
  });

  it("accepts a whole-dollar amount with no decimal", () => {
    expect(decimalString.safeParse("50").success).toBe(true);
  });

  it("accepts the maximum 10-digit integer part", () => {
    expect(decimalString.safeParse("9999999999.99").success).toBe(true);
  });

  it("rejects zero", () => {
    expect(decimalString.safeParse("0").success).toBe(false);
    expect(decimalString.safeParse("0.00").success).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(decimalString.safeParse("-5").success).toBe(false);
  });

  it("rejects more than 10 integer digits (would overflow Decimal(12,2))", () => {
    expect(decimalString.safeParse("99999999999").success).toBe(false);
  });

  it("rejects more than 2 decimal places", () => {
    expect(decimalString.safeParse("1.234").success).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(decimalString.safeParse("abc").success).toBe(false);
  });
});
