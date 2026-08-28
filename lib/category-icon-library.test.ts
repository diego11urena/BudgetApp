import { describe, expect, it } from "vitest";
import { getIconByName, ICON_LIBRARY, searchIcons } from "./category-icon-library";

describe("ICON_LIBRARY", () => {
  it("has no duplicate icon names", () => {
    const names = ICON_LIBRARY.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("is curated down to roughly two dozen icons, not a sprawling library", () => {
    expect(ICON_LIBRARY.length).toBeLessThanOrEqual(30);
  });
});

describe("getIconByName", () => {
  it("resolves a stored icon name to its component", () => {
    expect(getIconByName("Dog")).toBeDefined();
  });

  it("returns undefined for a name outside the curated set (e.g. one trimmed away, or never valid) -- CategoryIcon's own keyword heuristic is the fallback for this case, not this function", () => {
    expect(getIconByName("NotARealIcon")).toBeUndefined();
  });

  it("returns undefined for null/undefined (a category with no stored icon)", () => {
    expect(getIconByName(null)).toBeUndefined();
    expect(getIconByName(undefined)).toBeUndefined();
  });
});

describe("searchIcons", () => {
  it("surfaces transportation icons for 'car'", () => {
    const results = searchIcons("car").map((r) => r.name);
    expect(results).toContain("Car");
  });

  it("surfaces Dog for 'dog'", () => {
    const results = searchIcons("dog").map((r) => r.name);
    expect(results).toContain("Dog");
  });

  it("matches by keyword, not just the icon's own name", () => {
    const results = searchIcons("fitness").map((r) => r.name);
    expect(results).toContain("Dumbbell");
  });

  it("returns the full library for an empty query", () => {
    expect(searchIcons("").length).toBe(ICON_LIBRARY.length);
    expect(searchIcons("   ").length).toBe(ICON_LIBRARY.length);
  });

  it("returns nothing for a query matching no icon", () => {
    expect(searchIcons("xyzzyplugh")).toEqual([]);
  });
});
