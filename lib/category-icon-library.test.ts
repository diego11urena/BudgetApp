import { describe, expect, it } from "vitest";
import { getIconByName, ICON_GROUPS, ICON_LIBRARY, searchIcons } from "./category-icon-library";

describe("ICON_LIBRARY", () => {
  it("has no duplicate icon names", () => {
    const names = ICON_LIBRARY.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("assigns every icon to one of the 12 defined groups", () => {
    for (const entry of ICON_LIBRARY) {
      expect(ICON_GROUPS).toContain(entry.group);
    }
  });

  it("gives every group at least a handful of icons", () => {
    for (const group of ICON_GROUPS) {
      const count = ICON_LIBRARY.filter((entry) => entry.group === group).length;
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("getIconByName", () => {
  it("resolves a stored icon name to its component", () => {
    expect(getIconByName("Dog")).toBeDefined();
  });

  it("returns undefined for an unknown name", () => {
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
    expect(results).toContain("CarFront");
  });

  it("surfaces pet icons for 'dog'", () => {
    const results = searchIcons("dog").map((r) => r.name);
    expect(results).toContain("Dog");
  });

  it("matches by group name", () => {
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
