import { describe, expect, it } from "vitest";
import { budgetLineItemsSchema } from "./onboarding";

function items(count: number) {
  return Array.from({ length: count }, (_, i) => ({ name: `Item ${i}`, targetAmount: "10.00" }));
}

describe("budgetLineItemsSchema", () => {
  it("accepts an empty list", () => {
    expect(budgetLineItemsSchema.safeParse({ items: [] }).success).toBe(true);
  });

  it("accepts up to 50 items", () => {
    expect(budgetLineItemsSchema.safeParse({ items: items(50) }).success).toBe(true);
  });

  it("rejects more than 50 items", () => {
    // saveExpensesAction/saveSavingsAction write 2-3 rows per item inside
    // one interactive $transaction -- an unbounded array turns a large
    // client payload into a long-running transaction against the DB.
    expect(budgetLineItemsSchema.safeParse({ items: items(51) }).success).toBe(false);
  });
});
