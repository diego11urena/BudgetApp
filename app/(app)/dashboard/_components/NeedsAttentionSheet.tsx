"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { categorizeTransactionAction, describeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";
import type { NeedsAttentionTransaction } from "@/lib/needs-attention";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
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
  returnFocusTo = null,
  onClose,
}: {
  initialTransactions: NeedsAttentionTransaction[];
  /** Each row picks its list by its own type — a Savings row must never be offered Expense category names, and vice versa. */
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
  savingsCategoryNames: string[];
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
  const [visible, setVisible] = useState(false);
  const [transactions, setTransactions] = useState(initialTransactions);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
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
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
      // autoFocus off: this sheet should appear passively, with no field
      // grabbing the keyboard/cursor until the user deliberately taps one
      // -- same reasoning as the two sheets this one replaces (see
      // useModalFocus's own doc comment).
      autoFocus={false}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "1rem" }}>
        {t.finishTransactionsBody}
      </p>

      <div className="categorize-imports-list">
        {transactions.map((transaction) => (
          <NeedsAttentionRow
            key={transaction.id}
            transaction={transaction}
            categoryNames={categoryNamesForType(transaction.type)}
            onDone={() => handleDone(transaction.id)}
          />
        ))}
      </div>

      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
        {t.doneForNow}
      </button>
    </Sheet>
  );
}

function NeedsAttentionRow({
  transaction,
  categoryNames,
  onDone,
}: {
  transaction: NeedsAttentionTransaction;
  categoryNames: string[];
  onDone: () => void;
}) {
  const t = useT().dashboard;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryValue, setCategoryValue] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [description, setDescription] = useState("");

  const label =
    transaction.needsDescription
      ? (transaction.direction === "sent" ? t.sentTo(transaction.name) : t.receivedFrom(transaction.name))
      : transaction.name;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (transaction.needsCategory && !categoryValue.trim()) {
      setError(t.chooseCategoryError);
      return;
    }
    if (transaction.needsDescription && !description.trim()) {
      setError(t.tellUsWhatItWasForError);
      return;
    }

    setPending(true);

    // Sequential, not parallel -- categorizeTransactionAction can create a
    // brand-new category (getOrCreateCategory) that the description update
    // has no reason to race against; keeping these as two independent
    // round trips to the two existing, already-battle-tested actions
    // avoids duplicating either one's own validation/ownership logic here.
    if (transaction.needsCategory) {
      const fd = new FormData();
      fd.set("transactionId", transaction.id);
      fd.set("category", categoryValue.trim());
      if (recurring) fd.set("recurring", "true");
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
    onDone();
  }

  return (
    <form className="categorize-imports-row" onSubmit={handleSubmit} noValidate>
      <div className="categorize-imports-row-header">
        <span className="categorize-imports-row-name">{label}</span>
        <span className="categorize-imports-row-amount">{formatCurrency(transaction.amount)}</span>
      </div>

      {transaction.needsCategory && (
        <>
          <div className="categorize-imports-row-input">
            <CategoryNameInput
              id={`needs-attention-category-${transaction.id}`}
              name="category"
              categoryNames={categoryNames}
              placeholder={t.chooseCategoryPlaceholder}
              showChips={false}
              onValueChange={setCategoryValue}
            />
          </div>
          {transaction.type === "EXPENSE" && categoryValue.trim() && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              {t.thisIsABill}
            </label>
          )}
        </>
      )}

      {transaction.needsDescription && (
        <div className="categorize-imports-row-input">
          <input
            type="text"
            placeholder={t.whatWasThisForPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="button button--small" disabled={pending}>
        {pending ? t.saving : t.save}
      </button>
    </form>
  );
}
