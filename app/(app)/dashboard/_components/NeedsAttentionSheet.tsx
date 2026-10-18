"use client";

import { useEffect, useRef, useState } from "react";
import { useSheetVisibility } from "../../_components/useSheet";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { categorizeTransactionAction, describeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import type { NeedsAttentionTransaction } from "@/lib/needs-attention";
import type { RecurringOption } from "../../_components/RecurringExpensePicker";
import { useT } from "@/app/_components/LocaleProvider";

/**
 * Replaces what used to be two separate banners/sheets (Categorize
 * transactions, What were these for?) -- a transaction imported with
 * neither a category nor a description (a Yappy transfer with no learned
 * merchant category, most commonly) used to show up in BOTH, forcing two
 * separate trips through two separate sheets to finish the same row. One
 * sheet now, one row per transaction, showing exactly whichever field(s)
 * that transaction is actually missing.
 */
export function NeedsAttentionSheet({
  initialTransactions,
  expenseCategoryNames,
  incomeCategoryNames,
  savingsCategoryNames,
  recurringOptions,
  returnFocusTo = null,
  onClose,
}: {
  initialTransactions: NeedsAttentionTransaction[];
  /** Each row picks its list by its own type — a Savings row must never be offered Expense category names, and vice versa. */
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
  savingsCategoryNames: string[];
  /** Feeds each EXPENSE row's own "Which recurring expense?" picker, once its "This is a recurring expense" checkbox is on. */
  recurringOptions: RecurringOption[];
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  function categoryNamesForType(type: NeedsAttentionTransaction["type"]): string[] {
    return type === "EXPENSE"
      ? expenseCategoryNames
      : type === "SAVINGS"
        ? savingsCategoryNames
        : incomeCategoryNames;
  }
  const t = useT().dashboard;
  const { visible, closeThen } = useSheetVisibility();
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [closing, setClosing] = useState(false);
  // Each row registers a "save what I have, if it's valid" function, so
  // closing can keep partial progress instead of throwing it away.
  const rowSaves = useRef(new Map<string, () => Promise<boolean>>());

  function handleClose() {
    closeThen(onClose);
  }

  // Done for now, Escape, backdrop tap and drag-down all land here: save
  // every row the user actually filled in (untouched and half-filled rows
  // are skipped by the row itself), then close regardless.
  async function handleCloseSavingProgress() {
    if (closing) return;
    setClosing(true);
    let savedAny = false;
    for (const save of [...rowSaves.current.values()]) {
      if (await save()) savedAny = true;
    }
    if (savedAny) router.refresh();
    handleClose();
  }

  function handleDone(transactionId: string) {
    // Computed from the current `transactions` state directly, not a
    // setTransactions functional updater -- React may invoke an updater
    // more than once (StrictMode, a concurrent re-render), which would
    // fire handleClose()'s side effects (onClose, the close animation)
    // twice. Each row calls this from its own completed async action, one
    // at a time, so there's no risk of missing a concurrent removal that
    // the functional form was guarding against.
    const next = transactions.filter((t) => t.id !== transactionId);
    setTransactions(next);
    if (next.length === 0) handleClose();
  }

  return (
    <Sheet
      visible={visible}
      title={t.finishTransactionsTitle}
      titleStyle={{ marginBottom: "0.5rem" }}
      onClose={handleCloseSavingProgress}
      closeOnBackdropClick={!closing}
      returnFocusTo={returnFocusTo}
      // autoFocus off: this sheet should appear passively, with no field
      // grabbing the keyboard/cursor until the user deliberately taps one
      // -- same reasoning as the two sheets this one replaces (see
      // useModalFocus's own doc comment).
      autoFocus={false}
    >
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        {t.finishTransactionsBody}
      </p>

      <div
        className="categorize-imports-list"
        // Tapping anything that isn't a text field dismisses the keyboard
        // (iOS keeps it up otherwise).
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          const active = document.activeElement as HTMLElement | null;
          if (
            active?.matches("input[type=text]") &&
            !target.closest("input[type=text]")
          ) {
            active.blur();
          }
        }}
      >
        {transactions.map((transaction) => (
          <NeedsAttentionRow
            key={transaction.id}
            transaction={transaction}
            categoryNames={categoryNamesForType(transaction.type)}
            recurringOptions={recurringOptions}
            onDone={() => handleDone(transaction.id)}
            registerSave={(save) => {
              if (save) rowSaves.current.set(transaction.id, save);
              else rowSaves.current.delete(transaction.id);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        className="button button--secondary sheet-submit"
        onClick={handleCloseSavingProgress}
        disabled={closing}
      >
        {closing ? t.saving : t.doneForNow}
      </button>
    </Sheet>
  );
}

const NEW = "__new__";

function NeedsAttentionRow({
  transaction,
  categoryNames,
  recurringOptions,
  onDone,
  registerSave,
}: {
  transaction: NeedsAttentionTransaction;
  categoryNames: string[];
  recurringOptions: RecurringOption[];
  onDone: () => void;
  registerSave: (save: (() => Promise<boolean>) | null) => void;
}) {
  const t = useT();
  const td = t.dashboard;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Native <select>s (iOS opens its own picker, no keyboard); NEW reveals a
  // text field for a custom name -- the only path that opens the keyboard.
  const [categoryChoice, setCategoryChoice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurringChoice, setRecurringChoice] = useState(""); // a RecurringExpense id, NEW, or ""
  const [newRecurringName, setNewRecurringName] = useState(transaction.name);
  const [description, setDescription] = useState("");

  const label =
    transaction.needsDescription
      ? (transaction.direction === "sent" ? td.sentTo(transaction.name) : td.receivedFrom(transaction.name))
      : transaction.name;

  const formRef = useRef<HTMLFormElement>(null);
  const category = categoryChoice === NEW ? newCategory.trim() : categoryChoice;
  const desc = description.trim();
  const canRecur = transaction.needsCategory && transaction.type === "EXPENSE";
  const isRecurring = canRecur && recurring;
  const recurringIncomplete =
    isRecurring && (recurringChoice === "" || (recurringChoice === NEW && !newRecurringName.trim()));

  /** Saves whichever of the two fields are filled in; returns an error message or null. */
  async function persist(): Promise<string | null> {
    // Sequential, not parallel -- categorizeTransactionAction can create a
    // brand-new category (getOrCreateCategory) that the description update
    // has no reason to race against; two round trips to the two existing
    // actions keep each one's own validation/ownership logic.
    if (transaction.needsCategory && category) {
      const fd = new FormData();
      fd.set("transactionId", transaction.id);
      fd.set("category", category);
      if (isRecurring) {
        fd.set("recurring", "true");
        if (recurringChoice === NEW) {
          fd.set("recurringExpenseName", newRecurringName.trim());
        } else {
          fd.set("recurringExpenseId", recurringChoice);
          fd.set("recurringExpenseName", recurringOptions.find((o) => o.id === recurringChoice)?.name ?? transaction.name);
        }
      }
      const result = await categorizeTransactionAction(fd);
      if ("error" in result) return result.error;
    }
    if (transaction.needsDescription && desc) {
      const fd = new FormData();
      fd.set("transactionId", transaction.id);
      fd.set("description", desc);
      const result = await describeTransactionAction(fd);
      if ("error" in result) return result.error;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
    setError(null);

    if (transaction.needsCategory && !category) {
      setError(td.chooseCategoryError);
      return;
    }
    if (recurringIncomplete) {
      setError(td.chooseRecurringError);
      return;
    }
    if (transaction.needsDescription && !desc) {
      setError(td.tellUsWhatItWasForError);
      return;
    }

    setPending(true);
    const failure = await persist();
    if (failure) {
      setPending(false);
      setError(failure);
      return;
    }
    router.refresh();
    onDone();
  }

  // For closing the sheet: save only if the user filled something in and
  // nothing is half-done (recurring on with no recurring expense chosen).
  // Errors are swallowed -- closing is never blocked; the row just stays
  // "needs info". Re-registered every render so it sees the latest state.
  const saveIfValid = async () => {
    if (pending || (!category && !desc) || recurringIncomplete) return false;
    return (await persist()) === null;
  };
  useEffect(() => {
    registerSave(saveIfValid);
  });
  useEffect(() => () => registerSave(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the row's Save visible once the keyboard has opened: scroll Save
  // into view, then the focused field -- "nearest", so nothing moves if
  // they're already visible.
  function revealRow(field: HTMLElement) {
    setTimeout(() => {
      formRef.current?.querySelector("button[type=submit]")?.scrollIntoView({ block: "nearest" });
      field.scrollIntoView({ block: "nearest" });
    }, 300);
  }

  return (
    <form
      ref={formRef}
      className="categorize-imports-row"
      onSubmit={handleSubmit}
      noValidate
      onFocus={(e) => {
        if (e.target.matches("input[type=text]")) revealRow(e.target);
      }}
    >
      <div className="categorize-imports-row-header">
        <span className="categorize-imports-row-name">{label}</span>
        <span className="categorize-imports-row-amount">{formatCurrency(transaction.amount)}</span>
      </div>

      {transaction.needsCategory && (
        <div className="categorize-imports-row-input">
          <select
            aria-label={t.quickAdd.categoryLabel}
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
          >
            <option value="" disabled>
              {t.quickAdd.chooseCategoryOption}
            </option>
            {categoryNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={NEW}>{t.quickAdd.newCategoryOption}</option>
          </select>
          {categoryChoice === NEW && (
            <input
              type="text"
              aria-label={t.quickAdd.newCategoryPlaceholder}
              placeholder={t.quickAdd.newCategoryPlaceholder}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
          )}
        </div>
      )}

      {/* Both always rendered for an expense (the picker just disabled while
          the switch is off), so toggling never moves Save. */}
      {canRecur && (
        <>
          <label className="needs-attention-switch">
            <input
              type="checkbox"
              // Safari 17.4+ draws a native iOS switch; others fall back to a checkbox.
              {...{ switch: "" }}
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            {td.isRecurringExpense}
          </label>
          <div className="categorize-imports-row-input">
            <select
              aria-label={td.whichRecurringExpenseLabel}
              value={recurringChoice}
              onChange={(e) => setRecurringChoice(e.target.value)}
              disabled={!recurring}
            >
              <option value="" disabled>
                {td.whichRecurringExpenseLabel}
              </option>
              {recurringOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {`${o.name} · ${formatCurrency(o.amount)}`}
                </option>
              ))}
              <option value={NEW}>{td.otherRecurringOption}</option>
            </select>
            {recurring && recurringChoice === NEW && (
              <input
                type="text"
                aria-label={td.newRecurringPlaceholder}
                placeholder={td.newRecurringPlaceholder}
                value={newRecurringName}
                onChange={(e) => setNewRecurringName(e.target.value)}
                maxLength={60}
                autoComplete="off"
                autoFocus
              />
            )}
          </div>
        </>
      )}

      {transaction.needsDescription && (
        <div className="categorize-imports-row-input">
          <input
            type="text"
            aria-label={td.whatWasThisForPlaceholder}
            placeholder={td.whatWasThisForPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="button button--small" disabled={pending}>
        {pending ? td.saving : td.save}
      </button>
    </form>
  );
}
