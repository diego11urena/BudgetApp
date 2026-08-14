"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  updateTransactionAction,
} from "../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { useToast } from "./ToastProvider";
import { useModalFocus } from "./useModalFocus";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";
type PaymentMethod = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY";

export interface EditingTransaction {
  id: string;
  type: TxType;
  name: string;
  /** Null for INCOME (no category concept) or an uncategorized row. */
  categoryName: string | null;
  amount: number;
  /** EXPENSE-only; null otherwise or if never set. */
  paymentMethod: PaymentMethod | null;
  /** "YYYY-MM-DD" — prefills the Date field. */
  occurredAt: string;
  /** What it was for, beyond name/merchant — e.g. Yappy's own "Mensaje" note. Null if never set. */
  description: string | null;
  /** False only for a row from an already-closed cycle — every field stays editable there, but deleting the row outright stays blocked (frozen totals), so the Delete button is hidden instead of erroring after the fact. Defaults true when omitted. */
  isDeletable?: boolean;
}

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Extra income" },
  { value: "SAVINGS", label: "Savings" },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "YAPPY", label: "Yappy" },
];

const SWIPE_DISMISS_THRESHOLD = 90;
const TOP_CHIP_COUNT = 6;

export function QuickAddSheet({
  initialType,
  expenseCategoryNames,
  savingsCategoryNames,
  lastUsedIncomeName = null,
  cycleStartDate,
  editingTransaction = null,
  returnFocusTo = null,
  onClose,
}: {
  initialType: TxType;
  /** Pre-ordered: most-used-this-cycle, then recently-used, then alphabetical. */
  expenseCategoryNames: string[];
  /** Pre-ordered, same rule as expenseCategoryNames. */
  savingsCategoryNames: string[];
  /** Only used to default the Income name field when creating (not editing). */
  lastUsedIncomeName?: string | null;
  /** "YYYY-MM-DD" — the current cycle's periodStart, the Date field's minimum (can't log something before the quincena it's being logged into started). */
  cycleStartDate: string;
  /** Present -> the sheet edits (and can delete) this transaction instead of creating a new one. */
  editingTransaction?: EditingTransaction | null;
  /** The button that opened this sheet — focus returns here on close. Needed because the amount field's own autoFocus would otherwise race the trigger-capture. */
  returnFocusTo?: HTMLElement | null;
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
  const router = useRouter();
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

  // Editing looks at the transaction's actual CATEGORY, not its display
  // name — those differ for a Gmail-imported transaction (name is the raw
  // merchant string, category is "Bank Import"). A category that isn't in
  // the known list (renamed/deleted since, or exactly this imported case)
  // falls back to free-text mode, pre-filled with its current category.
  const editingCategoryName =
    editingTransaction && editingTransaction.type !== "INCOME"
      ? (editingTransaction.categoryName ?? editingTransaction.name)
      : null;

  const [customMode, setCustomMode] = useState(
    () =>
      editingCategoryName !== null &&
      !categoryNamesForType(editingTransaction!.type).includes(editingCategoryName),
  );
  const [customName, setCustomName] = useState(() => {
    if (editingTransaction) {
      if (editingTransaction.type === "INCOME") return editingTransaction.name;
      return categoryNamesForType(editingTransaction.type).includes(editingCategoryName!)
        ? ""
        : editingCategoryName!;
    }
    return initialType === "INCOME" ? (lastUsedIncomeName ?? "") : "";
  });
  // The list is already ordered most-used-first, so its head is the default
  // when creating; editing pre-selects the transaction's own category.
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (editingCategoryName !== null) return editingCategoryName;
    return categoryNames[0] ?? "";
  });
  const [amount, setAmount] = useState(editingTransaction ? editingTransaction.amount.toFixed(2) : "");
  // "More…" expands the chip row to the full ordered list — starts expanded
  // if editing a category that wouldn't otherwise be visible in the top 6.
  const [showAllCategories, setShowAllCategories] = useState(() => {
    if (editingCategoryName === null) return false;
    const list = categoryNamesForType(editingTransaction!.type);
    return list.length > TOP_CHIP_COUNT && !list.slice(0, TOP_CHIP_COUNT).includes(editingCategoryName);
  });
  // EXPENSE-only, optional — left unset ("") is a valid choice, not every
  // purchase needs a recorded method.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    editingTransaction?.paymentMethod ?? "",
  );
  const [occurredAt, setOccurredAt] = useState(editingTransaction?.occurredAt ?? formatCycleLabel());
  const [description, setDescription] = useState(editingTransaction?.description ?? "");
  const todayDate = formatCycleLabel();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  // Runs the same checks the date/amount inputs' native `required`/`min`/
  // `max` attributes used to enforce — but explicitly, in JS, so a blocked
  // submit always shows this sheet's own inline error instead of silently
  // doing nothing (or nothing visible) the way native constraint
  // validation could. The server re-validates independently regardless;
  // this is purely for instant feedback without a round trip.
  function validate(): string | null {
    if (!amount.trim() || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return "Enter a valid amount";
    }
    if (type === "INCOME" && !customName.trim()) {
      return "Give it a name";
    }
    if (type !== "INCOME" && !categoryValue.trim()) {
      return "Choose or enter a category";
    }
    if (!occurredAt) {
      return "Date is required";
    }
    if (occurredAt > todayDate) {
      return "Date can't be in the future";
    }
    // The cycle-start floor is a create-time-only affordance — editing
    // allows any past date (see updateTransactionAction).
    if (!isEditing && occurredAt < cycleStartDate) {
      return "Date must be within this quincena";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
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
          deleteTransactionAction(undefined, fd).then(() => router.refresh());
        },
      });
    }

    setPending(false);
    router.refresh();
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
          if (d.paymentMethod) restoreFd.set("paymentMethod", d.paymentMethod);
          if (d.description) restoreFd.set("description", d.description);
          restoreTransactionAction(restoreFd).then(() => router.refresh());
        },
      });
    }

    router.refresh();
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
  const categoryValue = usingCustomInput ? customName : selectedCategory;
  // Picking a different category while editing an EXPENSE/SAVINGS
  // transaction must not silently rewrite its display name — most visible
  // for a Gmail-imported transaction, whose name is the merchant string,
  // distinct from its category. INCOME already has its own explicit Name
  // field (customName); creating has no prior name to preserve, so name and
  // category stay the same value there, exactly as manual entry always has.
  const nameValue =
    type === "INCOME" ? customName : isEditing ? editingTransaction.name : categoryValue;

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

        <form onSubmit={handleSubmit} noValidate>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="name" value={nameValue} />
          {type !== "INCOME" && <input type="hidden" name="category" value={categoryValue} />}
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

          <div className="field">
            <label htmlFor="sheet-date">Date</label>
            <input
              id="sheet-date"
              name="occurredAt"
              type="date"
              value={occurredAt}
              // The cycle-start floor is a create-time affordance only —
              // an existing transaction can be edited to any past date (it
              // moves to whichever cycle that date actually belongs to;
              // see updateTransactionAction). Form has noValidate, and
              // validate() re-checks this explicitly either way, so this
              // is just the picker widget's own hint, never a submit-blocker.
              min={isEditing ? undefined : cycleStartDate}
              max={todayDate}
              onChange={(e) => setOccurredAt(e.target.value)}
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

          {type === "EXPENSE" && (
            <div className="field">
              <label>Payment method</label>
              <input type="hidden" name="paymentMethod" value={paymentMethod} />
              <div className="category-chips">
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`category-chip ${paymentMethod === opt.value ? "is-active" : ""}`}
                    onClick={() => setPaymentMethod((current) => (current === opt.value ? "" : opt.value))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="sheet-description">Note (optional)</label>
            <input
              id="sheet-description"
              name="description"
              type="text"
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? (isEditing ? "Saving..." : "Logging...") : isEditing ? "Save changes" : "Log it"}
          </button>
        </form>

        {isEditing && editingTransaction.isDeletable !== false && (
          <button
            type="button"
            className="sheet-delete"
            disabled={deletePending}
            onClick={handleDelete}
          >
            {deletePending ? "Deleting..." : "Delete transaction"}
          </button>
        )}
        {isEditing && editingTransaction.isDeletable === false && (
          <p className="field-hint" style={{ textAlign: "center", marginTop: "0.75rem" }}>
            This quincena is closed, so this transaction can be edited but not deleted.
          </p>
        )}
      </div>
    </div>
  );
}
