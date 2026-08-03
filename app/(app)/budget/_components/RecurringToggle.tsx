import { toggleCategoryRecurringAction } from "../actions";

/**
 * Flips a category's recurring flag with a single tap — no amount or
 * category-name resubmission involved, so it can't accidentally change
 * anything else about the target. A plain form + server action; no client
 * JS needed since the whole interaction is just "submit the opposite value."
 */
export function RecurringToggle({
  categoryId,
  recurring,
}: {
  categoryId: string;
  recurring: boolean;
}) {
  return (
    <form action={toggleCategoryRecurringAction} style={{ display: "inline" }}>
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="recurring" value={String(!recurring)} />
      <button
        type="submit"
        className={`recurring-toggle ${recurring ? "is-on" : ""}`}
        aria-label={recurring ? "Recurring — carries into next quincena" : "One-time — won't carry forward"}
      >
        🔁 {recurring ? "Recurring" : "One-time"}
      </button>
    </form>
  );
}
