import { describe, expect, it } from "vitest";
import { getBudgetUsage } from "./budget-status";

describe("getBudgetUsage", () => {
  it("is good well under target", () => {
    expect(getBudgetUsage(50, 100)).toEqual({ state: "good", percentage: 50, overBy: 0 });
  });

  it("is good at exactly 100% -- hitting the target is the intended outcome, not a warning", () => {
    expect(getBudgetUsage(100, 100)).toEqual({ state: "good", percentage: 100, overBy: 0 });
  });

  it("is warning just over 100%, with the overage amount", () => {
    expect(getBudgetUsage(101, 100)).toEqual({ state: "warning", percentage: 101, overBy: 1 });
  });

  it("is warning at exactly 120%", () => {
    expect(getBudgetUsage(120, 100)).toEqual({ state: "warning", percentage: 120, overBy: 20 });
  });

  it("is critical just over 120%, with the overage amount", () => {
    expect(getBudgetUsage(121, 100)).toEqual({ state: "critical", percentage: 121, overBy: 21 });
  });

  it("is critical well over 120%", () => {
    expect(getBudgetUsage(240, 100)).toEqual({ state: "critical", percentage: 240, overBy: 140 });
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
