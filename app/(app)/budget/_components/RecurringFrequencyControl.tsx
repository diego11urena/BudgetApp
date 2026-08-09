"use client";

import { useState } from "react";
import { updateCategoryFrequencyAction } from "../actions";

type Frequency = "BIWEEKLY" | "MONTHLY";

/**
 * How a recurring target carries forward when a cycle closes — every
 * quincena (BIWEEKLY), or only the one matching a due day (MONTHLY). Only
 * rendered when the category is Recurring; a one-time target has no
 * frequency to set. Calls the action directly (rather than via
 * useActionState/<form action>) so the inline error can be shown without a
 * page transition, matching this app's other small inline-edit controls.
 */
export function RecurringFrequencyControl({
  categoryId,
  frequency,
  dueDay,
}: {
  categoryId: string;
  frequency: Frequency;
  dueDay: number | null;
}) {
  const [selectedFrequency, setSelectedFrequency] = useState<Frequency>(frequency);
  const [selectedDueDay, setSelectedDueDay] = useState(dueDay !== null ? String(dueDay) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    selectedFrequency !== frequency ||
    (selectedFrequency === "MONTHLY" && selectedDueDay !== String(dueDay ?? ""));

  async function handleSave() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("frequency", selectedFrequency);
    if (selectedDueDay) fd.set("dueDay", selectedDueDay);
    const result = await updateCategoryFrequencyAction(fd);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="recurring-frequency-control">
      <div className="recurring-frequency-fields">
        <select
          value={selectedFrequency}
          onChange={(e) => setSelectedFrequency(e.target.value as Frequency)}
          aria-label="Recurring frequency"
        >
          <option value="BIWEEKLY">Every quincena</option>
          <option value="MONTHLY">Once a month</option>
        </select>
        {selectedFrequency === "MONTHLY" && (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            placeholder="Day (1–31)"
            value={selectedDueDay}
            onChange={(e) => setSelectedDueDay(e.target.value)}
            aria-label="Due day of month"
          />
        )}
        <button
          type="button"
          className="button button--secondary button--small"
          onClick={handleSave}
          disabled={pending || !isDirty}
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      <p className="field-hint" style={{ marginTop: "0.35rem" }}>
        {selectedFrequency === "MONTHLY"
          ? "Applies only to the quincena containing this day of the month — the other quincena skips it."
          : "This target reappears in every quincena."}
      </p>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
