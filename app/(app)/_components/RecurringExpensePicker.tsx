"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/app/_components/LocaleProvider";

export interface RecurringOption {
  id: string;
  name: string;
  amount: number;
}

const NEW = "__new__";

/**
 * "Which recurring expense is this?" -- a native <select> over the user's
 * existing RecurringExpenses (iOS wheel picker, no keyboard), submitted as
 * an id (recurringExpenseId) because two expenses can share a name and a
 * transaction's merchant name ("Anthropic") often differs from the
 * expense's ("Claude"). "Other…" reveals a text field naming a new one.
 *
 * Starts on "Other…" with defaultValue (the transaction's own name) unless
 * an existing expense is linked or matches that name exactly -- so leaving
 * the field untouched keeps the old create-a-new-one-with-this-name
 * behavior (see resolveRecurringExpenseName in
 * app/(app)/_actions/transactions.ts).
 */
export function RecurringExpensePicker({
  id,
  options,
  defaultValue,
  defaultSelectedId = null,
}: {
  id: string;
  options: RecurringOption[];
  defaultValue: string;
  /** Pre-selects an existing recurring expense -- used when editing a transaction already linked to one. */
  defaultSelectedId?: string | null;
}) {
  const t = useT();
  const initial =
    options.find((o) => o.id === defaultSelectedId) ??
    options.find((o) => o.name.toLowerCase() === defaultValue.trim().toLowerCase());
  const [choice, setChoice] = useState(initial?.id ?? NEW);
  const [newName, setNewName] = useState(defaultValue);
  const [focusNew, setFocusNew] = useState(false);
  const selected = options.find((o) => o.id === choice);

  return (
    <>
      {options.length > 0 && (
        <select
          id={id}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setFocusNew(e.target.value === NEW);
          }}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · {formatCurrency(o.amount)}
            </option>
          ))}
          <option value={NEW}>{t.dashboard.otherRecurringOption}</option>
        </select>
      )}
      {!selected && (
        <input
          id={options.length > 0 ? undefined : id}
          type="text"
          value={newName}
          autoComplete="off"
          autoFocus={focusNew}
          placeholder={t.dashboard.newRecurringPlaceholder}
          aria-label={options.length > 0 ? t.dashboard.newRecurringPlaceholder : undefined}
          onChange={(e) => setNewName(e.target.value)}
        />
      )}
      {/* Blank = no pick, server falls through to exact-match-or-create (see resolvePickedRecurringExpenseId). */}
      <input type="hidden" name="recurringExpenseId" value={selected?.id ?? ""} />
      <input type="hidden" name="recurringExpenseName" value={selected?.name ?? newName} />
    </>
  );
}
