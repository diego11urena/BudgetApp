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
import { getIconByName } from "./category-icon-library";

/**
 * Display-only keyword -> icon mapping for category names -- the fallback
 * CategoryIcon (below) falls back to when a category has no explicitly
 * picked icon (ExpenseCategory.icon is null; see IconPickerSheet.tsx and
 * profile/category-actions.ts, which do set it), so category rows never
 * all look the same even before a user has picked anything.
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
 *
 * `icon` is the category's stored ExpenseCategory.icon (a lucide-react
 * export name, e.g. "Dog") — preferred when it resolves via the icon
 * library. Falls back to the name-keyword heuristic when `icon` is null/
 * unset (every category created before the icon picker existed, or
 * created elsewhere in the app without going through it) or doesn't
 * resolve to a known icon, so nothing needs a migration to keep looking
 * reasonable.
 */
export function CategoryIcon({
  name,
  icon,
  ...props
}: { name: string; icon?: string | null } & LucideProps) {
  return createElement(getIconByName(icon) ?? iconForCategoryName(name), props);
}
