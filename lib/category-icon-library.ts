import {
  Briefcase,
  Car,
  CircleHelp,
  Coffee,
  CreditCard,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Luggage,
  Music,
  Pill,
  PiggyBank,
  Plane,
  Plug,
  ShoppingBag,
  ShoppingCart,
  Tv,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface IconEntry {
  /** The exact lucide-react export name -- what gets stored on ExpenseCategory.icon. Also what getIconByName/searchIcons match against, so it must never become a display string -- see label/labelEs for that. */
  name: string;
  icon: LucideIcon;
  keywords: string[];
  /** Human-readable display label shown in the icon picker grid (English). */
  label: string;
  /** Spanish equivalent of `label`, shown under the es locale. */
  labelEs: string;
}

/**
 * The single source of truth for both the icon picker's grid and what a
 * stored `icon` string can resolve back to (see getIconByName below).
 * Deliberately small (~24, not "every icon lucide-react ships") -- a
 * personal-budgeting app's categories cluster around a couple dozen
 * recognizable concepts, and a fully searchable library of hundreds across
 * a dozen labeled groups was choice overload for a UI whose only job is
 * "pick something that looks roughly right." A category already carrying a
 * name that isn't in this curated set (created before this trim, or
 * before the picker existed at all) isn't broken by that -- getIconByName
 * returning undefined for an unresolvable name is exactly the case
 * CategoryIcon's own name-keyword heuristic exists to catch (see
 * lib/category-icons.ts), so it silently falls back to a reasonable icon
 * instead of rendering nothing.
 */
export const ICON_LIBRARY: IconEntry[] = [
  { name: "Home", icon: Home, keywords: ["rent", "housing", "mortgage", "home"], label: "Home", labelEs: "Casa" },
  {
    name: "Plug",
    icon: Plug,
    keywords: ["electric", "utilities", "power", "water", "internet"],
    label: "Utilities",
    labelEs: "Servicios",
  },
  {
    name: "UtensilsCrossed",
    icon: UtensilsCrossed,
    keywords: ["food", "restaurant", "dining", "eat", "groceries"],
    label: "Food",
    labelEs: "Comida",
  },
  { name: "Coffee", icon: Coffee, keywords: ["coffee", "cafe", "drink"], label: "Coffee", labelEs: "Café" },
  {
    name: "ShoppingCart",
    icon: ShoppingCart,
    keywords: ["shopping", "groceries", "cart"],
    label: "Groceries",
    labelEs: "Supermercado",
  },
  {
    name: "ShoppingBag",
    icon: ShoppingBag,
    keywords: ["shopping", "retail", "clothes", "clothing"],
    label: "Shopping",
    labelEs: "Compras",
  },
  {
    name: "Car",
    icon: Car,
    keywords: ["car", "auto", "drive", "vehicle", "transportation"],
    label: "Car",
    labelEs: "Auto",
  },
  {
    name: "Fuel",
    icon: Fuel,
    keywords: ["gas", "gasoline", "fuel", "car"],
    label: "Fuel",
    labelEs: "Combustible",
  },
  {
    name: "Tv",
    icon: Tv,
    keywords: ["streaming", "television", "netflix", "entertainment"],
    label: "Streaming",
    labelEs: "Streaming",
  },
  {
    name: "Music",
    icon: Music,
    keywords: ["music", "streaming", "spotify", "entertainment"],
    label: "Music",
    labelEs: "Música",
  },
  {
    name: "Gamepad2",
    icon: Gamepad2,
    keywords: ["game", "gaming", "video games", "entertainment"],
    label: "Gaming",
    labelEs: "Videojuegos",
  },
  {
    name: "Pill",
    icon: Pill,
    keywords: ["medicine", "pharmacy", "medical", "health"],
    label: "Medicine",
    labelEs: "Medicina",
  },
  {
    name: "HeartPulse",
    icon: HeartPulse,
    keywords: ["health", "medical", "heart", "doctor"],
    label: "Health",
    labelEs: "Salud",
  },
  {
    name: "Dumbbell",
    icon: Dumbbell,
    keywords: ["gym", "workout", "exercise", "fitness"],
    label: "Gym",
    labelEs: "Gimnasio",
  },
  { name: "Gift", icon: Gift, keywords: ["gift", "present", "birthday"], label: "Gift", labelEs: "Regalo" },
  {
    name: "Plane",
    icon: Plane,
    keywords: ["flight", "airplane", "vacation", "travel"],
    label: "Flight",
    labelEs: "Vuelo",
  },
  {
    name: "Luggage",
    icon: Luggage,
    keywords: ["suitcase", "vacation", "trip", "travel"],
    label: "Travel",
    labelEs: "Viaje",
  },
  { name: "Wallet", icon: Wallet, keywords: ["money", "cash", "finance"], label: "Wallet", labelEs: "Billetera" },
  {
    name: "PiggyBank",
    icon: PiggyBank,
    keywords: ["savings", "emergency fund", "money", "goal"],
    label: "Savings",
    labelEs: "Ahorros",
  },
  {
    name: "CreditCard",
    icon: CreditCard,
    keywords: ["card", "payment", "finance", "debt"],
    label: "Card",
    labelEs: "Tarjeta",
  },
  {
    name: "Dog",
    icon: Dog,
    keywords: ["dog", "puppy", "pet", "cat", "animal"],
    label: "Pet",
    labelEs: "Mascota",
  },
  {
    name: "GraduationCap",
    icon: GraduationCap,
    keywords: ["education", "school", "tuition", "books"],
    label: "Education",
    labelEs: "Educación",
  },
  {
    name: "Briefcase",
    icon: Briefcase,
    keywords: ["work", "job", "business", "income"],
    label: "Work",
    labelEs: "Trabajo",
  },
  {
    name: "CircleHelp",
    icon: CircleHelp,
    keywords: ["unknown", "other", "misc"],
    label: "Other",
    labelEs: "Otro",
  },
];

/** Every category with no explicit icon falls back to this via CategoryIcon's name-heuristic, not this constant directly -- this is only the default shown while creating a brand-new category before the name heuristic has anything to key off of. */
export const DEFAULT_ICON_NAME = "Wallet";

const ICON_BY_NAME = new Map(ICON_LIBRARY.map((entry) => [entry.name, entry]));

export function getIconByName(name: string | null | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return ICON_BY_NAME.get(name)?.icon;
}

/** Matches on the icon's own export name and its keywords -- e.g. "car" surfaces Car/Fuel, "dog" surfaces Dog. */
export function searchIcons(query: string): IconEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_LIBRARY;
  return ICON_LIBRARY.filter(
    (entry) => entry.name.toLowerCase().includes(q) || entry.keywords.some((keyword) => keyword.includes(q)),
  );
}
