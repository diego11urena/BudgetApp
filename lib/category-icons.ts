import { createElement } from "react";
import {
  BookOpen,
  Car,
  Gamepad2,
  Home,
  Lightbulb,
  Pill,
  PiggyBank,
  Plane,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Display-only keyword -> icon mapping for category names. ExpenseCategory
 * has an `icon` field in the schema, but nothing has ever set it (no UI to
 * pick one) — this derives a reasonable icon from the name instead, so
 * category rows don't all look the same, without adding an icon-picker UI.
 */
const KEYWORD_ICONS: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ["rent", "housing", "mortgage"], icon: Home },
  { keywords: ["food", "grocery", "groceries", "restaurant"], icon: UtensilsCrossed },
  { keywords: ["transport", "car", "gas", "fuel", "uber", "taxi"], icon: Car },
  { keywords: ["entertainment", "movie", "game", "streaming"], icon: Gamepad2 },
  { keywords: ["health", "medical", "pharmacy", "doctor"], icon: Pill },
  { keywords: ["utilities", "electric", "water", "internet", "phone"], icon: Lightbulb },
  { keywords: ["education", "school", "tuition", "books"], icon: BookOpen },
  { keywords: ["savings", "emergency", "fund"], icon: PiggyBank },
  { keywords: ["shopping", "clothes", "clothing"], icon: ShoppingBag },
  { keywords: ["travel", "vacation", "flight", "hotel"], icon: Plane },
];

const DEFAULT_ICON = Wallet;

export function iconForCategoryName(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const { keywords, icon } of KEYWORD_ICONS) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return icon;
    }
  }
  return DEFAULT_ICON;
}

/**
 * JSX usage (`const Icon = iconForCategoryName(name); <Icon />`) trips the
 * React Compiler's "component created during render" check — it can't
 * verify a dynamically-selected component is actually stable across
 * renders, even though every value iconForCategoryName can return is a
 * fixed, module-level import. createElement here (once, in the one place
 * that needs it) sidesteps that check entirely instead of re-triggering it
 * at every call site.
 */
export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  return createElement(iconForCategoryName(name), props);
}
