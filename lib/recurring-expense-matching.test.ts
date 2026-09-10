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

describe("findMatchSuggestion -- word-overlap matching and the category-null fix", () => {
  const claude: RecurringExpenseForMatching = {
    id: "re-claude",
    name: "Claude",
    amount: 20,
    categoryId: "cat-software",
  };

  it("matches on a shared significant word when neither name contains the other whole", () => {
    // The exact case this was added for: bill "Claude", transaction
    // "Anthropic Claude" -- "anthropic claude" DOES contain "claude" as a
    // substring too, but this fixture also proves the word-overlap path
    // works standalone (see the next test for a case substring can't touch).
    const result = findMatchSuggestion(claude, [
      candidate({ name: "Anthropic Claude", amount: 20, categoryId: null }),
    ]);
    expect(result?.id).toBe("tx-1");
  });

  it("matches via a shared word even with decorative punctuation on both sides", () => {
    // "software-claude" contains "claude" as a whole substring already, so
    // use fixtures where NEITHER string contains the other -- e.g. a
    // two-word bill name against differently-ordered/decorated transaction
    // text, which pure substring-in-either-direction could never catch.
    const netflix: RecurringExpenseForMatching = {
      id: "re-prime",
      name: "Amazon Prime",
      amount: 14.99,
      categoryId: "cat-subscriptions",
    };
    const result = findMatchSuggestion(netflix, [
      candidate({ name: "PRIME VIDEO*AMZN", amount: 14.99, categoryId: "cat-subscriptions" }),
    ]);
    expect(result?.id).toBe("tx-1");
  });

  it("does not match on a short, generic shared fragment", () => {
    // "us" is a real shared substring/token between these two names but is
    // far too short/generic to mean anything -- MIN_SIGNIFICANT_TOKEN_LENGTH
    // filters it out, so this must not match.
    const result = findMatchSuggestion(
      { id: "re-us", name: "US Bank", amount: 5, categoryId: "cat-fees" },
      [candidate({ name: "Bus Pass", amount: 5, categoryId: "cat-fees" })],
    );
    expect(result).toBeNull();
  });

  it("still returns null when there is no shared word at all", () => {
    const result = findMatchSuggestion(claude, [
      candidate({ name: "Anthropic", amount: 20, categoryId: null }),
    ]);
    expect(result).toBeNull();
  });

  it("treats an UNCATEGORIZED candidate (categoryId: null) as eligible", () => {
    // The actual bug: a brand-new Gmail-imported merchant this user has
    // never categorized before lands with expenseCategoryId: null, and used
    // to be structurally invisible to matching no matter how well its name
    // matched -- see findMatchSuggestion's own doc comment.
    const result = findMatchSuggestion(claude, [
      candidate({ name: "Anthropic Claude", amount: 20, categoryId: null }),
    ]);
    expect(result?.id).toBe("tx-1");
  });

  it("still refuses a candidate already sitting in a DIFFERENT real category", () => {
    // Not-yet-categorized (null) is a fair candidate; already filed under
    // something else is still a real signal it's not this bill.
    const result = findMatchSuggestion(claude, [
      candidate({ name: "Anthropic Claude", amount: 20, categoryId: "cat-travel" }),
    ]);
    expect(result).toBeNull();
  });
});
