import type { HeatmapBucket } from "@/lib/breakdown-v2";

/** One cell of chapter 04's heatmap ("When you spend"), already resolved to a Panama calendar day. */
export interface HeatmapDayData {
  /** "YYYY-MM-DD" in America/Panama — see lib/breakdown-v2's own note on why not UTC. */
  date: string;
  bucket: HeatmapBucket;
  total: number;
  /** A live cycle's not-yet-happened days: greyed, not a real zero. */
  disabled: boolean;
}

/** One row in a selected day's detail list. */
export interface DayTransaction {
  id: string;
  name: string;
  amount: number;
  categoryName: string | null;
  /** Linked to a recurring expense — "fixed" in the cash-flow/by-category sense. */
  isRecurring: boolean;
}

/** One category row in chapter 03 (By category), with its own trailing-period baseline. */
export interface CategoryRow {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  amount: number;
  /** Null when there's no prior-period data — renders "New this period" instead of a false $0 usual. */
  usualAmount: number | null;
}
