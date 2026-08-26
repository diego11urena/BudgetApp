import { describe, expect, it } from "vitest";
import { goalContributionDeltaSchema } from "./goals";

describe("goalContributionDeltaSchema", () => {
  it("accepts a positive delta", () => {
    expect(goalContributionDeltaSchema.safeParse(50).success).toBe(true);
  });

  it("accepts a negative delta", () => {
    expect(goalContributionDeltaSchema.safeParse(-50).success).toBe(true);
  });

  it("accepts zero (updateGoalWithContributionAction treats it as 'unchanged')", () => {
    expect(goalContributionDeltaSchema.safeParse(0).success).toBe(true);
  });

  it("rejects NaN and Infinity", () => {
    expect(goalContributionDeltaSchema.safeParse(NaN).success).toBe(false);
    expect(goalContributionDeltaSchema.safeParse(Infinity).success).toBe(false);
  });

  it("accepts the maximum magnitude a Decimal(12,2) column can hold", () => {
    expect(goalContributionDeltaSchema.safeParse(9_999_999_999.99).success).toBe(true);
    expect(goalContributionDeltaSchema.safeParse(-9_999_999_999.99).success).toBe(true);
  });

  it("rejects a magnitude that would overflow Decimal(12,2), positive or negative", () => {
    expect(goalContributionDeltaSchema.safeParse(1e15).success).toBe(false);
    expect(goalContributionDeltaSchema.safeParse(-1e15).success).toBe(false);
  });
});
