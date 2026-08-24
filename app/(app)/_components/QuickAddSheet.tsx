"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addTransactionAction,
  deleteTransactionAction,
  restoreTransactionAction,
  resolveCycleForDateAction,
  updateTransactionAction,
  type CyclePreview,
} from "../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel, nowInPanama } from "@/lib/pay-date";
import { AMOUNT_NOT_POSITIVE_MESSAGE, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";
import { useToast } from "./ToastProvider";
import { useModalFocus } from "./useModalFocus";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";
type PaymentMethod = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY" | "ACH";

export interface EditingTransaction {
  id: string;
  /** Which cycle this row actually belongs to today — the "expected" cycle a date edit is compared against to decide whether to show the cross-cycle move confirmation. */
  cycleId: string;
  type: TxType;
  name: string;
  /** Null only for an uncategorized row — every type has a category concept now. */
  categoryName: string | null;
  amount: number;
  /** SAVINGS never has one; null on EXPENSE/INCOME just means never set. */
  paymentMethod: PaymentMethod | null;
  /** "YYYY-MM-DD" — prefills the Date field. */
  occurredAt: string;
  /** What it was for, beyond name/merchant — e.g. Yappy's own "Mensaje" note. Null if never set. */
  description: string | null;
  /** Set once this transaction is linked to a recurring expense — drives whether the "This is a recurring expense" toggle starts on. */
  recurringExpenseId: string | null;
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
  { value: "ACH", label: "ACH" },
];

const SWIPE_DISMISS_THRESHOLD = 90;
const TOP_CHIP_COUNT = 6;

export function QuickAddSheet({
  initialType,
  expenseCategoryNames,
  savingsCategoryNames,
  incomeCategoryNames,
  cycleStartDate,
  editingTransaction = null,
  targetCycleId,
  returnFocusTo = null,
  onClose,
}: {
  initialType: TxType;
  /** Pre-ordered: most-used-this-cycle, then recently-used, then alphabetical. */
  expenseCategoryNames: string[];
  /** Pre-ordered, same rule as expenseCategoryNames. */
  savingsCategoryNames: string[];
  /** Pre-ordered, same rule as expenseCategoryNames. */
  incomeCategoryNames: string[];
  /** "YYYY-MM-DD" — the current cycle's periodStart, the Date field's minimum (can't log something before the quincena it's being logged into started). Ignored when isEditing or targetCycleId is set — both allow any past date. */
  cycleStartDate: string;
  /** Present -> the sheet edits (and can delete) this transaction instead of creating a new one. */
  editingTransaction?: EditingTransaction | null;
  /** Present when creating from a specific (possibly past) quincena's own page rather than "wherever today's cycle is" — passed to addTransactionAction as a hint, and used to detect a cross-cycle move the same way editingTransaction.cycleId is for edits. */
  targetCycleId?: string;
  /** The button that opened this sheet — focus returns here on close. Needed because the amount field's own autoFocus would otherwise race the trigger-capture. */
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const isEditing = editingTransaction !== null;
  // The cycle this transaction is currently expected to belong to — compared
  // against where a candidate date actually resolves to, to decide whether
  // the cross-cycle move confirmation is needed. Undefined (Home/Transactions'
  // plain "+", no targetCycleId) means "wherever the date resolves to is
  // fine," skipping the check entirely.
  const moveCheckCycleId = isEditing ? editingTransaction.cycleId : targetCycleId;

  // Calling the server actions directly (rather than via useActionState)
  // and doing the toast + close in the same async function is deliberate:
  // these actions revalidate this very page, and a subsequent re-render can
  // tear this component down before a separate "pending -> false" effect
  // gets a chance to run — dropping the toast. Awaiting inline sidesteps
  // that race entirely.
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which field validate() blamed, so it (not just the red text) gets the invalid-state ring. Null for a server-side error, which validate() never produced and isn't reliably attributable to one field. */
  const [errorField, setErrorField] = useState<"amount" | "category" | "date" | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  /** Set when a submit's date resolves to a different cycle than moveCheckCycleId — blocks the real submit until Continue/Cancel. */
  const [pendingMove, setPendingMove] = useState<CyclePreview | null>(null);
  const [movePending, setMovePending] = useState(false);
  const pendingSubmitFormData = useRef<FormData | null>(null);

  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<TxType>(editingTransaction?.type ?? initialType);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  function categoryNamesForType(t: TxType): string[] {
    return t === "EXPENSE" ? expenseCategoryNames : t === "SAVINGS" ? savingsCategoryNames : incomeCategoryNames;
  }

  const categoryNames = categoryNamesForType(type);

  // Editing looks at the transaction's actual CATEGORY, not its display
  // name — those differ for a Gmail-imported transaction (name is the raw
  // merchant string, category is "Bank Import"). A category that isn't in
  // the known list (renamed/deleted since, or exactly this imported case)
  // falls back to free-text mode, pre-filled with its current category.
  const editingCategoryName = editingTransaction
    ? (editingTransaction.categoryName ?? editingTransaction.name)
    : null;

  const [customMode, setCustomMode] = useState(
    () =>
      editingCategoryName !== null &&
      !categoryNamesForType(editingTransaction!.type).includes(editingCategoryName),
  );
  const [customName, setCustomName] = useState(() => {
    if (editingTransaction) {
      return categoryNamesForType(editingTransaction.type).includes(editingCategoryName!)
        ? ""
        : editingCategoryName!;
    }
    return "";
  });
  // The list is already ordered most-used-first, so its head is the default
  // when creating; editing pre-selects the transaction's own category.
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (editingCategoryName !== null) return editingCategoryName;
    return categoryNames[0] ?? "";
  });
  const usingCustomInput = customMode || categoryNames.length === 0;
  const categoryValue = usingCustomInput ? customName : selectedCategory;
  // Merchant/payee name, separate from category -- pre-filled with the
  // category as a starting suggestion (so a user who doesn't care can
  // leave it as-is and lose zero speed) but freely editable, on both
  // create and edit. Derived, not synced-via-effect: displayName only
  // reads from typed-into `name` state once the user has actually typed
  // (nameTouched) or when editing (an existing transaction's name must
  // never silently follow a later category change) -- otherwise it just
  // tracks categoryValue live, with no extra render/effect needed.
  const [name, setName] = useState(editingTransaction?.name ?? "");
  const [nameTouched, setNameTouched] = useState(false);
  const displayName = isEditing || nameTouched ? name : categoryValue;
  const [amount, setAmount] = useState(editingTransaction ? editingTransaction.amount.toFixed(2) : "");
  // "More…" expands the chip row to the full ordered list — starts expanded
  // if editing a category that wouldn't otherwise be visible in the top 6.
  const [showAllCategories, setShowAllCategories] = useState(() => {
    if (editingCategoryName === null) return false;
    const list = categoryNamesForType(editingTransaction!.type);
    return list.length > TOP_CHIP_COUNT && !list.slice(0, TOP_CHIP_COUNT).includes(editingCategoryName);
  });
  // Optional for EXPENSE/INCOME — left unset ("") is a valid choice, not
  // every purchase or deposit needs a recorded method.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    editingTransaction?.paymentMethod ?? "",
  );
  // Creating into a specific past cycle defaults the date to that cycle's
  // own start — "today" would often fall well outside it, misfiring the
  // cross-cycle move confirmation the moment the sheet opens.
  const [occurredAt, setOccurredAt] = useState(
    editingTransaction?.occurredAt ?? (targetCycleId ? cycleStartDate : formatCycleLabel(nowInPanama())),
  );
  const [description, setDescription] = useState(editingTransaction?.description ?? "");
  // EXPENSE-only, matching the toggle's own visibility below — starts on
  // when editing a transaction that's already linked to a recurring expense.
  const [recurring, setRecurring] = useState(
    editingTransaction ? editingTransaction.recurringExpenseId !== null : false,
  );
  // Panama time, not the device's own local clock — a transaction date is
  // validated server-side against nowInPanama() regardless of where the
  // user's device thinks it is (traveling, a misconfigured clock, or just
  // any non-Panama timezone), so "today" has to agree with that here too.
  // Using the browser's own new Date() let this field silently disagree
  // with the server by up to a full day whenever the two didn't share a
  // calendar date yet (e.g. late evening in a timezone ahead of Panama).
  const todayDate = formatCycleLabel(nowInPanama());

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
  function validate(): { field: "amount" | "category" | "date"; message: string } | null {
    if (!amount.trim() || Number.isNaN(Number(amount))) {
      return { field: "amount", message: INVALID_AMOUNT_FORMAT_MESSAGE };
    }
    if (Number(amount) <= 0) {
      return { field: "amount", message: AMOUNT_NOT_POSITIVE_MESSAGE };
    }
    if (!categoryValue.trim()) {
      return { field: "category", message: "Choose or enter a category" };
    }
    if (!occurredAt) {
      return { field: "date", message: "Date is required" };
    }
    if (occurredAt > todayDate) {
      return { field: "date", message: "Date can't be in the future" };
    }
    // The cycle-start floor only applies to a plain create (Home/Transactions'
    // "+", no explicit target) — editing, and creating directly into a
    // specific past quincena, both allow any past date (see
    // updateTransactionAction / addTransactionAction's cycleId-hint path).
    if (!isEditing && !targetCycleId && occurredAt < cycleStartDate) {
      return { field: "date", message: "Date must be within this quincena" };
    }
    return null;
  }

  async function submitForm(formData: FormData) {
    setPending(true);
    setError(null);
    setErrorField(null);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError.message);
      setErrorField(validationError.field);
      return;
    }
    const formData = new FormData(e.currentTarget);

    // Don't move a transaction to a different quincena silently — check
    // where this date actually resolves to before submitting, and if it
    // disagrees with where the row is expected to end up, hold the submit
    // and ask first (see handleConfirmMove/handleCancelMove).
    if (moveCheckCycleId) {
      const resolved = await resolveCycleForDateAction(occurredAt);
      if (resolved && resolved.cycleId !== moveCheckCycleId) {
        pendingSubmitFormData.current = formData;
        setPendingMove(resolved);
        return;
      }
    }

    await submitForm(formData);
  }

  async function handleConfirmMove() {
    const formData = pendingSubmitFormData.current;
    setPendingMove(null);
    pendingSubmitFormData.current = null;
    if (!formData) return;
    setMovePending(true);
    await submitForm(formData);
    setMovePending(false);
  }

  function handleCancelMove() {
    setPendingMove(null);
    pendingSubmitFormData.current = null;
    // Edits have an original value worth reverting to; a brand-new row has
    // no "original" — leave the date as typed so it can just be adjusted.
    if (isEditing) {
      setOccurredAt(editingTransaction.occurredAt);
    }
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

  // Left blank (or left matching the category), the submitted name simply
  // falls back to the category -- not required to differ, matching the old
  // zero-extra-step behavior for anyone who doesn't care about this field.
  const nameValue = displayName.trim() || categoryValue;

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
          <input type="hidden" name="category" value={categoryValue} />
          {isEditing && (
            <input type="hidden" name="transactionId" value={editingTransaction.id} />
          )}
          {!isEditing && targetCycleId && (
            <input type="hidden" name="cycleId" value={targetCycleId} />
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
              className={`sheet-amount-input ${errorField === "amount" ? "is-invalid" : ""}`}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="field">
            <label htmlFor="sheet-name">Merchant / name (optional)</label>
            <input
              id="sheet-name"
              type="text"
              placeholder="e.g. Panapass, Cafe Unido…"
              value={displayName}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
              maxLength={100}
            />
          </div>

          <div className="field">
            <label htmlFor="sheet-date">Date</label>
            <input
              id="sheet-date"
              name="occurredAt"
              type="date"
              value={occurredAt}
              // The cycle-start floor only applies to a plain create with no
              // explicit target cycle — editing, and creating directly into
              // a specific past quincena, both allow any past date (it
              // resolves to whichever cycle that date actually belongs to;
              // see updateTransactionAction / addTransactionAction). Form
              // has noValidate, and validate() re-checks this explicitly
              // either way, so this is just the picker widget's own hint,
              // never a submit-blocker.
              min={isEditing || targetCycleId ? undefined : cycleStartDate}
              max={todayDate}
              onChange={(e) => setOccurredAt(e.target.value)}
              className={errorField === "date" ? "is-invalid" : ""}
            />
          </div>

          <div className="field">
            <label>Category</label>
            {!customMode && categoryNames.length > 0 && (
              <div
                className={`category-chips ${showAllCategories ? "category-chips--wrap" : ""} ${errorField === "category" ? "is-invalid" : ""}`}
              >
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
                className={errorField === "category" ? "is-invalid" : ""}
              />
            )}
          </div>

          {type === "EXPENSE" && (
            <div className="field">
              <input type="hidden" name="recurring" value={recurring ? "true" : "false"} />
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                />
                This is a recurring expense
              </label>
            </div>
          )}

          {type !== "SAVINGS" && (
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

          {pendingMove ? (
            <div style={{ textAlign: "center" }}>
              <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
                Changing this date will move this transaction to a different quincena (
                {pendingMove.rangeText}). Its totals and the totals for that quincena will be
                recalculated. Continue?
              </p>
              <button
                type="button"
                className="button sheet-submit"
                disabled={movePending}
                onClick={handleConfirmMove}
              >
                {movePending ? "Moving..." : "Continue"}
              </button>
              <button
                type="button"
                className="button button--secondary sheet-submit"
                disabled={movePending}
                onClick={handleCancelMove}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button type="submit" className="button sheet-submit" disabled={pending}>
              {pending ? (isEditing ? "Saving..." : "Logging...") : isEditing ? "Save changes" : "Log it"}
            </button>
          )}
        </form>

        {isEditing && !pendingMove && (
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
