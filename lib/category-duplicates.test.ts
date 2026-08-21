import { describe, expect, it } from "vitest";
import { findPossibleDuplicates } from "./category-duplicates";

describe("findPossibleDuplicates", () => {
  it("flags a simple plural pair", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Gift" },
      { id: "2", name: "Gifts" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.id).toBe("1");
    expect(pairs[0].b.id).toBe("2");
  });

  it("flags a plural pair using -es", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Restaurant" },
      { id: "2", name: "Restaurants" },
    ]);
    expect(pairs).toHaveLength(1);
  });

  it("flags a short-prefix pair", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Gas" },
      { id: "2", name: "Gasoline" },
    ]);
    expect(pairs).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "gift" },
      { id: "2", name: "GIFTS" },
    ]);
    expect(pairs).toHaveLength(1);
  });

  it("does not flag unrelated names", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Food" },
      { id: "2", name: "Fun" },
      { id: "3", name: "Rent" },
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("does not flag two names that are already identical", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Food" },
      { id: "2", name: "food" },
    ]);
    // Same normalized name isn't a "possible duplicate" suggestion — it's
    // either the same category twice or a case-collision the app's
    // case-insensitive uniqueness already prevents from coexisting.
    expect(pairs).toHaveLength(0);
  });

  it("does not flag a short name against an unrelated long one sharing no real relationship", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Gas" },
      { id: "2", name: "Gastroenterology Copay" },
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("finds multiple independent pairs in one list", () => {
    const pairs = findPossibleDuplicates([
      { id: "1", name: "Gift" },
      { id: "2", name: "Gifts" },
      { id: "3", name: "Restaurant" },
      { id: "4", name: "Restaurants" },
      { id: "5", name: "Unrelated" },
    ]);
    expect(pairs).toHaveLength(2);
  });
});
