"use client";

import { useActionState, useId, useState } from "react";
import { saveAccountsAction, type AccountsFormState } from "./actions";

type AccountType = "CHECKING" | "SAVINGS" | "CASH" | "CREDIT_CARD" | "LOAN" | "OTHER_DEBT";

interface AccountRow {
  key: string;
  name: string;
  type: AccountType;
  amount: string;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Checking account",
  SAVINGS: "Savings account",
  CASH: "Cash",
  CREDIT_CARD: "Credit card debt",
  LOAN: "Loan",
  OTHER_DEBT: "Other debt",
};

const initialState: AccountsFormState = undefined;

export function AccountsForm() {
  const [state, formAction, pending] = useActionState(saveAccountsAction, initialState);
  const genId = useId();
  const [rows, setRows] = useState<AccountRow[]>([
    { key: `${genId}-0`, name: "", type: "CHECKING", amount: "" },
  ]);

  function updateRow(key: string, patch: Partial<AccountRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: `${genId}-${prev.length}`, name: "", type: "CHECKING", amount: "" },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  const accountsJson = JSON.stringify(
    rows.map((r) => ({ name: r.name, type: r.type, amount: r.amount })),
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="accountsJson" value={accountsJson} readOnly />

      {rows.map((row) => (
        <div
          className="field"
          key={row.key}
          style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
        >
          <div style={{ flex: 2 }}>
            <label>Account name</label>
            <input
              type="text"
              placeholder="e.g. Banco General checking"
              value={row.name}
              required
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Type</label>
            <select
              value={row.type}
              onChange={(e) => updateRow(row.key, { type: e.target.value as AccountType })}
            >
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>{row.type === "CHECKING" || row.type === "SAVINGS" || row.type === "CASH" ? "Balance (USD)" : "Amount owed (USD)"}</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount}
              required
              onChange={(e) => updateRow(row.key, { amount: e.target.value })}
            />
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => removeRow(row.key)}
            >
              Remove
            </button>
          )}
        </div>
      ))}

      <button type="button" className="button button--secondary" onClick={addRow}>
        + Add account
      </button>

      {state?.error && <p className="error-text">{state.error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Finishing..." : "Finish setup"}
        </button>
      </div>
    </form>
  );
}
