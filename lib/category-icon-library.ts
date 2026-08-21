import {
  Apple,
  Archive,
  Backpack,
  Bandage,
  Banknote,
  Beef,
  Bed,
  Beer,
  Bike,
  Bird,
  BookOpen,
  Bone,
  Box,
  Brain,
  Briefcase,
  Building2,
  Bus,
  Cake,
  Calendar,
  Camera,
  Car,
  CarFront,
  Cat,
  CircleHelp,
  Clapperboard,
  Clock,
  Coffee,
  Coins,
  Compass,
  CreditCard,
  Croissant,
  Cross,
  Dog,
  DollarSign,
  DoorOpen,
  Dumbbell,
  Eye,
  Fan,
  FileText,
  Film,
  Fish,
  Flame,
  Folder,
  Footprints,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Hammer,
  HandCoins,
  Headphones,
  HeartPulse,
  Home,
  IceCreamCone,
  Key,
  Landmark,
  Laptop,
  Luggage,
  MapPin,
  Medal,
  Mic,
  MoreHorizontal,
  Music,
  Package,
  Paintbrush,
  ParkingCircle,
  PawPrint,
  Pill,
  PiggyBank,
  Pizza,
  Plane,
  Plug,
  Popcorn,
  Presentation,
  Printer,
  Rabbit,
  Receipt,
  Sailboat,
  Sandwich,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Sofa,
  Soup,
  Sparkles,
  Star,
  Stethoscope,
  Store,
  Syringe,
  Tag,
  Tent,
  Thermometer,
  Ticket,
  Timer,
  Train,
  TrainFront,
  Trees,
  TrendingUp,
  Trophy,
  Truck,
  Tv,
  UtensilsCrossed,
  Utensils,
  Volleyball,
  Wallet,
  Watch,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ICON_GROUPS = [
  "Food",
  "Transportation",
  "Home",
  "Health",
  "Fitness",
  "Shopping",
  "Entertainment",
  "Travel",
  "Money",
  "Pets",
  "Work",
  "Other",
] as const;

export type IconGroup = (typeof ICON_GROUPS)[number];

export interface IconEntry {
  /** The exact lucide-react export name -- what gets stored on ExpenseCategory.icon. */
  name: string;
  icon: LucideIcon;
  group: IconGroup;
  keywords: string[];
}

/**
 * The single source of truth for both the icon picker's grid and what a
 * stored `icon` string can resolve back to (see getIconByName below) --
 * every icon a category can ever be saved with appears here exactly once,
 * so there's no risk of storing a name the picker itself can't show. Each
 * icon lives in exactly one group; keywords are extra search terms beyond
 * the icon's own name (already searchable) and its group name.
 */
export const ICON_LIBRARY: IconEntry[] = [
  // Food
  { name: "UtensilsCrossed", icon: UtensilsCrossed, group: "Food", keywords: ["food", "restaurant", "dining", "eat"] },
  { name: "Utensils", icon: Utensils, group: "Food", keywords: ["food", "fork", "eat"] },
  { name: "Coffee", icon: Coffee, group: "Food", keywords: ["coffee", "cafe", "drink"] },
  { name: "Pizza", icon: Pizza, group: "Food", keywords: ["pizza", "food"] },
  { name: "Beef", icon: Beef, group: "Food", keywords: ["meat", "beef", "food"] },
  { name: "Apple", icon: Apple, group: "Food", keywords: ["fruit", "grocery", "food"] },
  { name: "IceCreamCone", icon: IceCreamCone, group: "Food", keywords: ["dessert", "ice cream", "food"] },
  { name: "Cake", icon: Cake, group: "Food", keywords: ["dessert", "birthday", "cake"] },
  { name: "Beer", icon: Beer, group: "Food", keywords: ["drink", "alcohol", "bar"] },
  { name: "Wine", icon: Wine, group: "Food", keywords: ["drink", "alcohol", "wine"] },
  { name: "Sandwich", icon: Sandwich, group: "Food", keywords: ["lunch", "food"] },
  { name: "Soup", icon: Soup, group: "Food", keywords: ["food", "meal"] },
  { name: "Croissant", icon: Croissant, group: "Food", keywords: ["bakery", "breakfast", "food"] },

  // Transportation
  { name: "Car", icon: Car, group: "Transportation", keywords: ["car", "auto", "drive", "vehicle"] },
  { name: "CarFront", icon: CarFront, group: "Transportation", keywords: ["car", "auto", "vehicle"] },
  { name: "Bus", icon: Bus, group: "Transportation", keywords: ["bus", "transit"] },
  { name: "Train", icon: Train, group: "Transportation", keywords: ["train", "rail", "transit"] },
  { name: "TrainFront", icon: TrainFront, group: "Transportation", keywords: ["train", "rail", "transit"] },
  { name: "Bike", icon: Bike, group: "Transportation", keywords: ["bike", "bicycle", "cycling"] },
  { name: "Fuel", icon: Fuel, group: "Transportation", keywords: ["gas", "gasoline", "fuel", "car"] },
  { name: "Truck", icon: Truck, group: "Transportation", keywords: ["truck", "moving", "delivery"] },
  { name: "Ship", icon: Ship, group: "Transportation", keywords: ["boat", "ferry", "cruise"] },
  { name: "ParkingCircle", icon: ParkingCircle, group: "Transportation", keywords: ["parking", "car"] },
  { name: "Sailboat", icon: Sailboat, group: "Transportation", keywords: ["boat", "sailing"] },

  // Home
  { name: "Home", icon: Home, group: "Home", keywords: ["rent", "mortgage", "housing", "home"] },
  { name: "Sofa", icon: Sofa, group: "Home", keywords: ["furniture", "living room", "home"] },
  { name: "Bed", icon: Bed, group: "Home", keywords: ["bedroom", "furniture", "home"] },
  { name: "Wrench", icon: Wrench, group: "Home", keywords: ["repair", "maintenance", "tools"] },
  { name: "Hammer", icon: Hammer, group: "Home", keywords: ["repair", "tools", "diy"] },
  { name: "Paintbrush", icon: Paintbrush, group: "Home", keywords: ["paint", "diy", "home improvement"] },
  { name: "Plug", icon: Plug, group: "Home", keywords: ["electric", "utilities", "power"] },
  { name: "Fan", icon: Fan, group: "Home", keywords: ["cooling", "utilities", "home"] },
  { name: "Thermometer", icon: Thermometer, group: "Home", keywords: ["heating", "utilities", "temperature"] },
  { name: "DoorOpen", icon: DoorOpen, group: "Home", keywords: ["home", "door"] },
  { name: "Key", icon: Key, group: "Home", keywords: ["rent", "keys", "home"] },

  // Health
  { name: "Pill", icon: Pill, group: "Health", keywords: ["medicine", "pharmacy", "medical"] },
  { name: "Stethoscope", icon: Stethoscope, group: "Health", keywords: ["doctor", "medical", "health"] },
  { name: "HeartPulse", icon: HeartPulse, group: "Health", keywords: ["health", "medical", "heart"] },
  { name: "Syringe", icon: Syringe, group: "Health", keywords: ["vaccine", "medical", "shot"] },
  { name: "Cross", icon: Cross, group: "Health", keywords: ["medical", "hospital", "health"] },
  { name: "Bandage", icon: Bandage, group: "Health", keywords: ["first aid", "medical", "injury"] },
  { name: "Brain", icon: Brain, group: "Health", keywords: ["therapy", "mental health", "medical"] },
  { name: "Eye", icon: Eye, group: "Health", keywords: ["vision", "optometry", "medical"] },

  // Fitness
  { name: "Dumbbell", icon: Dumbbell, group: "Fitness", keywords: ["gym", "workout", "exercise"] },
  { name: "Footprints", icon: Footprints, group: "Fitness", keywords: ["running", "walking", "steps"] },
  { name: "Trophy", icon: Trophy, group: "Fitness", keywords: ["sports", "competition", "award"] },
  { name: "Medal", icon: Medal, group: "Fitness", keywords: ["sports", "achievement", "award"] },
  { name: "Timer", icon: Timer, group: "Fitness", keywords: ["workout", "training", "time"] },
  { name: "Flame", icon: Flame, group: "Fitness", keywords: ["calories", "workout", "cardio"] },
  { name: "Volleyball", icon: Volleyball, group: "Fitness", keywords: ["sports", "ball", "game"] },
  { name: "Zap", icon: Zap, group: "Fitness", keywords: ["energy", "intensity", "workout"] },

  // Shopping
  { name: "ShoppingBag", icon: ShoppingBag, group: "Shopping", keywords: ["shopping", "retail", "clothes"] },
  { name: "ShoppingCart", icon: ShoppingCart, group: "Shopping", keywords: ["shopping", "groceries", "cart"] },
  { name: "Gift", icon: Gift, group: "Shopping", keywords: ["gift", "present", "birthday"] },
  { name: "Shirt", icon: Shirt, group: "Shopping", keywords: ["clothes", "clothing", "apparel"] },
  { name: "Tag", icon: Tag, group: "Shopping", keywords: ["sale", "price", "shopping"] },
  { name: "Store", icon: Store, group: "Shopping", keywords: ["shop", "retail", "store"] },
  { name: "Package", icon: Package, group: "Shopping", keywords: ["shipping", "delivery", "order"] },
  { name: "Watch", icon: Watch, group: "Shopping", keywords: ["accessory", "shopping"] },
  { name: "Gem", icon: Gem, group: "Shopping", keywords: ["jewelry", "luxury", "shopping"] },

  // Entertainment
  { name: "Gamepad2", icon: Gamepad2, group: "Entertainment", keywords: ["game", "gaming", "video games"] },
  { name: "Music", icon: Music, group: "Entertainment", keywords: ["music", "streaming", "spotify"] },
  { name: "Film", icon: Film, group: "Entertainment", keywords: ["movie", "cinema", "film"] },
  { name: "Tv", icon: Tv, group: "Entertainment", keywords: ["streaming", "television", "netflix"] },
  { name: "Popcorn", icon: Popcorn, group: "Entertainment", keywords: ["movie", "snack", "cinema"] },
  { name: "Ticket", icon: Ticket, group: "Entertainment", keywords: ["event", "concert", "show"] },
  { name: "Camera", icon: Camera, group: "Entertainment", keywords: ["photography", "camera", "hobby"] },
  { name: "Headphones", icon: Headphones, group: "Entertainment", keywords: ["music", "audio", "podcast"] },
  { name: "Mic", icon: Mic, group: "Entertainment", keywords: ["podcast", "karaoke", "audio"] },
  { name: "Clapperboard", icon: Clapperboard, group: "Entertainment", keywords: ["movie", "film", "production"] },

  // Travel
  { name: "Plane", icon: Plane, group: "Travel", keywords: ["flight", "airplane", "vacation"] },
  { name: "Luggage", icon: Luggage, group: "Travel", keywords: ["suitcase", "vacation", "trip"] },
  { name: "Compass", icon: Compass, group: "Travel", keywords: ["explore", "navigation", "adventure"] },
  { name: "MapPin", icon: MapPin, group: "Travel", keywords: ["location", "map", "destination"] },
  { name: "Globe", icon: Globe, group: "Travel", keywords: ["world", "international", "travel"] },
  { name: "Backpack", icon: Backpack, group: "Travel", keywords: ["backpacking", "hiking", "travel"] },
  { name: "Trees", icon: Trees, group: "Travel", keywords: ["nature", "camping", "hiking", "outdoors"] },
  { name: "Tent", icon: Tent, group: "Travel", keywords: ["camping", "outdoors", "trip"] },

  // Money
  { name: "Wallet", icon: Wallet, group: "Money", keywords: ["money", "cash", "finance"] },
  { name: "DollarSign", icon: DollarSign, group: "Money", keywords: ["money", "cash", "finance"] },
  { name: "CreditCard", icon: CreditCard, group: "Money", keywords: ["card", "payment", "finance"] },
  { name: "PiggyBank", icon: PiggyBank, group: "Money", keywords: ["savings", "emergency fund", "money"] },
  { name: "Banknote", icon: Banknote, group: "Money", keywords: ["cash", "money", "bill"] },
  { name: "Coins", icon: Coins, group: "Money", keywords: ["cash", "change", "money"] },
  { name: "Receipt", icon: Receipt, group: "Money", keywords: ["invoice", "bill", "payment"] },
  { name: "TrendingUp", icon: TrendingUp, group: "Money", keywords: ["investing", "growth", "finance"] },
  { name: "Landmark", icon: Landmark, group: "Money", keywords: ["bank", "finance", "institution"] },
  { name: "HandCoins", icon: HandCoins, group: "Money", keywords: ["loan", "donation", "money"] },

  // Pets
  { name: "Dog", icon: Dog, group: "Pets", keywords: ["dog", "puppy", "pet"] },
  { name: "Cat", icon: Cat, group: "Pets", keywords: ["cat", "kitten", "pet"] },
  { name: "PawPrint", icon: PawPrint, group: "Pets", keywords: ["pet", "animal"] },
  { name: "Bird", icon: Bird, group: "Pets", keywords: ["bird", "pet"] },
  { name: "Fish", icon: Fish, group: "Pets", keywords: ["fish", "aquarium", "pet"] },
  { name: "Rabbit", icon: Rabbit, group: "Pets", keywords: ["rabbit", "bunny", "pet"] },
  { name: "Bone", icon: Bone, group: "Pets", keywords: ["dog", "treat", "pet"] },

  // Work
  { name: "Briefcase", icon: Briefcase, group: "Work", keywords: ["work", "job", "business"] },
  { name: "Laptop", icon: Laptop, group: "Work", keywords: ["work", "computer", "office"] },
  { name: "Building2", icon: Building2, group: "Work", keywords: ["office", "company", "work"] },
  { name: "FileText", icon: FileText, group: "Work", keywords: ["document", "paperwork", "office"] },
  { name: "Printer", icon: Printer, group: "Work", keywords: ["office", "printing", "work"] },
  { name: "Presentation", icon: Presentation, group: "Work", keywords: ["meeting", "office", "work"] },
  { name: "Calendar", icon: Calendar, group: "Work", keywords: ["schedule", "meeting", "planner"] },
  { name: "Clock", icon: Clock, group: "Work", keywords: ["time", "schedule", "work"] },
  { name: "GraduationCap", icon: GraduationCap, group: "Work", keywords: ["education", "school", "tuition"] },
  { name: "BookOpen", icon: BookOpen, group: "Work", keywords: ["education", "books", "school"] },

  // Other
  { name: "Star", icon: Star, group: "Other", keywords: ["favorite", "other"] },
  { name: "CircleHelp", icon: CircleHelp, group: "Other", keywords: ["unknown", "other", "misc"] },
  { name: "MoreHorizontal", icon: MoreHorizontal, group: "Other", keywords: ["other", "misc"] },
  { name: "Archive", icon: Archive, group: "Other", keywords: ["storage", "other", "misc"] },
  { name: "Folder", icon: Folder, group: "Other", keywords: ["other", "misc"] },
  { name: "Box", icon: Box, group: "Other", keywords: ["storage", "other", "misc"] },
  { name: "Sparkles", icon: Sparkles, group: "Other", keywords: ["misc", "other", "special"] },
];

/** Every category with no explicit icon falls back to this via CategoryIcon's name-heuristic, not this constant directly -- this is only the default shown while creating a brand-new category before the name heuristic has anything to key off of. */
export const DEFAULT_ICON_NAME = "Wallet";

const ICON_BY_NAME = new Map(ICON_LIBRARY.map((entry) => [entry.name, entry]));

export function getIconByName(name: string | null | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return ICON_BY_NAME.get(name)?.icon;
}

export function getIconGroups(): { group: IconGroup; icons: IconEntry[] }[] {
  return ICON_GROUPS.map((group) => ({
    group,
    icons: ICON_LIBRARY.filter((entry) => entry.group === group),
  }));
}

/** Matches on the icon's own export name, its group name, and its keywords -- e.g. "car" surfaces Transportation's Car/CarFront/Fuel, "dog" surfaces Pets' Dog/Bone. */
export function searchIcons(query: string): IconEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_LIBRARY;
  return ICON_LIBRARY.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.group.toLowerCase().includes(q) ||
      entry.keywords.some((keyword) => keyword.includes(q)),
  );
}
