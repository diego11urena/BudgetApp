"use client";

import { useEffect, useRef, useState } from "react";
import {
  addTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  updateTransactionAction,
} from "../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import { useToast } from "./ToastProvider";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

export interface EditingTransaction {
  id: string;
  type: TxType;
  name: string;
  amount: number;
}

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Extra income" },
  { value: "SAVINGS", label: "Savings" },
];

const SWIPE_DISMISS_THRESHOLD = 90;
const TOP_CHIP_COUNT = 6;

export function QuickAddSheet({
  initialType,
  expenseCategoryNames,
  savingsCategoryNames,
  lastUsedIncomeName = null,
  editingTransaction = null,
  onClose,
}: {
  initialType: TxType;
  /** Pre-ordered: most-used-this-cycle, then recently-used, then alphabetical. */
  expenseCategoryNames: string[];
  /** Pre-ordered, same rule as expenseCategoryNames. */
  savingsCategoryNames: string[];
  /** Only used to default the Income name field when creating (not editing). */
  lastUsedIncomeName?: string | null;
  /** Present -> the sheet edits (and can delete) this transaction instead of creating a new one. */
  editingTransaction?: EditingTransaction | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const isEditing = editingTransaction !== null;

  // Calling the server actions directly (rather than via useActionState)
  // and doing the toast + close in the same async function is deliberate:
  // these actions revalidate this very page, and a subsequent re-render can
  // tear this component down before a separate "pending -> false" effect
  // gets a chance to run — dropping the toast. Awaiting inline sidesteps
  // that race entirely.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<TxType>(editingTransaction?.type ?? initialType);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  function categoryNamesForType(t: TxType): string[] {
    return t === "EXPENSE" ? expenseCategoryNames : t === "SAVINGS" ? savingsCategoryNames : [];
  }

  const categoryNames = categoryNamesForType(type);

  // Editing a category that isn't in the known list (renamed/deleted since)
  // falls back to free-text mode, pre-filled with its current name.
  const [customMode, setCustomMode] = useState(
    () =>
      editingTransaction !== null &&
      editingTransaction.type !== "INCOME" &&
      !categoryNamesForType(editingTransaction.type).includes(editingTransaction.name),
  );
  const [customName, setCustomName] = useState(() => {
    if (editingTransaction) {
      if (editingTransaction.type === "INCOME") return editingTransaction.name;
      return categoryNamesForType(editingTransaction.type).includes(editingTransaction.name)
        ? ""
        : editingTransaction.name;
    }
    return initialType === "INCOME" ? (lastUsedIncomeName ?? "") : "";
  });
  // The list is already ordered most-used-first, so its head is the default
  // when creating; editing pre-selects the transaction's own category.
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (editingTransaction && editingTransaction.type !== "INCOME") return editingTransaction.name;
    return categoryNames[0] ?? "";
  });
  const [amount, setAmount] = useState(editingTransaction ? editingTransaction.amount.toFixed(2) : "");
  // "More…" expands the chip row to the full ordered list — starts expanded
  // if editing a category that wouldn't otherwise be visible in the top 6.
  const [showAllCategories, setShowAllCategories] = useState(() => {
    if (!editingTransaction || editingTransaction.type === "INCOME") return false;
    const list = categoryNamesForType(editingTransaction.type);
    return (
      list.length > TOP_CHIP_COUNT && !list.slice(0, TOP_CHIP_COUNT).includes(editingTransaction.name)
    );
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const action = isEditing ? updateTransactionAction : addTransactionAction;
    const result = await action(undefined, formData);

    if (result && "error" in result) {
      setPending(false);
      setError(result.error);
      return;
    }

    if (!isEditing && result && "transactionId" in result) {
      const amountNumber = Number(formData.get("amount"));
      const label = String(formData.get("name") ?? "").trim() || "transaction";
      const newTransactionId = result.transactionId;
      showToast(`Logged ${formatCurrency(amountNumber)} for ${label}`, {
        label: "Undo",
        onClick: () => {
          const fd = new FormData();
          fd.set("transactionId", newTransactionId);
          void deleteTransactionAction(undefined, fd);
        },
      });
    }

    setPending(false);
    handleClose();
  }

  async function handleDelete() {
    if (!editingTransaction) return;
    setDeletePending(true);
    const fd = new FormData();
    fd.set("transactionId", editingTransaction.id);
    const result = await deleteTransactionAction(undefined, fd);

    if (result && "deleted" in result) {
      const d = result.deleted;
      showToast("Deleted", {
        label: "Undo",
        onClick: () => {
          const restoreFd = new FormData();
          restoreFd.set("cycleId", d.cycleId);
          restoreFd.set("type", d.type);
          restoreFd.set("name", d.name);
          restoreFd.set("amount", String(d.amount));
          restoreFd.set("occurredAt", d.occurredAt);
          void restoreTransactionAction(restoreFd);
        },
      });
    }

    setDeletePending(false);
    handleClose();
  }

  function handleTypeChange(next: TxType) {
    setType(next);
    setCustomMode(false);
    setShowAllCategories(false);
    if (next === "INCOME") {
      setCustomName(lastUsedIncomeName ?? "");
      return;
    }
    const nextCategoryNames = categoryNamesForType(next);
    setSelectedCategory(nextCategoryNames[0] ?? "");
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
        aria-label={isEditing ? "Edit transaction" : "Log a transaction"}
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

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="name" value={nameValue} />
          {isEditing && (
            <input type="hidden" name="transactionId" value={editingTransaction.id} />
          )}

          <div className="field sheet-amount-field">
            <label htmlFor="sheet-amount">Amount (USD)</label>
            <input
              id="sheet-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
              className="sheet-amount-input"
              onFocus={(e) => e.target.select()}
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
                <div className={`category-chips ${showAllCategories ? "category-chips--wrap" : ""}`}>
                  {(showAllCategories ? categoryNames : categoryNames.slice(0, TOP_CHIP_COUNT)).map(
                    (name) => (
                      <button
                        key={name}
                        type="button"
                        className={`category-chip ${selectedCategory === name ? "is-active" : ""}`}
                        onClick={() => setSelectedCategory(name)}
                      >
                        {name}
                      </button>
                    ),
                  )}
                  {!showAllCategories && categoryNames.length > TOP_CHIP_COUNT && (
                    <button
                      type="button"
                      className="category-chip category-chip--more"
                      onClick={() => setShowAllCategories(true)}
                    >
                      More…
                    </button>
                  )}
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

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? (isEditing ? "Saving..." : "Logging...") : isEditing ? "Save changes" : "Log it"}
          </button>
        </form>

        {isEditing && (
          <button
            type="button"
            className="sheet-delete"
            disabled={deletePending}
            onClick={handleDelete}
          >
            {deletePending ? "Deleting..." : "Delete transaction"}
          </button>
        )}
      </div>
    </div>
  );
}
