import { describe, expect, it } from "vitest";
import { findMatchSuggestion, type MatchCandidateTransaction, type RecurringExpenseForMatching } from "./recurring-expense-matching";

const spotify: RecurringExpenseForMatching = {
  id: "re-1",
  name: "Spotify",
  amount: 9.99,
  categoryId: "cat-subscriptions",
};

function candidate(overrides: Partial<MatchCandidateTransaction>): MatchCandidateTransaction {
  return {
    id: "tx-1",
    name: "SPOTIFY *PREMIUM US",
    amount: 9.99,
    categoryId: "cat-subscriptions",
    recurringExpenseId: null,
    ...overrides,
  };
}

describe("findMatchSuggestion", () => {
  it("matches when the name is a substring of raw bank text and the amount is exact", () => {
    const result = findMatchSuggestion(spotify, [candidate({})]);
    expect(result?.id).toBe("tx-1");
  });

  it("matches the reverse direction -- a clean candidate name containing the recurring expense's fuller name", () => {
    const netflix: RecurringExpenseForMatching = {
      id: "re-2",
      name: "Netflix Premium",
      amount: 15.99,
      categoryId: "cat-subscriptions",
    };
    const result = findMatchSuggestion(netflix, [candidate({ name: "Netflix", amount: 15.99 })]);
    expect(result?.id).toBe("tx-1");
  });

  it("matches within the tolerance band when the amount ticked up slightly", () => {
    const result = findMatchSuggestion(spotify, [candidate({ amount: 10.79 })]);
    expect(result?.id).toBe("tx-1");
  });

  it("does not match when the amount is outside the tolerance band", () => {
    const result = findMatchSuggestion(spotify, [candidate({ amount: 25 })]);
    expect(result).toBeNull();
  });

  it("does not match when the names share no substring relationship", () => {
    const result = findMatchSuggestion(spotify, [candidate({ name: "METRO BELLA VISTA 4730PANAMA PA" })]);
    expect(result).toBeNull();
  });

  it("never returns a candidate already linked to a recurring expense", () => {
    const result = findMatchSuggestion(spotify, [candidate({ recurringExpenseId: "re-other" })]);
    expect(result).toBeNull();
  });

  it("respects category scoping -- a same-name candidate in a different category never matches", () => {
    const result = findMatchSuggestion(spotify, [candidate({ categoryId: "cat-entertainment" })]);
    expect(result).toBeNull();
  });

  it("picks the closest-amount candidate when more than one qualifies", () => {
    const result = findMatchSuggestion(spotify, [
      candidate({ id: "tx-far", amount: 10.5 }),
      candidate({ id: "tx-close", amount: 10.05 }),
    ]);
    expect(result?.id).toBe("tx-close");
  });

  it("returns null when the candidate pool is empty", () => {
    expect(findMatchSuggestion(spotify, [])).toBeNull();
  });
});
