/**
 * Category -> color mapping for the design system's "Category palette"
 * (DESIGN.md). The rule that matters is in its first line: "Fixed per
 * category (not per rank)." Food is the same pink whether it is the
 * biggest row or the smallest, so Home's "Where it's going" bars and the
 * Breakdown "By category" donut + legend agree at a glance.
 *
 * Deliberately a sibling of category-icons.ts rather than part of it:
 * that file answers "which glyph", this one answers "which color", and
 * the two keyword sets are not the same shape (Rent and Internet want
 * different icons but are both the Home color). Same keyword-matching
 * discipline though, so both stay predictable for a user who has never
 * opened a picker.
 *
 * Values live in app/globals.css as --cat-* custom properties (both
 * themes); this module only ever returns the token NAME, so a retheme is
 * still a CSS-only change.
 */

/**
 * Ordered: the first entry whose keyword appears in the category name
 * wins, so put the more specific concept first where two could overlap.
 * "subscriptions" is checked before "home" because a streaming service is
 * a subscription first; "gym" is health rather than a subscription for
 * the same reason a membership fee is still about health.
 */
const CATEGORY_COLORS: Array<{ keywords: string[]; token: string }> = [
  {
    keywords: ["food", "grocer", "restaurant", "dining", "cafe", "coffee", "comida", "super"],
    token: "--cat-food",
  },
  {
    keywords: ["transport", "car", "gas", "fuel", "uber", "taxi", "bus", "metro", "parking", "transporte"],
    token: "--cat-transport",
  },
  {
    keywords: ["shopping", "clothes", "clothing", "apparel", "ropa", "compras"],
    token: "--cat-shopping",
  },
  {
    keywords: ["subscription", "streaming", "netflix", "spotify", "membership", "suscrip"],
    token: "--cat-subscriptions",
  },
  {
    keywords: ["home", "rent", "housing", "mortgage", "utilities", "electric", "water", "internet", "casa", "alquiler"],
    token: "--cat-home",
  },
  {
    keywords: ["health", "medical", "pharmacy", "doctor", "fitness", "gym", "salud", "farmacia"],
    token: "--cat-health",
  },
];

/** Uncategorized, and anything explicitly named "other". */
const OTHER_TOKEN = "--cat-other";

/**
 * DESIGN.md: "User-created categories: assign in order from this extra
 * ramp, then cycle." Consumed by a stable hash of the category name
 * rather than by a positional index, because every list that renders
 * these is sorted by AMOUNT -- feeding a rank in would make a category's
 * color change the moment it out-spent its neighbour, which is precisely
 * what "not per rank" forbids. Hashing the name keeps a given category on
 * one color for as long as it is called the same thing, with no schema
 * read and no ordering state to thread through call sites.
 */
const EXTRA_TOKENS = ["--cat-extra-1", "--cat-extra-2", "--cat-extra-3", "--cat-extra-4"];

/**
 * djb2. Any stable non-cryptographic hash would do -- this one is short,
 * has no dependencies, and spreads short strings (which category names
 * almost always are) well enough that neighbouring names like "Perro" and
 * "Perros" don't collide onto the same ramp slot.
 */
function hashName(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * The CSS custom-property NAME for a category, e.g. "--cat-food".
 * Uncategorized spend (null/empty name) is the "Other" gray, matching the
 * palette table's own "Other / uncategorized" row.
 */
export function colorTokenForCategoryName(name: string | null | undefined): string {
  const lower = name?.trim().toLowerCase();
  if (!lower) return OTHER_TOKEN;
  if (lower === "other" || lower === "otro" || lower === "otros") return OTHER_TOKEN;

  for (const { keywords, token } of CATEGORY_COLORS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return token;
  }

  return EXTRA_TOKENS[hashName(lower) % EXTRA_TOKENS.length];
}

/**
 * Ready to drop straight into a style prop or an SVG fill --
 * `var(--cat-food)`. Kept separate from the token name above so call
 * sites that need the raw token (to build `var(...)-something`, the way
 * the heatmap builds its per-bucket text color) still can.
 */
export function categoryColorVar(name: string | null | undefined): string {
  return `var(${colorTokenForCategoryName(name)})`;
}
