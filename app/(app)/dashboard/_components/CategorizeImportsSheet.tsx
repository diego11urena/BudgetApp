"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import { categorizeTransactionAction } from "../../_actions/transactions";
import { formatCurrency } from "@/lib/format";

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

  useModalFocus(sheetRef, handleClose, returnFocusTo);

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
        aria-label="Categorize imported transactions"
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("transactionId", transaction.id);
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
        <CategoryNameInput
          id={`categorize-${transaction.id}`}
          name="category"
          categoryNames={categoryNames}
          placeholder="Category"
          showChips={false}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="button button--small" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
