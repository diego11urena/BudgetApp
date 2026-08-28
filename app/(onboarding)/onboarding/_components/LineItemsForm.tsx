"use client";

import { useActionState, useId, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-error";

export type LineItemsFormState = ActionResult | undefined;

export interface LineItem {
  name: string;
  amount: string;
}

interface LineItemRow extends LineItem {
  key: string;
}

interface LineItemsFormProps {
  action: (
    prevState: LineItemsFormState,
    formData: FormData,
  ) => Promise<LineItemsFormState>;
  fieldName: string;
  itemNounSingular: string;
  amountLabel: string;
  submitLabel: string;
  initialItems?: LineItem[];
}

export function LineItemsForm({
  action,
  fieldName,
  itemNounSingular,
  amountLabel,
  submitLabel,
  initialItems,
}: LineItemsFormProps) {
  const [state, formAction, pending] = useActionState<LineItemsFormState, FormData>(
    action,
    undefined,
  );
  const genId = useId();
  const nextKeyRef = useRef((initialItems ?? []).length);
  const [rows, setRows] = useState<LineItemRow[]>(() =>
    (initialItems ?? []).map((item, i) => ({
      key: `${genId}-${i}`,
      name: item.name,
      amount: item.amount,
    })),
  );

  function addRow() {
    const key = `${genId}-${nextKeyRef.current++}`;
    setRows((prev) => [...prev, { key, name: "", amount: "" }]);
  }

  function updateRow(key: string, patch: Partial<LineItemRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const itemsJson = JSON.stringify(
    rows.map((r) => ({ name: r.name, targetAmount: r.amount })),
  );

  return (
    <form action={formAction}>
      <input type="hidden" name={fieldName} value={itemsJson} readOnly />

      {rows.length === 0 && (
        <p className="field-hint">
          You haven&apos;t added any {itemNounSingular}s yet.
        </p>
      )}

      {rows.map((row) => (
        <div
          className="field"
          key={row.key}
          style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
        >
          <div style={{ flex: 2 }}>
            <label htmlFor={`${row.key}-name`}>Name</label>
            <input
              id={`${row.key}-name`}
              type="text"
              value={row.name}
              required
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor={`${row.key}-amount`}>{amountLabel}</label>
            <input
              id={`${row.key}-amount`}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={row.amount}
              required
              onChange={(e) => updateRow(row.key, { amount: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => removeRow(row.key)}
          >
            Remove
          </button>
        </div>
      ))}

      <button type="button" className="button button--secondary" onClick={addRow}>
        + Add {rows.length > 0 ? "another" : "a"} {itemNounSingular}
      </button>

      {!!state && "error" in state && <p className="error-text">{state.error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
