import { describe, expect, it } from "vitest";
import { orderCategoriesByUsage } from "./category-order";

describe("orderCategoriesByUsage", () => {
  it("puts categories used this cycle first, ordered by count descending", () => {
    const result = orderCategoriesByUsage([
      { name: "Rent", cycleCount: 1, lastUsedAt: new Date("2026-08-01") },
      { name: "Groceries", cycleCount: 3, lastUsedAt: new Date("2026-08-02") },
      { name: "Coffee", cycleCount: 2, lastUsedAt: new Date("2026-08-01") },
    ]);
    expect(result).toEqual(["Groceries", "Coffee", "Rent"]);
  });

  it("places never-used-this-cycle-but-used-before categories after, by recency", () => {
    const result = orderCategoriesByUsage([
      { name: "Old A", cycleCount: 0, lastUsedAt: new Date("2026-06-01") },
      { name: "Rent", cycleCount: 2, lastUsedAt: new Date("2026-08-01") },
      { name: "Old B", cycleCount: 0, lastUsedAt: new Date("2026-07-01") },
    ]);
    expect(result).toEqual(["Rent", "Old B", "Old A"]);
  });

  it("places never-used categories last, alphabetically", () => {
    const result = orderCategoriesByUsage([
      { name: "Zebra", cycleCount: 0, lastUsedAt: null },
      { name: "Rent", cycleCount: 1, lastUsedAt: new Date("2026-08-01") },
      { name: "Apple", cycleCount: 0, lastUsedAt: null },
    ]);
    expect(result).toEqual(["Rent", "Apple", "Zebra"]);
  });

  it("breaks ties in cycle count by recency", () => {
    const result = orderCategoriesByUsage([
      { name: "Older", cycleCount: 2, lastUsedAt: new Date("2026-08-01") },
      { name: "Newer", cycleCount: 2, lastUsedAt: new Date("2026-08-05") },
    ]);
    expect(result).toEqual(["Newer", "Older"]);
  });

  it("handles all three tiers together", () => {
    const result = orderCategoriesByUsage([
      { name: "Zebra", cycleCount: 0, lastUsedAt: null },
      { name: "Groceries", cycleCount: 3, lastUsedAt: new Date("2026-08-02") },
      { name: "Old Gym", cycleCount: 0, lastUsedAt: new Date("2026-05-01") },
      { name: "Apple", cycleCount: 0, lastUsedAt: null },
      { name: "Coffee", cycleCount: 1, lastUsedAt: new Date("2026-08-01") },
    ]);
    expect(result).toEqual(["Groceries", "Coffee", "Old Gym", "Apple", "Zebra"]);
  });
});
