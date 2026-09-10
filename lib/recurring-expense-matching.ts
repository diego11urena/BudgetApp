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

/** A word shorter than this is too generic (or too likely to be pure noise -- "co", "of", "at") to count as a meaningful name overlap by itself. */
const MIN_SIGNIFICANT_TOKEN_LENGTH = 3;

/** Case-folded words of at least MIN_SIGNIFICANT_TOKEN_LENGTH, split on any run of non-alphanumeric characters -- turns "SPOTIFY*PREMIUM US" into {"spotify","premium"} ("us" is dropped as too short/generic). */
function significantTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= MIN_SIGNIFICANT_TOKEN_LENGTH),
  );
}

/**
 * Two names "likely" refer to the same thing if either contains the other
 * whole (handles a clean bill name inside raw bank/Gmail text, e.g.
 * "spotify" inside "SPOTIFY *PREMIUM US", and the reverse), OR if they share
 * at least one significant word without either containing the other whole
 * (e.g. bill "Claude" and transaction "Anthropic Claude" -- "claude" is a
 * shared word, but neither string contains the other). The word-overlap
 * check is a strict superset of what pure substring matching already
 * covered for single-word names, so this only ever makes a match MORE
 * likely to be found, never less.
 */
function namesLikelyMatch(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  if (nameB.includes(nameA) || nameA.includes(nameB)) return true;

  const tokensA = significantTokens(nameA);
  for (const token of significantTokens(nameB)) {
    if (tokensA.has(token)) return true;
  }
  return false;
}

/**
 * Best-effort suggestion only -- never auto-links. Surfaced in the UI as
 * "Possible match: {name} {amount} · Confirm / Not this one," and confirming
 * calls confirmRecurringExpenseMatchAction. A candidate qualifies when its
 * amount is within AMOUNT_TOLERANCE_FRACTION of the recurring expense's own
 * amount, its name shares a substring or a significant word with the
 * recurring expense's name (see namesLikelyMatch), it's not already linked
 * to any recurring expense, and it's EITHER in the same category as this
 * recurring expense OR not yet categorized at all -- a brand-new
 * Gmail-imported merchant this user has never categorized before lands with
 * no category (see gmail-sync.ts's findLearnedCategoryId, which only
 * resolves one from an exact prior name match), and used to be structurally
 * invisible to matching no matter how well its name matched; it's still
 * left alone if it's already sitting in a DIFFERENT real category, since
 * that's a genuine signal it's something else. Ties are broken by closest
 * amount. Pure and DB-free so this is unit-testable without a database --
 * the caller is responsible for fetching the candidate pool (this cycle's
 * transactions with no recurringExpenseId set yet, in the recurring
 * expense's own category or with none at all).
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
    if (candidate.categoryId !== null && candidate.categoryId !== recurringExpense.categoryId) continue;

    const nameB = candidate.name.trim().toLowerCase();
    if (!namesLikelyMatch(nameA, nameB)) continue;

    const diff = Math.abs(candidate.amount - recurringExpense.amount);
    if (diff > tolerance) continue;

    if (diff < bestDiff) {
      best = candidate;
      bestDiff = diff;
    }
  }

  return best;
}
