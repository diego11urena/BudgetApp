"use client";

import { MoreHorizontal } from "lucide-react";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import { IncomeCategoryActionsSheet } from "./IncomeCategoryActionsSheet";
import { useSheet } from "../../../../_components/useSheet";
import type { CategoryWithUsage } from "../../_components/types";
import { useT } from "../../../../../_components/LocaleProvider";

export function IncomeCategoryRow({
  category,
  otherCategories,
}: {
  category: CategoryWithUsage;
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
            ? t.profile.categories.noTx
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
        <IncomeCategoryActionsSheet
          category={category}
          otherCategories={otherCategories}
          onDone={close}
          {...sheetProps}
        />
      )}
    </div>
  );
}
