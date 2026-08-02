/**
 * Display-only keyword -> emoji mapping for category names. ExpenseCategory
 * has an `icon` field in the schema, but nothing has ever set it (no UI to
 * pick one) — this derives a reasonable icon from the name instead, so
 * category rows don't all look the same, without adding an icon-picker UI.
 */
const KEYWORD_ICONS: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ["rent", "housing", "mortgage"], icon: "🏠" },
  { keywords: ["food", "grocery", "groceries", "restaurant"], icon: "🍔" },
  { keywords: ["transport", "car", "gas", "fuel", "uber", "taxi"], icon: "🚗" },
  { keywords: ["entertainment", "movie", "game", "streaming"], icon: "🎮" },
  { keywords: ["health", "medical", "pharmacy", "doctor"], icon: "💊" },
  { keywords: ["utilities", "electric", "water", "internet", "phone"], icon: "💡" },
  { keywords: ["education", "school", "tuition", "books"], icon: "📚" },
  { keywords: ["savings", "emergency", "fund"], icon: "🐷" },
  { keywords: ["shopping", "clothes", "clothing"], icon: "🛍️" },
  { keywords: ["travel", "vacation", "flight", "hotel"], icon: "✈️" },
];

const DEFAULT_ICON = "💰";

export function iconForCategoryName(name: string): string {
  const lower = name.toLowerCase();
  for (const { keywords, icon } of KEYWORD_ICONS) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return icon;
    }
  }
  return DEFAULT_ICON;
}
