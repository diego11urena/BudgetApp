"use client";

import { useActionState, useState } from "react";
import { addTransactionAction, type TransactionFormState } from "../_actions/transactions";
import { CategoryNameInput } from "./CategoryNameInput";

const initialState: TransactionFormState = undefined;

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
  const [state, formAction, pending] = useActionState(addTransactionAction, initialState);
  const [type, setType] = useState<TxType>(initialType);

  const categoryNames =
    type === "EXPENSE" ? expenseCategoryNames : type === "SAVINGS" ? savingsCategoryNames : [];

  return (
    <form action={formAction} id="log-transaction">
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
      {state?.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
