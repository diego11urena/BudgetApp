"use client";

import CategoryDonut from "@/app/(app)/_components/charts/CategoryDonut";
import { useT } from "@/app/_components/LocaleProvider";
import type { CategoryRow } from "../types";

/**
 * Chapter 03 — this period's categories as the By-category donut, sorted
 * biggest-to-smallest (categories arrives pre-sorted from page.tsx's own
 * categoryTotals).
 *
 * The chapter itself is now a thin wrapper: all of the drawing and the
 * tap-to-select behavior lives in CategoryDonut, which is shared rather
 * than route-local because the palette it paints with is the same one
 * Home's "Where it's going" bars use (see lib/category-colors.ts).
 */
export default function ByCategoryChapter({
  categories,
  state,
}: {
  categories: CategoryRow[];
  state: "LIVE" | "CLOSED";
}) {
  const t = useT();

  if (categories.length === 0) {
    return <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>;
  }

  const total = categories.reduce((sum, cat) => sum + cat.amount, 0);

  return (
    <CategoryDonut
      slices={categories.map((cat) => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        amount: cat.amount,
        usualAmount: cat.usualAmount,
      }))}
      total={total}
      state={state}
    />
  );
}
