"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

const ACTIONS: { type: TxType; icon: string; label: string }[] = [
  { type: "EXPENSE", icon: "➖", label: "Add Expense" },
  { type: "INCOME", icon: "➕", label: "Add Income" },
  { type: "SAVINGS", icon: "🐷", label: "Add Savings" },
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
  const sheetRef = useRef<HTMLDivElement>(null);

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

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Add a transaction"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="quick-actions">
          {ACTIONS.map((action) => (
            <button
              key={action.type}
              type="button"
              className="quick-action"
              onClick={() => handleSelect(action.type)}
            >
              <span className="quick-action-icon">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
