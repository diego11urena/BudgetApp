"use client";

import { useActionState } from "react";
import { addTransactionAction, type TransactionFormState } from "../actions";

const initialState: TransactionFormState = undefined;

export function TransactionForm() {
  const [state, formAction, pending] = useActionState(addTransactionAction, initialState);

  return (
    <form action={formAction}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="tx-type">Type</label>
          <select id="tx-type" name="type" defaultValue="EXPENSE">
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Extra income</option>
            <option value="SAVINGS">Savings</option>
          </select>
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="tx-name">Name</label>
          <input id="tx-name" name="name" type="text" placeholder="Groceries" required />
        </div>
        <div className="field" style={{ flex: 1 }}>
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
