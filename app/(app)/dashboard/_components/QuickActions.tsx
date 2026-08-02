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

  return (
    <>
      <div className="quick-actions">
        {ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            className="quick-action"
            onClick={() => setOpenType(action.type)}
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
          onClose={() => setOpenType(null)}
        />
      )}
    </>
  );
}
