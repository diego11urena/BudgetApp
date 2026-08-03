import { describe, expect, it } from "vitest";
import { formatCycleLabel } from "./cycles";

describe("formatCycleLabel", () => {
  it("formats as zero-padded YYYY-MM-DD", () => {
    expect(formatCycleLabel(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(formatCycleLabel(new Date(2026, 8, 2))).toBe("2026-09-02");
  });

  it("does not pad a 4-digit year further and handles double-digit month/day", () => {
    expect(formatCycleLabel(new Date(2026, 11, 25))).toBe("2026-12-25");
  });

  it("defaults to the current date when called with no argument", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(formatCycleLabel()).toBe(expected);
  });
});
