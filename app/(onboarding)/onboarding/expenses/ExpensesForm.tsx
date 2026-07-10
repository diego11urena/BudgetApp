"use client";

import { useActionState, useId, useState } from "react";
import { saveExpensesAction, type ExpensesFormState } from "./actions";

type CategoryType = "EXPENSE" | "SAVINGS";

interface CategoryRow {
  key: string;
  expenseCategoryId?: string;
  name: string;
  type: CategoryType;
  targetAmount: string;
}

const initialState: ExpensesFormState = undefined;

export function ExpensesForm({
  categories,
}: {
  categories: { id: string; name: string; type: CategoryType }[];
}) {
  const [state, formAction, pending] = useActionState(saveExpensesAction, initialState);
  const genId = useId();
  const [rows, setRows] = useState<CategoryRow[]>(() =>
    categories.map((c) => ({
      key: c.id,
      expenseCategoryId: c.id,
      name: c.name,
      type: c.type,
      targetAmount: "",
    })),
  );

  function updateRow(key: string, patch: Partial<CategoryRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: `${genId}-${prev.length}`, name: "", type: "EXPENSE", targetAmount: "" },
    ]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const categoriesJson = JSON.stringify(
    rows.map((r) => ({
      expenseCategoryId: r.expenseCategoryId,
      name: r.name,
      type: r.type,
      targetAmount: r.targetAmount,
    })),
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="categoriesJson" value={categoriesJson} readOnly />

      {rows.map((row) => (
        <div className="field" key={row.key} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <div style={{ flex: 2 }}>
            <label>Category</label>
            <input
              type="text"
              value={row.name}
              required
              readOnly={Boolean(row.expenseCategoryId)}
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Type</label>
            <select
              value={row.type}
              onChange={(e) => updateRow(row.key, { type: e.target.value as CategoryType })}
            >
              <option value="EXPENSE">Expense</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Target (USD)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={row.targetAmount}
              required
              onChange={(e) => updateRow(row.key, { targetAmount: e.target.value })}
            />
          </div>
          {!row.expenseCategoryId && (
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
        + Add category
      </button>

      {state?.error && <p className="error-text">{state.error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
