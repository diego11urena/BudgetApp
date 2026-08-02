"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTransactionAction, type TransactionFormState } from "../../_actions/transactions";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Extra income" },
  { value: "SAVINGS", label: "Savings" },
];

const SWIPE_DISMISS_THRESHOLD = 90;

const initialState: TransactionFormState = undefined;

export function QuickAddSheet({
  initialType,
  expenseCategoryNames,
  savingsCategoryNames,
  lastUsedNames,
  onClose,
}: {
  initialType: TxType;
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  lastUsedNames: Record<TxType, string | null>;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(addTransactionAction, initialState);
  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<TxType>(initialType);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState(
    initialType === "INCOME" ? (lastUsedNames.INCOME ?? "") : "",
  );

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const wasPending = useRef(false);

  const categoryNames =
    type === "EXPENSE" ? expenseCategoryNames : type === "SAVINGS" ? savingsCategoryNames : [];
  const [selectedCategory, setSelectedCategory] = useState(
    lastUsedNames[initialType] ?? categoryNames[0] ?? "",
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      handleClose();
    }
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function handleTypeChange(next: TxType) {
    setType(next);
    setCustomMode(false);
    if (next === "INCOME") {
      setCustomName(lastUsedNames.INCOME ?? "");
      return;
    }
    const nextCategoryNames = next === "EXPENSE" ? expenseCategoryNames : savingsCategoryNames;
    setSelectedCategory(lastUsedNames[next] ?? nextCategoryNames[0] ?? "");
  }

  function handleDragStart(e: React.TouchEvent) {
    dragStartY.current = e.touches[0].clientY;
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }

  function handleDragMove(e: React.TouchEvent) {
    if (dragStartY.current === null || !sheetRef.current) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function handleDragEnd(e: React.TouchEvent) {
    if (dragStartY.current === null || !sheetRef.current) return;
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    sheetRef.current.style.transition = "";
    sheetRef.current.style.transform = "";
    dragStartY.current = null;
    if (delta > SWIPE_DISMISS_THRESHOLD) {
      handleClose();
    }
  }

  const usingCustomInput = type === "INCOME" || customMode || categoryNames.length === 0;
  const nameValue = usingCustomInput ? customName : selectedCategory;

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Log a transaction"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="sheet-handle" />

        <div className="type-toggle">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`type-toggle-btn ${type === opt.value ? "is-active" : ""}`}
              onClick={() => handleTypeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <form action={formAction}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="name" value={nameValue} />

          <div className="field sheet-amount-field">
            <label htmlFor="sheet-amount">Amount (USD)</label>
            <input
              id="sheet-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              autoFocus
              required
              className="sheet-amount-input"
            />
          </div>

          {type === "INCOME" ? (
            <div className="field">
              <label htmlFor="sheet-name">Name</label>
              <input
                id="sheet-name"
                type="text"
                placeholder="Bonus, freelance gig…"
                required
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
          ) : (
            <div className="field">
              <label>Category</label>
              {!customMode && categoryNames.length > 0 && (
                <div className="category-chips">
                  {categoryNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`category-chip ${selectedCategory === name ? "is-active" : ""}`}
                      onClick={() => setSelectedCategory(name)}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="category-chip category-chip--other"
                    onClick={() => {
                      setCustomMode(true);
                      setCustomName("");
                    }}
                  >
                    Other…
                  </button>
                </div>
              )}
              {(customMode || categoryNames.length === 0) && (
                <input
                  type="text"
                  placeholder="Category name"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              )}
            </div>
          )}

          {state?.error && <p className="error-text">{state.error}</p>}

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? "Logging..." : "Log it"}
          </button>
        </form>
      </div>
    </div>
  );
}
