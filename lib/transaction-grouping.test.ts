import { describe, expect, it } from "vitest";
import { formatGroupDateLabel, groupTransactionsByDate } from "./transaction-grouping";

const NOW = new Date(2026, 7, 15, 12, 0, 0); // Aug 15, 2026, noon

describe("formatGroupDateLabel", () => {
  it('labels the current calendar day as "Today"', () => {
    expect(formatGroupDateLabel(new Date(2026, 7, 15, 23, 59), NOW)).toBe("Today");
    expect(formatGroupDateLabel(new Date(2026, 7, 15, 0, 1), NOW)).toBe("Today");
  });

  it('labels the previous calendar day as "Yesterday"', () => {
    expect(formatGroupDateLabel(new Date(2026, 7, 14, 8, 0), NOW)).toBe("Yesterday");
  });

  it("formats anything older as a short date with year", () => {
    expect(formatGroupDateLabel(new Date(2026, 7, 1), NOW)).toBe("Aug 1, 2026");
    expect(formatGroupDateLabel(new Date(2025, 11, 25), NOW)).toBe("Dec 25, 2025");
  });

  it("does not label a future date as Today/Yesterday", () => {
    expect(formatGroupDateLabel(new Date(2026, 7, 16), NOW)).toBe("Aug 16, 2026");
  });
});

describe("groupTransactionsByDate", () => {
  function tx(occurredAt: Date, id: string) {
    return { id, occurredAt };
  }

  it("groups consecutive same-day items into one bucket", () => {
    const groups = groupTransactionsByDate(
      [
        tx(new Date(2026, 7, 15, 10, 0), "a"),
        tx(new Date(2026, 7, 15, 9, 0), "b"),
        tx(new Date(2026, 7, 14, 18, 0), "c"),
      ],
      NOW,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ label: "Today", items: [{ id: "a" }, { id: "b" }] });
    expect(groups[1]).toMatchObject({ label: "Yesterday", items: [{ id: "c" }] });
  });

  it("starts a new group when the same date label recurs non-consecutively", () => {
    // Same day appearing twice with a different day in between still
    // yields two separate buckets, not merged — grouping is positional.
    const groups = groupTransactionsByDate(
      [
        tx(new Date(2026, 7, 1), "a"),
        tx(new Date(2026, 6, 20), "b"),
        tx(new Date(2026, 7, 1), "c"),
      ],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(["Aug 1, 2026", "Jul 20, 2026", "Aug 1, 2026"]);
  });

  it("returns an empty array for no transactions", () => {
    expect(groupTransactionsByDate([], NOW)).toEqual([]);
  });

  it("puts a single transaction in its own group", () => {
    const groups = groupTransactionsByDate([tx(new Date(2026, 7, 15), "solo")], NOW);
    expect(groups).toEqual([{ label: "Today", items: [{ id: "solo", occurredAt: new Date(2026, 7, 15) }] }]);
  });
});
