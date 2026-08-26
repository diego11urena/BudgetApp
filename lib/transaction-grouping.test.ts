import { describe, expect, it } from "vitest";
import { formatGroupDateLabel, groupTransactionsByDate } from "./transaction-grouping";

// Mirrors pay-date.ts's own panamaMidnight anchor (Panama is UTC-5
// year-round, no DST) so every date in this file is correct regardless of
// which machine/timezone runs the test — never `new Date(y, m, d, h, m)`
// (the local-timezone constructor), which only agrees with the intended
// Panama-anchored value when the test runner's own system timezone
// happens to be Panama. Same pattern as lib/quincena-pace.test.ts's own
// `panama()` helper, extended with an hour/minute so the Today/Yesterday
// boundary tests below can probe near Panama midnight specifically.
function panama(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0));
}

const NOW = panama(2026, 8, 15, 12, 0); // Aug 15, 2026, noon Panama time

describe("formatGroupDateLabel", () => {
  it('labels the current calendar day as "Today"', () => {
    expect(formatGroupDateLabel(panama(2026, 8, 15, 23, 59), NOW)).toBe("Today");
    expect(formatGroupDateLabel(panama(2026, 8, 15, 0, 1), NOW)).toBe("Today");
  });

  it('labels the previous calendar day as "Yesterday"', () => {
    expect(formatGroupDateLabel(panama(2026, 8, 14, 8, 0), NOW)).toBe("Yesterday");
  });

  it("formats anything older as a short date with year", () => {
    expect(formatGroupDateLabel(panama(2026, 8, 1), NOW)).toBe("Aug 1, 2026");
    expect(formatGroupDateLabel(panama(2025, 12, 25), NOW)).toBe("Dec 25, 2025");
  });

  it("does not label a future date as Today/Yesterday", () => {
    expect(formatGroupDateLabel(panama(2026, 8, 16), NOW)).toBe("Aug 16, 2026");
  });
});

describe("groupTransactionsByDate", () => {
  function tx(occurredAt: Date, id: string) {
    return { id, occurredAt };
  }

  it("groups consecutive same-day items into one bucket", () => {
    const groups = groupTransactionsByDate(
      [
        tx(panama(2026, 8, 15, 10, 0), "a"),
        tx(panama(2026, 8, 15, 9, 0), "b"),
        tx(panama(2026, 8, 14, 18, 0), "c"),
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
        tx(panama(2026, 8, 1), "a"),
        tx(panama(2026, 7, 20), "b"),
        tx(panama(2026, 8, 1), "c"),
      ],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(["Aug 1, 2026", "Jul 20, 2026", "Aug 1, 2026"]);
  });

  it("returns an empty array for no transactions", () => {
    expect(groupTransactionsByDate([], NOW)).toEqual([]);
  });

  it("puts a single transaction in its own group", () => {
    const solo = panama(2026, 8, 15);
    const groups = groupTransactionsByDate([tx(solo, "solo")], NOW);
    expect(groups).toEqual([{ label: "Today", items: [{ id: "solo", occurredAt: solo }] }]);
  });
});
