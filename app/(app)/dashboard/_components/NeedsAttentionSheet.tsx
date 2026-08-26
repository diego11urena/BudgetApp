"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { categorizeTransactionAction, describeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";

const NEW_CATEGORY_VALUE = "__new__";

export interface NeedsAttentionTransaction {
  id: string;
  name: string;
  amount: number;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  needsCategory: boolean;
  needsDescription: boolean;
  /** Yappy is P2P — the counterparty's name alone doesn't say what the money was for, in either direction. Only used for the row's label when needsDescription. */
  direction: "sent" | "received";
}

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
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== transactionId);
      if (next.length === 0) handleClose();
      return next;
    });
  }

  return (
    <Sheet
      visible={visible}
      title="Finish these transactions"
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
        Add whatever&apos;s missing — category, description, or both — so your totals and history
        stay accurate.
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
        Done for now
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [description, setDescription] = useState("");

  const label =
    transaction.needsDescription
      ? `${transaction.direction === "sent" ? "Sent to" : "Received from"} ${transaction.name}`
      : transaction.name;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const categoryValue = creatingNew ? newCategory.trim() : category;
    if (transaction.needsCategory && !categoryValue) {
      setError("Choose or enter a category");
      return;
    }
    if (transaction.needsDescription && !description.trim()) {
      setError("Tell us what it was for");
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
      fd.set("category", categoryValue);
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
    <form className="categorize-imports-row" onSubmit={handleSubmit}>
      <div className="categorize-imports-row-header">
        <span className="categorize-imports-row-name">{label}</span>
        <span className="categorize-imports-row-amount">{formatCurrency(transaction.amount)}</span>
      </div>

      {transaction.needsCategory && (
        <>
          <div className="categorize-imports-row-input">
            <select
              id={`needs-attention-category-${transaction.id}`}
              defaultValue=""
              onChange={(e) => {
                setCreatingNew(e.target.value === NEW_CATEGORY_VALUE);
                setCategory(e.target.value);
              }}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={NEW_CATEGORY_VALUE}>+ New category…</option>
            </select>
            {creatingNew && (
              <input
                type="text"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                autoComplete="off"
              />
            )}
          </div>
          {transaction.type === "EXPENSE" && (category || newCategory) && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              This is a recurring expense
            </label>
          )}
        </>
      )}

      {transaction.needsDescription && (
        <div className="categorize-imports-row-input">
          <input
            type="text"
            placeholder="Rent, lunch, gift…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            autoComplete="off"
          />
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="button button--small" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
