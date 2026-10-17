import { describe, expect, it } from "vitest";
import {
  applyCurrencyKey,
  centsToDecimalString,
  centsToDisplay,
  decimalStringToCents,
  digitsFromRawInput,
  MAX_CURRENCY_DIGITS,
} from "./currency-input";

describe("centsToDisplay", () => {
  it("walks through the spec's own sequential-typing example", () => {
    // Simulates typing 1,2,5,0,0,5,0 one digit at a time: cents = cents*10 + digit.
    const sequence = [1, 2, 5, 0, 0, 5, 0];
    let cents = 0;
    const displays = sequence.map((digit) => {
      cents = cents * 10 + digit;
      return centsToDisplay(cents);
    });
    expect(displays).toEqual(["0.01", "0.12", "1.25", "12.50", "125.00", "1,250.05", "12,500.50"]);
  });

  it("walks through the spec's own backspace example", () => {
    // Math.floor(cents / 10) mirrors handleChange's own backspace math.
    let cents = 125050;
    const displays: string[] = [];
    for (let i = 0; i < 6; i++) {
      cents = Math.floor(cents / 10);
      displays.push(centsToDisplay(cents));
    }
    expect(displays).toEqual(["125.05", "12.50", "1.25", "0.12", "0.01", "0.00"]);
  });

  it("formats zero as 0.00", () => {
    expect(centsToDisplay(0)).toBe("0.00");
  });
});

describe("centsToDecimalString", () => {
  it("matches the app's existing storage format, no separators", () => {
    expect(centsToDecimalString(125050)).toBe("1250.50");
    expect(centsToDecimalString(0)).toBe("0.00");
    expect(centsToDecimalString(1)).toBe("0.01");
  });
});

describe("decimalStringToCents", () => {
  it("round-trips existing decimal strings", () => {
    expect(decimalStringToCents("1250.50")).toBe(125050);
    expect(decimalStringToCents("45.5")).toBe(4550);
    expect(decimalStringToCents("45")).toBe(4500);
  });

  it("treats empty/invalid input as zero", () => {
    expect(decimalStringToCents("")).toBe(0);
    expect(decimalStringToCents("not a number")).toBe(0);
  });
});

describe("digitsFromRawInput", () => {
  it("strips separators and the decimal point", () => {
    expect(digitsFromRawInput("1,250.50")).toBe("125050");
  });

  it("caps at MAX_CURRENCY_DIGITS, keeping the rightmost (most recently typed) digits", () => {
    const tooLong = "1".repeat(MAX_CURRENCY_DIGITS + 3);
    expect(digitsFromRawInput(tooLong)).toHaveLength(MAX_CURRENCY_DIGITS);
    expect(digitsFromRawInput("1234567890123")).toBe("234567890123");
  });
});

describe("applyCurrencyKey", () => {
  it("appends digits, POS-style", () => {
    let c: number | null = 0;
    for (const d of "125050") c = applyCurrencyKey(c, d, false, false);
    expect(c).toBe(125050);
  });

  it("the first keystroke after a tap replaces a pre-filled amount", () => {
    let c: number | null = applyCurrencyKey(100000, "1", true, false);
    for (const d of "20000") c = applyCurrencyKey(c, d, false, false);
    expect(c).toBe(120000);
  });

  it("delete drops the last digit, or clears everything right after a tap", () => {
    expect(applyCurrencyKey(125050, null, false, false)).toBe(12505);
    expect(applyCurrencyKey(125050, null, true, false)).toBe(0);
    expect(applyCurrencyKey(5, null, false, false)).toBe(0);
  });

  it("allowEmpty: deleting the last digit returns to blank", () => {
    expect(applyCurrencyKey(5, null, false, true)).toBeNull();
    expect(applyCurrencyKey(null, "7", false, true)).toBe(7);
  });

  it("ignores non-digits and keeps the 12-digit cap", () => {
    expect(applyCurrencyKey(4550, "a.,", false, false)).toBe(4550);
    expect(applyCurrencyKey(999999999999, "1", false, false)).toBe(999999999991);
  });
});
