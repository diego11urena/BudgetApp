"use client";

import { useEffect, useState } from "react";
import { Minus, PiggyBank, Plus, type LucideIcon } from "lucide-react";
import { Sheet } from "./Sheet";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

const ACTIONS: { type: TxType; icon: LucideIcon; label: string }[] = [
  { type: "EXPENSE", icon: Minus, label: "Add Expense" },
  { type: "INCOME", icon: Plus, label: "Add Income" },
  { type: "SAVINGS", icon: PiggyBank, label: "Add Savings" },
];

/**
 * Opened by the bottom nav's center "+" button. Picking one of the three
 * options slides this sheet away, then (matching the same close-then-
 * hand-off timing every other multi-step sheet in this app uses, e.g.
 * ConfirmJustGotPaidSheet -> CycleClosedCard) hands off to the caller,
 * which mounts QuickAddSheet with that type preselected — the same
 * create flow QuickActions used to open directly, just reachable from
 * anywhere instead of duplicated per-page.
 */
export function AddActionSheet({
  onSelect,
  onClose,
  returnFocusTo = null,
}: {
  onSelect: (type: TxType) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function handleSelect(type: TxType) {
    setVisible(false);
    setTimeout(() => onSelect(type), 200);
  }

  return (
    <Sheet visible={visible} ariaLabel="Add a transaction" onClose={handleClose} returnFocusTo={returnFocusTo}>
      <div className="quick-actions">
        {ACTIONS.map((action) => (
          <button
            key={action.type}
            type="button"
            className="quick-action"
            onClick={() => handleSelect(action.type)}
          >
            <action.icon className="quick-action-icon" size={22} aria-hidden="true" />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
