"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { CategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import { IncomeCategoryActionsSheet } from "./IncomeCategoryActionsSheet";
import type { CategoryWithUsage } from "../../_components/types";

export function IncomeCategoryRow({
  category,
  otherCategories,
}: {
  category: CategoryWithUsage;
  otherCategories: CategoryWithUsage[];
}) {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <div className="category-row">
      <span className="category-row-swatch">
        <CategoryIcon name={category.name} icon={category.icon} size={18} aria-hidden="true" />
      </span>
      <div className="category-row-details">
        <p className="category-row-name">{category.name}</p>
        <p className="field-hint category-row-usage">
          {category.transactionCount === 0
            ? "No transactions yet"
            : `${category.transactionCount} transaction${category.transactionCount === 1 ? "" : "s"} · ${formatCurrency(category.totalAmount)}`}
        </p>
      </div>
      <button
        type="button"
        className="category-row-kebab"
        aria-label={`Actions for ${category.name}`}
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      {open && (
        <IncomeCategoryActionsSheet
          category={category}
          otherCategories={otherCategories}
          onDone={() => setOpen(false)}
          returnFocusTo={triggerElement}
        />
      )}
    </div>
  );
}
