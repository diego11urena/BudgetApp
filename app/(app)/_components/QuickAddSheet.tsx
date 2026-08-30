"use client";

import { useEffect, useId, useRef, useState } from "react";
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
import { AMOUNT_NOT_POSITIVE_MESSAGE, validateAmountFormat } from "@/lib/validations/shared";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-method";
import { TRANSACTION_TYPE_OPTIONS as TYPE_OPTIONS, type TransactionType as TxType } from "@/lib/transaction-type";
import { useToast } from "./ToastProvider";
import { Sheet } from "./Sheet";

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

const SWIPE_DISMISS_THRESHOLD = 90;

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
  const [errorField, setErrorField] = useState<"amount" | "name" | "category" | "date" | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  /** Set when a submit's date resolves to a different cycle than moveCheckCycleId — blocks the real submit until Continue/Cancel. */
  const [pendingMove, setPendingMove] = useState<CyclePreview | null>(null);
  const [movePending, setMovePending] = useState(false);
  const pendingSubmitFormData = useRef<FormData | null>(null);

  const [visible, setVisible] = useState(false);
  const [type, setType] = useState<TxType>(editingTransaction?.type ?? initialType);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const uid = useId();
  const amountId = `${uid}-amount`;
  const nameId = `${uid}-name`;
  const dateId = `${uid}-date`;
  const descriptionId = `${uid}-description`;
  const errorId = `${uid}-error`;
  const categoryId = `${uid}-category`;
  const paymentMethodId = `${uid}-payment-method`;

  function categoryNamesForType(t: TxType): string[] {
    return t === "EXPENSE" ? expenseCategoryNames : t === "SAVINGS" ? savingsCategoryNames : incomeCategoryNames;
  }

  const categoryNames = categoryNamesForType(type);

  // Editing looks at the transaction's actual CATEGORY, not its display
  // name — those differ for a Gmail-imported transaction (name is the raw
  // merchant string, category is "Bank Import"). A category that isn't in
  // the known list (renamed/deleted since, or exactly this imported case)
  // still becomes categoryValue's initial value below -- isCreatingCategory
  // notices it isn't a real pickable category and falls back to the
  // free-text input so it renders/stays editable instead of being lost.
  const editingCategoryName = editingTransaction
    ? (editingTransaction.categoryName ?? editingTransaction.name)
    : null;

  // The list is already ordered most-used-first, so its head is the default
  // when creating; editing pre-selects the transaction's own category.
  const [categoryValue, setCategoryValue] = useState(() => {
    if (editingCategoryName !== null) return editingCategoryName;
    return categoryNames[0] ?? "";
  });
  // The category <select>'s "+ New category…" option switches to a free-
  // text input instead -- creating a category while logging a transaction
  // is a real, used flow (this is one of four places in the app that can
  // create one on the fly), not just a picker. Starts true whenever the
  // current categoryValue isn't actually one of this type's known
  // categories: either there are none yet (a brand-new user, nothing to
  // pick from), or -- when editing -- the transaction's own category was
  // renamed/deleted since, or is a Gmail-import placeholder ("Bank
  // Import") that was never a real pickable category to begin with. A
  // plain <select> silently showing nothing selected in that case would
  // read as "no category," not "an unusual one" -- the free-text fallback
  // is what keeps the real value visible and editable instead of lost.
  const [isCreatingCategory, setIsCreatingCategory] = useState(
    () => categoryNames.length === 0 || (categoryValue !== "" && !categoryNames.includes(categoryValue)),
  );
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
  // Math.abs -- a savings withdrawal is the one case where
  // editingTransaction.amount can itself be negative (see TransactionList's
  // own comment on the same thing). The field always shows a plain
  // positive number to type/edit, same as every other amount in this app;
  // updateTransactionAction re-applies the withdrawal's negative sign
  // server-side, from the existing row's own stored sign, not from
  // anything this form submits.
  const [amount, setAmount] = useState(editingTransaction ? Math.abs(editingTransaction.amount).toFixed(2) : "");
  // Optional for EXPENSE/INCOME — left unset ("") is a valid choice, not
  // every purchase or deposit needs a recorded method.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(editingTransaction?.paymentMethod ?? "");
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

  // Runs the same checks the date/amount inputs' native `required`/`min`/
  // `max` attributes used to enforce — but explicitly, in JS, so a blocked
  // submit always shows this sheet's own inline error instead of silently
  // doing nothing (or nothing visible) the way native constraint
  // validation could. The server re-validates independently regardless;
  // this is purely for instant feedback without a round trip.
  function validate(): { field: "amount" | "name" | "category" | "date"; message: string } | null {
    const amountFormatError = validateAmountFormat(amount);
    if (amountFormatError) {
      return { field: "amount", message: amountFormatError };
    }
    if (Number(amount) <= 0) {
      return { field: "amount", message: AMOUNT_NOT_POSITIVE_MESSAGE };
    }
    if (!displayName.trim()) {
      return { field: "name", message: "Enter a merchant or business name" };
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
    // try/finally, not a bare await: a rejected promise (a network failure,
    // not a validation/server error -- those already come back as a normal
    // { error } return) would otherwise skip every line below, including
    // setPending(false), leaving the submit button disabled forever with
    // no way to retry.
    try {
      const result = await action(undefined, formData);

      if (result && "error" in result) {
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

      if (isEditing && result && "transactionId" in result && result.message) {
        showToast(result.message);
      }

      router.refresh();
      handleClose();
    } catch {
      setError("Something went wrong. Your changes weren't saved — please try again.");
    } finally {
      setPending(false);
    }
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
    try {
      const fd = new FormData();
      fd.set("transactionId", editingTransaction.id);
      const result = await deleteTransactionAction(undefined, fd);

      if (result && "error" in result) {
        showToast(result.error);
        return;
      }

      if (result && "deleted" in result) {
        const d = result.deleted;
        showToast(`Deleted ${formatCurrency(d.amount)} — ${d.name}`, {
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
            if (d.expenseCategoryId) restoreFd.set("expenseCategoryId", d.expenseCategoryId);
            if (d.recurringExpenseId) restoreFd.set("recurringExpenseId", d.recurringExpenseId);
            restoreFd.set("importSource", d.importSource);
            if (d.sourceMessageId) restoreFd.set("sourceMessageId", d.sourceMessageId);
            restoreTransactionAction(restoreFd).then(() => router.refresh());
          },
        });
      }

      router.refresh();
      handleClose();
    } catch {
      showToast("Something went wrong. Your changes weren't saved — please try again.");
    } finally {
      setDeletePending(false);
    }
  }

  function handleTypeChange(next: TxType) {
    setType(next);
    const nextCategoryNames = categoryNamesForType(next);
    setCategoryValue(nextCategoryNames[0] ?? "");
    // The category <select> is keyed by `type` (forcing a fresh DOM node),
    // but isCreatingCategory itself lives here, not in a remountable
    // child, so it needs its own explicit reset -- otherwise switching
    // from a type with no categories yet (create-mode forced on) to one
    // that already has some would leave the free-text input showing for a
    // type it was never true for.
    setIsCreatingCategory(nextCategoryNames.length === 0);
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

  return (
    <Sheet
      visible={visible}
      ariaLabel={isEditing ? "Edit transaction" : "Log a transaction"}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
      panelRef={sheetRef}
      // Swipe-to-dismiss listens on the handle only, matching
      // .sheet-handle's own touch-action: none in globals.css -- attached
      // to the whole sheet, these would fight finger-scrolling through the
      // sheet's own (now scrollable, see 0.2) body.
      handleProps={{ onTouchStart: handleDragStart, onTouchMove: handleDragMove, onTouchEnd: handleDragEnd }}
    >
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
        {isEditing && <input type="hidden" name="transactionId" value={editingTransaction.id} />}
        {!isEditing && targetCycleId && <input type="hidden" name="cycleId" value={targetCycleId} />}

        <div className="field sheet-amount-field">
          <label htmlFor={amountId}>Amount (USD)</label>
          <input
            id={amountId}
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
            aria-invalid={errorField === "amount" || undefined}
            aria-describedby={errorField === "amount" ? errorId : undefined}
          />
        </div>

        <div className="field" key={type}>
          <label htmlFor={categoryId}>Category</label>
          <select
            id={categoryId}
            value={isCreatingCategory ? "__new__" : categoryValue}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setIsCreatingCategory(true);
                setCategoryValue("");
              } else {
                setIsCreatingCategory(false);
                setCategoryValue(e.target.value);
              }
            }}
            required
            className={errorField === "category" && !isCreatingCategory ? "is-invalid" : ""}
            aria-invalid={errorField === "category" || undefined}
            aria-describedby={errorField === "category" ? errorId : undefined}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categoryNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="__new__">+ New category…</option>
          </select>

          {isCreatingCategory && (
            <input
              type="text"
              name="category"
              autoFocus
              required
              placeholder="New category name"
              value={categoryValue}
              onChange={(e) => setCategoryValue(e.target.value)}
              className={errorField === "category" ? "is-invalid" : ""}
              aria-invalid={errorField === "category" || undefined}
              aria-describedby={errorField === "category" ? errorId : undefined}
            />
          )}
          {!isCreatingCategory && <input type="hidden" name="category" value={categoryValue} />}
        </div>

        <div className="field">
          <label htmlFor={nameId}>Merchant / name</label>
          <input
            id={nameId}
            name="name"
            type="text"
            placeholder="e.g. Panapass, Cafe Unido…"
            value={displayName}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            required
            maxLength={100}
            className={errorField === "name" ? "is-invalid" : ""}
            aria-invalid={errorField === "name" || undefined}
            aria-describedby={errorField === "name" ? errorId : undefined}
          />
        </div>

        <div className="field">
          <label htmlFor={dateId}>Date</label>
          <input
            id={dateId}
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
            aria-invalid={errorField === "date" || undefined}
            aria-describedby={errorField === "date" ? errorId : undefined}
          />
        </div>

        {type !== "SAVINGS" && (
          <div className="field">
            <label htmlFor={paymentMethodId}>Payment method</label>
            <select
              id={paymentMethodId}
              name="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
            >
              <option value="">No payment method</option>
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === "EXPENSE" && (
          <div className="field">
            <input type="hidden" name="recurring" value={recurring ? "true" : "false"} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              This is a bill
            </label>
          </div>
        )}

        <div className="field">
          <label htmlFor={descriptionId}>Note (optional)</label>
          <input
            id={descriptionId}
            name="description"
            type="text"
            placeholder="What was this for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>

          {error && (
            <p id={errorId} className="error-text" role="alert">
              {error}
            </p>
          )}

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
    </Sheet>
  );
}
