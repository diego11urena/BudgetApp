"use client";

import { useState } from "react";
import { addTransactionAction, deleteTransactionAction } from "../_actions/transactions";
import { formatUSD } from "@/lib/format";
import { useToast } from "./ToastProvider";
import { CategoryNameInput } from "./CategoryNameInput";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

export function TransactionForm({
  initialType = "EXPENSE",
  expenseCategoryNames = [],
  savingsCategoryNames = [],
}: {
  initialType?: TxType;
  expenseCategoryNames?: string[];
  savingsCategoryNames?: string[];
}) {
  const { showToast } = useToast();
  const [type, setType] = useState<TxType>(initialType);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryNames =
    type === "EXPENSE" ? expenseCategoryNames : type === "SAVINGS" ? savingsCategoryNames : [];

  // Calls the server action directly (rather than via useActionState) so
  // the toast fires in the same async call that submits, not a later
  // effect — see QuickAddSheet for why that ordering matters here too.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setError(null);

    const result = await addTransactionAction(undefined, formData);
    setPending(false);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }

    if (result && "transactionId" in result) {
      const amountNumber = Number(formData.get("amount"));
      const label = String(formData.get("name") ?? "").trim() || "transaction";
      const newTransactionId = result.transactionId;
      showToast(`Logged ${formatUSD(amountNumber)} for ${label}`, {
        label: "Undo",
        onClick: () => {
          const fd = new FormData();
          fd.set("transactionId", newTransactionId);
          void deleteTransactionAction(undefined, fd);
        },
      });
      form.reset();
    }
  }

  return (
    <form id="log-transaction" onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
          <label htmlFor="tx-type">Type</label>
          <select
            id="tx-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as TxType)}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Extra income</option>
            <option value="SAVINGS">Savings</option>
          </select>
        </div>
        <div className="field" style={{ flex: 2, minWidth: "8rem" }}>
          <label htmlFor="tx-name">Name</label>
          <CategoryNameInput
            id="tx-name"
            name="name"
            categoryNames={categoryNames}
            placeholder="Groceries"
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: "7rem" }}>
          <label htmlFor="tx-amount">Amount (USD)</label>
          <input
            id="tx-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div className="field">
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Adding..." : "Log it"}
          </button>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
    </form>
  );
}
