"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/format";

export interface RecurringOption {
  id: string;
  name: string;
  amount: number;
}

const MAX_SUGGESTIONS = 8;

/**
 * "Which recurring expense is this?" -- the transaction sheet's "This is a
 * recurring expense" toggle used to only ever do an exact, case-insensitive
 * name match against the user's existing ones (or silently create a new
 * one named after the transaction when nothing matched exactly). This is
 * what lets a user explicitly say "this transaction belongs to THAT one"
 * instead: a combobox over their existing RecurringExpenses (see
 * lib/recurring-expenses.ts's getRecurringExpenseOptions), submitted as an
 * id (recurringExpenseId), not just text.
 *
 * Shaped like CategoryNameInput (text input + filtered dropdown), but
 * resolves to a specific expense's id rather than a name string: a
 * transaction's own merchant name ("Anthropic") and an expense's name
 * ("Claude") are often genuinely different strings -- that's the whole
 * reason this exists -- so typing here must never rename the transaction
 * itself, and two different expenses (in different categories) could
 * share an identical name, so selection has to be tracked by id, not by
 * the typed text matching a name.
 *
 * defaultValue is the transaction's own name, matching the toggle's
 * existing create-a-new-one-with-this-name default: leaving this field
 * untouched after checking the box falls straight through to that
 * unchanged behavior (see resolveRecurringExpenseName in
 * app/(app)/_actions/transactions.ts), so this is purely additive for
 * anyone who never opens the dropdown.
 */
export function RecurringExpensePicker({
  id,
  options,
  defaultValue,
  defaultSelectedId = null,
  onSelectionChange,
}: {
  id: string;
  options: RecurringOption[];
  defaultValue: string;
  /** Pre-selects an existing recurring expense -- used when editing a transaction that's already linked to one, so re-saving without touching this field re-links to the SAME one rather than falling through to create-new. */
  defaultSelectedId?: string | null;
  /**
   * For a caller that builds its own FormData by hand instead of reading
   * the native form on submit (NeedsAttentionSheet's per-row form does
   * this) -- the two hidden inputs below are enough for a normal
   * `new FormData(formEl)` read, but invisible to that. Optional: most
   * callers (QuickAddSheet) don't need it.
   */
  onSelectionChange?: (selection: { recurringExpenseId: string | null; recurringExpenseName: string }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId);
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const suggestions = (query ? options.filter((o) => o.name.toLowerCase().includes(query)) : options).slice(
    0,
    MAX_SUGGESTIONS,
  );

  // Closing on an outside click (not just blur) so a mousedown on a
  // dropdown option doesn't race the option's own onClick and close the
  // list before the click registers -- same fix CategoryNameInput uses.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function select(option: RecurringOption) {
    setValue(option.name);
    setSelectedId(option.id);
    setOpen(false);
    onSelectionChange?.({ recurringExpenseId: option.id, recurringExpenseName: option.name });
  }

  return (
    <div className="recurring-picker" ref={containerRef}>
      <div className="recurring-picker-combobox">
        <input
          id={id}
          type="text"
          value={value}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            setSelectedId(null);
            setOpen(true);
            onSelectionChange?.({ recurringExpenseId: null, recurringExpenseName: e.target.value });
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            // Consume Escape ourselves when the dropdown is open, so it
            // closes just the suggestions, not the whole sheet -- same
            // stopImmediatePropagation() fix CategoryNameInput uses (see
            // its own doc comment for why plain stopPropagation isn't
            // enough against useModalFocus's sibling listener).
            if (e.key === "Escape" && open) {
              e.nativeEvent.stopImmediatePropagation();
              setOpen(false);
            }
          }}
        />
        {open && suggestions.length > 0 && (
          <ul className="recurring-picker-dropdown">
            {suggestions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={selectedId === option.id ? "is-active" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(option)}
                >
                  <span className="recurring-picker-option-name">{option.name}</span>
                  <span className="recurring-picker-option-amount">{formatCurrency(option.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Non-null only when an existing recurring expense was actually
          clicked -- the server treats a blank value here as "no pick, fall
          through to exact-match-or-create" (see
          resolvePickedRecurringExpenseId). */}
      <input type="hidden" name="recurringExpenseId" value={selectedId ?? ""} />
      {/* What a NEW recurring expense should be named if nothing existing
          was picked -- this field's own current text, independent of the
          transaction's own Name field (see resolveRecurringExpenseName). */}
      <input type="hidden" name="recurringExpenseName" value={value} />
    </div>
  );
}
