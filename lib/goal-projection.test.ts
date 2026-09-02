import { describe, expect, it } from "vitest";
import { computeGoalProjection } from "./goal-projection";
import { parseDateOnly } from "./pay-date";

describe("computeGoalProjection", () => {
  it("projects an ETA from the per-cycle contribution and remaining amount", () => {
    const result = computeGoalProjection({
      savedSoFar: 200,
      lifetimeTargetAmount: 1000,
      currentCycleRecurringAmount: 200,
      now: parseDateOnly("2026-08-02")!,
    });
    // remaining 800, /200 per cycle = 4 quincenas. Walking 4 *real*
    // quincenas forward from Aug 2, 2026 (15 + 16 + 15 + 15 days -- the
    // Aug16-31 leg is 16 days since August has 31) lands on Oct 2, not a
    // flat 60-day (4*15) jump to Oct 1.
    expect(result.remaining).toBe(800);
    expect(result.percentage).toBe(20);
    expect(result.isComplete).toBe(false);
    expect(result.cyclesNeeded).toBe(4);
    expect(result.etaDate).toEqual(parseDateOnly("2026-10-02"));
  });

  it("rounds up partial quincenas", () => {
    const result = computeGoalProjection({
      savedSoFar: 0,
      lifetimeTargetAmount: 250,
      currentCycleRecurringAmount: 100,
      now: parseDateOnly("2026-08-02")!,
    });
    // 250/100 = 2.5 -> 3 quincenas.
    expect(result.cyclesNeeded).toBe(3);
  });

  it("has no projection without a per-cycle contribution", () => {
    const result = computeGoalProjection({
      savedSoFar: 100,
      lifetimeTargetAmount: 1000,
      currentCycleRecurringAmount: null,
    });
    expect(result.cyclesNeeded).toBeNull();
    expect(result.etaDate).toBeNull();
  });

  it("marks a goal complete once saved meets or exceeds the target, with no projection", () => {
    const result = computeGoalProjection({
      savedSoFar: 1200,
      lifetimeTargetAmount: 1000,
      currentCycleRecurringAmount: 100,
    });
    expect(result.isComplete).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.percentage).toBe(100);
    expect(result.cyclesNeeded).toBeNull();
    expect(result.etaDate).toBeNull();
  });

  it("clamps display percentage at 100 even when overfunded", () => {
    const result = computeGoalProjection({
      savedSoFar: 1500,
      lifetimeTargetAmount: 1000,
      currentCycleRecurringAmount: null,
    });
    expect(result.percentage).toBe(100);
  });
});
