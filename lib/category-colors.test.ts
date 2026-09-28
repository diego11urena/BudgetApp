import { describe, expect, it } from "vitest";
import { categoryColorVar, colorTokenForCategoryName } from "./category-colors";

describe("colorTokenForCategoryName", () => {
  it("maps each of the design system's named categories to its own token", () => {
    expect(colorTokenForCategoryName("Food")).toBe("--cat-food");
    expect(colorTokenForCategoryName("Transport")).toBe("--cat-transport");
    expect(colorTokenForCategoryName("Shopping")).toBe("--cat-shopping");
    expect(colorTokenForCategoryName("Subscriptions")).toBe("--cat-subscriptions");
    expect(colorTokenForCategoryName("Home")).toBe("--cat-home");
    expect(colorTokenForCategoryName("Health")).toBe("--cat-health");
  });

  it("matches on a keyword inside a longer name, in either language", () => {
    expect(colorTokenForCategoryName("Groceries & household")).toBe("--cat-food");
    expect(colorTokenForCategoryName("Uber rides")).toBe("--cat-transport");
    expect(colorTokenForCategoryName("Alquiler")).toBe("--cat-home");
    expect(colorTokenForCategoryName("Farmacia Arrocha")).toBe("--cat-health");
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(colorTokenForCategoryName("  FOOD  ")).toBe("--cat-food");
    expect(colorTokenForCategoryName("fOoD")).toBe("--cat-food");
  });

  it("treats uncategorized spend as Other", () => {
    expect(colorTokenForCategoryName(null)).toBe("--cat-other");
    expect(colorTokenForCategoryName(undefined)).toBe("--cat-other");
    expect(colorTokenForCategoryName("")).toBe("--cat-other");
    expect(colorTokenForCategoryName("   ")).toBe("--cat-other");
    expect(colorTokenForCategoryName("Other")).toBe("--cat-other");
    expect(colorTokenForCategoryName("Otros")).toBe("--cat-other");
  });

  it("prefers the more specific concept when two keyword sets could overlap", () => {
    // "Netflix subscription" contains no Home keyword, but "Internet" does
    // -- the point here is that a streaming service lands on
    // subscriptions rather than being swept up by a broader match.
    expect(colorTokenForCategoryName("Netflix")).toBe("--cat-subscriptions");
    // A gym membership is health, not a subscription.
    expect(colorTokenForCategoryName("Gym")).toBe("--cat-health");
  });

  it("assigns user-created categories from the extra ramp", () => {
    const token = colorTokenForCategoryName("Regalos para el perro");
    expect(["--cat-extra-1", "--cat-extra-2", "--cat-extra-3", "--cat-extra-4"]).toContain(token);
  });

  it("keeps a user-created category on the same color across calls", () => {
    const first = colorTokenForCategoryName("Brunch club");
    const second = colorTokenForCategoryName("brunch club");
    expect(second).toBe(first);
  });

  /**
   * The design system's own rule -- "Fixed per category (not per rank)".
   * Every list that renders these is sorted by amount, so the guard that
   * actually matters is that nothing about a category's position or the
   * company it keeps can change its color.
   */
  it("does not depend on rank, list position, or which other categories exist", () => {
    const soloOrder = ["Kite repairs", "Food", "Transport"].map(colorTokenForCategoryName);
    const reversed = ["Transport", "Food", "Kite repairs"].map(colorTokenForCategoryName).reverse();
    expect(reversed).toEqual(soloOrder);
  });

  it("spreads similar user-created names across different ramp slots", () => {
    // Not a hard guarantee of the hash, but a regression guard: a naive
    // "first character" scheme would collide these onto one color.
    const a = colorTokenForCategoryName("Perro");
    const b = colorTokenForCategoryName("Perros");
    expect(a).not.toBe(b);
  });
});

describe("categoryColorVar", () => {
  it("wraps the token in a CSS var() reference", () => {
    expect(categoryColorVar("Food")).toBe("var(--cat-food)");
    expect(categoryColorVar(null)).toBe("var(--cat-other)");
  });
});
