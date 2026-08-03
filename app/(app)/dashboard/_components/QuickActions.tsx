"use client";

import { useState } from "react";
import { QuickAddSheet } from "../../_components/QuickAddSheet";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

const ACTIONS: { type: TxType; icon: string; label: string }[] = [
  { type: "EXPENSE", icon: "➖", label: "Add Expense" },
  { type: "INCOME", icon: "➕", label: "Add Income" },
  { type: "SAVINGS", icon: "🐷", label: "Add Savings" },
];

export function QuickActions({
  expenseCategoryNames,
  savingsCategoryNames,
  lastUsedIncomeName,
}: {
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  lastUsedIncomeName: string | null;
}) {
  const [openType, setOpenType] = useState<TxType | null>(null);
  // Captured synchronously on click, before the sheet mounts — its own
  // amount field autoFocus would otherwise steal focus first.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <div className="quick-actions">
        {ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            className="quick-action"
            onClick={(e) => {
              setTriggerElement(e.currentTarget);
              setOpenType(action.type);
            }}
          >
            <span className="quick-action-icon">{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {openType && (
        <QuickAddSheet
          initialType={openType}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          lastUsedIncomeName={lastUsedIncomeName}
          returnFocusTo={triggerElement}
          onClose={() => setOpenType(null)}
        />
      )}
    </>
  );
}
