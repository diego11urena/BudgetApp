"use client";

import { MoreHorizontal } from "lucide-react";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import { CategoryActionsSheet } from "./CategoryActionsSheet";
import { useSheet } from "../../../_components/useSheet";
import type { CategoryWithUsage } from "./types";
import { useT } from "../../../../_components/LocaleProvider";

/**
 * The compact row this whole redesign is about — icon swatch, name, a
 * secondary usage line (never visually dominant, per spec), and a "•••"
 * trigger. Every actual action (edit/merge/delete) lives behind that
 * trigger instead of being permanently on-row, so a long category list
 * reads as a list, not a stack of forms.
 */
export function CategoryRow({
  category,
  otherCategories,
}: {
  category: CategoryWithUsage;
  /** Every other EXPENSE category, for the row's "Merge into…" picker. */
  otherCategories: CategoryWithUsage[];
}) {
  const { open, triggerProps, sheetProps, close } = useSheet();
  const t = useT();

  return (
    <div className="category-row">
      <span className="category-row-swatch">
        <CategoryIcon name={category.name} icon={category.icon} size={18} aria-hidden="true" />
      </span>
      <div className="category-row-details">
        <p className="category-row-name">{category.name}</p>
        <p className="field-hint category-row-usage">
          {category.transactionCount === 0
            ? category.hasBudgetGoal
              ? t.profile.categories.recurringNoTx
              : t.profile.categories.noTx
            : t.profile.categories.txCount(category.transactionCount, formatCurrency(category.totalAmount))}
        </p>
      </div>
      <button
        type="button"
        className="category-row-kebab"
        aria-label={t.profile.categories.actionsAria(category.name)}
        {...triggerProps}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      {open && (
        <CategoryActionsSheet category={category} otherCategories={otherCategories} onDone={close} {...sheetProps} />
      )}
    </div>
  );
}
