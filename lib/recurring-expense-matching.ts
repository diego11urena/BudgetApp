export interface RecurringExpenseForMatching {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
}

export interface MatchCandidateTransaction {
  id: string;
  name: string;
  amount: number;
  categoryId: string | null;
  /** Non-null candidates are excluded -- already linked to some recurring expense. */
  recurringExpenseId: string | null;
}

/** A candidate within this fraction of the recurring expense's own amount counts as a plausible match -- e.g. a $9.99 subscription that ticked up to $10.99 still suggests. */
const AMOUNT_TOLERANCE_FRACTION = 0.1;

/**
 * Best-effort suggestion only -- never auto-links. Surfaced in the UI as
 * "Possible match: {name} {amount} · Confirm / Not this one," and confirming
 * calls confirmRecurringExpenseMatchAction. A candidate qualifies when it's
 * in the same category, not already linked to any recurring expense, its
 * amount is within AMOUNT_TOLERANCE_FRACTION of the recurring expense's own
 * amount, and the two names share a case-insensitive substring relationship
 * in either direction (handles both a clean name inside raw bank text, e.g.
 * "spotify" inside "SPOTIFY *PREMIUM US", and the reverse). Ties are broken
 * by closest amount. Pure and DB-free so this is unit-testable without a
 * database -- the caller is responsible for fetching the candidate pool
 * (this cycle's transactions in the recurring expense's category with no
 * recurringExpenseId set yet).
 */
export function findMatchSuggestion(
  recurringExpense: RecurringExpenseForMatching,
  candidates: MatchCandidateTransaction[],
): MatchCandidateTransaction | null {
  const nameA = recurringExpense.name.trim().toLowerCase();
  if (!nameA) return null;

  const tolerance = recurringExpense.amount * AMOUNT_TOLERANCE_FRACTION;
  let best: MatchCandidateTransaction | null = null;
  let bestDiff = Infinity;

  for (const candidate of candidates) {
    if (candidate.recurringExpenseId !== null) continue;
    if (candidate.categoryId !== recurringExpense.categoryId) continue;

    const nameB = candidate.name.trim().toLowerCase();
    if (!nameB) continue;
    if (!nameB.includes(nameA) && !nameA.includes(nameB)) continue;

    const diff = Math.abs(candidate.amount - recurringExpense.amount);
    if (diff > tolerance) continue;

    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }

  return best;
}
