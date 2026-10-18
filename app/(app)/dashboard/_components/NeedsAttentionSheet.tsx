"use client";

import { useState } from "react";
import { useSheetVisibility } from "../../_components/useSheet";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { categorizeTransactionAction, describeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import type { NeedsAttentionTransaction } from "@/lib/needs-attention";
import type { RecurringOption } from "../../_components/RecurringExpensePicker";
import { useT } from "@/app/_components/LocaleProvider";

const MAX_RECURRING_SUGGESTIONS = 6;
const NEW = "__new__";

/**
 * One sheet for every imported transaction that's missing a category, a
 * description, or both -- one transaction at a time, advancing in place
 * after each Save and closing after the last. Opened only from
 * NeedsAttentionBanner's Review button, never automatically.
 *
 * Every choice is a tap target (chips), so the keyboard only opens when
 * the user picks "Create new" or fills the description. Save and Done for
 * now live in a footer pinned to the sheet's bottom edge; Sheet itself
 * keeps the panel above the on-screen keyboard.
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
  /** Each transaction picks its list by its own type — a Savings row must never be offered Expense category names, and vice versa. */
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
  savingsCategoryNames: string[];
  /** Feeds an EXPENSE transaction's "Which recurring expense?" chips, once "This is a recurring expense" is on. */
  recurringOptions: RecurringOption[];
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const t = useT().dashboard;
  const { visible, closeThen } = useSheetVisibility();
  // Snapshot: the dashboard re-fetches after each save, but this sheet walks
  // the list it opened with.
  const [queue] = useState(initialTransactions);
  const [index, setIndex] = useState(0);
  const current = queue[index];

  function handleClose() {
    closeThen(onClose);
  }

  function handleSaved() {
    if (index + 1 < queue.length) setIndex(index + 1);
    else handleClose();
  }

  const categoryNames =
    current.type === "EXPENSE" ? expenseCategoryNames : current.type === "SAVINGS" ? savingsCategoryNames : incomeCategoryNames;

  return (
    <Sheet
      visible={visible}
      title={t.finishTransactionsTitle}
      kicker={queue.length > 1 ? t.needsAttentionProgress(index + 1, queue.length) : undefined}
      titleStyle={{ marginBottom: "0.5rem" }}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
      // Passive open: nothing grabs the keyboard until the user asks for it.
      autoFocus={false}
      className="needs-attention-sheet"
    >
      <NeedsAttentionForm
        key={current.id}
        transaction={current}
        categoryNames={categoryNames}
        recurringOptions={recurringOptions}
        onSaved={handleSaved}
        onDoneForNow={handleClose}
      />
    </Sheet>
  );
}

/** Existing recurring expenses whose name overlaps the transaction's come first. */
function rankRecurringOptions(options: RecurringOption[], transactionName: string): RecurringOption[] {
  const name = transactionName.toLowerCase();
  const matches = (o: RecurringOption) => {
    const n = o.name.toLowerCase();
    return n.includes(name) || name.includes(n);
  };
  return [...options.filter(matches), ...options.filter((o) => !matches(o))].slice(0, MAX_RECURRING_SUGGESTIONS);
}

function NeedsAttentionForm({
  transaction,
  categoryNames,
  recurringOptions,
  onSaved,
  onDoneForNow,
}: {
  transaction: NeedsAttentionTransaction;
  categoryNames: string[];
  recurringOptions: RecurringOption[];
  onSaved: () => void;
  onDoneForNow: () => void;
}) {
  const t = useT().dashboard;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A category name, NEW (typing a custom one), or "" (nothing picked yet).
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [recurring, setRecurring] = useState(false);
  // A RecurringExpense id, NEW, or "".
  const [recurringId, setRecurringId] = useState("");
  const [newRecurringName, setNewRecurringName] = useState(transaction.name);
  const [description, setDescription] = useState("");

  const suggestions = rankRecurringOptions(recurringOptions, transaction.name);
  const categoryName = category === NEW ? newCategory.trim() : category;
  const canRecur = transaction.needsCategory && transaction.type === "EXPENSE";
  const valid =
    (!transaction.needsCategory || categoryName !== "") &&
    (!canRecur || !recurring || (recurringId === NEW ? newRecurringName.trim() !== "" : recurringId !== "")) &&
    (!transaction.needsDescription || description.trim() !== "");

  const label = transaction.needsDescription
    ? transaction.direction === "sent"
      ? t.sentTo(transaction.name)
      : t.receivedFrom(transaction.name)
    : transaction.name;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid || pending) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setError(null);
    setPending(true);

    // Two round trips to the two existing actions rather than a new combined
    // one -- each keeps its own validation/ownership checks. Category first:
    // it may create a category the description update shouldn't race.
    if (transaction.needsCategory) {
      const fd = new FormData();
      fd.set("transactionId", transaction.id);
      fd.set("category", categoryName);
      if (canRecur && recurring) {
        fd.set("recurring", "true");
        if (recurringId === NEW) {
          fd.set("recurringExpenseName", newRecurringName.trim());
        } else {
          fd.set("recurringExpenseId", recurringId);
          fd.set("recurringExpenseName", recurringOptions.find((o) => o.id === recurringId)?.name ?? transaction.name);
        }
      }
      const result = await categorizeTransactionAction(fd);
      if ("error" in result) {
        setPending(false);
        setError(result.error);
        return;
      }
    }

    if (transaction.needsDescription) {
      const fd = new FormData();
      fd.set("transactionId", transaction.id);
      fd.set("description", description.trim());
      const result = await describeTransactionAction(fd);
      if ("error" in result) {
        setPending(false);
        setError(result.error);
        return;
      }
    }

    router.refresh();
    onSaved();
  }

  return (
    <form
      className="needs-attention-form"
      onSubmit={handleSubmit}
      noValidate
      // Tapping anything that isn't a text field (a chip, the background)
      // dismisses the keyboard -- iOS keeps it up otherwise.
      onPointerDown={(e) => {
        const active = document.activeElement as HTMLElement | null;
        if (active?.matches("input[type=text]") && !(e.target as HTMLElement).closest("input[type=text]")) active.blur();
      }}
    >
      <div className="categorize-imports-row-header">
        <span className="categorize-imports-row-name">{label}</span>
        <span className="categorize-imports-row-amount">{formatCurrency(transaction.amount)}</span>
      </div>

      {transaction.needsCategory && (
        <fieldset className="needs-attention-group">
          <legend className="needs-attention-label">{t.categoryLabel}</legend>
          <ChipChoice
            options={categoryNames.map((name) => ({ value: name, label: name }))}
            value={category}
            onChange={setCategory}
            createLabel={t.createNew}
          />
          {category === NEW && (
            <input
              type="text"
              className="needs-attention-input"
              aria-label={t.newCategoryPlaceholder}
              placeholder={t.newCategoryPlaceholder}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
          )}
        </fieldset>
      )}

      {canRecur && (
        <>
          <label className="needs-attention-check">
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            {t.isRecurringExpense}
          </label>
          {recurring && (
            <fieldset className="needs-attention-group">
              <legend className="needs-attention-label">{t.whichRecurringExpenseLabel}</legend>
              <ChipChoice
                options={suggestions.map((o) => ({ value: o.id, label: `${o.name} · ${formatCurrency(o.amount)}` }))}
                value={recurringId}
                onChange={setRecurringId}
                createLabel={t.createNew}
              />
              {recurringId === NEW && (
                <input
                  type="text"
                  className="needs-attention-input"
                  aria-label={t.newRecurringPlaceholder}
                  placeholder={t.newRecurringPlaceholder}
                  value={newRecurringName}
                  onChange={(e) => setNewRecurringName(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  autoFocus
                />
              )}
            </fieldset>
          )}
        </>
      )}

      {transaction.needsDescription && (
        <input
          type="text"
          className="needs-attention-input"
          aria-label={t.whatWasThisForPlaceholder}
          placeholder={t.whatWasThisForPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          autoComplete="off"
        />
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="needs-attention-footer">
        <button type="submit" className="button sheet-submit" disabled={!valid || pending}>
          {pending ? t.saving : t.save}
        </button>
        <button type="button" className="button button--ghost sheet-submit" onClick={onDoneForNow}>
          {t.doneForNow}
        </button>
      </div>
    </form>
  );
}

function ChipChoice({
  options,
  value,
  onChange,
  createLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  createLabel: string;
}) {
  return (
    <div className="category-chips category-chips--wrap">
      {[...options, { value: NEW, label: createLabel }].map((o) => (
        <button
          key={o.value}
          type="button"
          className={`category-chip${value === o.value ? " is-active" : ""}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
