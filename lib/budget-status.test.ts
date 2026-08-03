import { describe, expect, it } from "vitest";
import { getBudgetUsage } from "./budget-status";

describe("getBudgetUsage", () => {
  it("is good under 85%", () => {
    expect(getBudgetUsage(84, 100)).toEqual({ state: "good", percentage: 84, overBy: 0 });
  });

  it("is warning at exactly 85%", () => {
    expect(getBudgetUsage(85, 100)).toEqual({ state: "warning", percentage: 85, overBy: 0 });
  });

  it("is warning at exactly 100%", () => {
    expect(getBudgetUsage(100, 100)).toEqual({ state: "warning", percentage: 100, overBy: 0 });
  });

  it("is critical just over 100%, with the overage amount", () => {
    expect(getBudgetUsage(240, 200)).toEqual({ state: "critical", percentage: 120, overBy: 40 });
  });

  it("treats spending against a zero/unset budget as fully critical", () => {
    expect(getBudgetUsage(50, 0)).toEqual({ state: "critical", percentage: 100, overBy: 50 });
  });

  it("is good at zero spend and no budget", () => {
    expect(getBudgetUsage(0, 0)).toEqual({ state: "good", percentage: 0, overBy: 0 });
  });

  it("is good at zero spend with a budget set", () => {
    expect(getBudgetUsage(0, 200)).toEqual({ state: "good", percentage: 0, overBy: 0 });
  });
});
