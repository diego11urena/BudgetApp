"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";
import { categorizeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";

const NEW_CATEGORY_VALUE = "__new__";

export interface UncategorizedTransaction {
  id: string;
  name: string;
  amount: number;
}

export function CategorizeImportsSheet({
  initialTransactions,
  categoryNames,
  returnFocusTo = null,
  onClose,
}: {
  initialTransactions: UncategorizedTransaction[];
  categoryNames: string[];
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [transactions, setTransactions] = useState(initialTransactions);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  function handleCategorized(transactionId: string) {
    setTransactions((prev) => {
      const next = prev.filter((t) => t.id !== transactionId);
      if (next.length === 0) handleClose();
      return next;
    });
  }

  // autoFocus off: this sheet should appear passively, with no field
  // grabbing the keyboard/cursor until the user deliberately taps one.
  useModalFocus(sheetRef, handleClose, returnFocusTo, false);

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
        aria-label="Categorize transactions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Categorize transactions</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "1rem" }}>
          Pick a category once and the app will remember it for this merchant next time.
        </p>

        <div className="categorize-imports-list">
          {transactions.map((transaction) => (
            <CategorizeImportRow
              key={transaction.id}
              transaction={transaction}
              categoryNames={categoryNames}
              onCategorized={() => handleCategorized(transaction.id)}
            />
          ))}
        </div>

        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleClose}
        >
          Done for now
        </button>
      </div>
    </div>
  );
}

function CategorizeImportRow({
  transaction,
  categoryNames,
  onCategorized,
}: {
  transaction: UncategorizedTransaction;
  categoryNames: string[];
  onCategorized: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("transactionId", transaction.id);
    if (fd.get("category") === NEW_CATEGORY_VALUE) {
      fd.set("category", String(fd.get("newCategory") ?? ""));
    }
    setPending(true);
    setError(null);
    const result = await categorizeTransactionAction(fd);
    if ("error" in result) {
      setPending(false);
      setError(result.error);
      return;
    }
    onCategorized();
  }

  return (
    <form className="categorize-imports-row" onSubmit={handleSubmit}>
      <div className="categorize-imports-row-header">
        <span className="categorize-imports-row-name">{transaction.name}</span>
        <span className="categorize-imports-row-amount">{formatCurrency(transaction.amount)}</span>
      </div>
      <div className="categorize-imports-row-input">
        <select
          id={`categorize-${transaction.id}`}
          name="category"
          defaultValue=""
          required
          onChange={(e) => setCreatingNew(e.target.value === NEW_CATEGORY_VALUE)}
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
            name="newCategory"
            placeholder="New category name"
            required
            autoComplete="off"
          />
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="button button--small" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
