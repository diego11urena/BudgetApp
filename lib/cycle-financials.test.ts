import { describe, expect, it } from "vitest";
import { summarizeCycleFinancials, sumFixedTargetSpend, toCycleTransactionSummary } from "./cycle-financials";

function decimal(value: number) {
  return { toNumber: () => value };
}

function tx(
  type: "EXPENSE" | "INCOME" | "SAVINGS",
  amount: number,
  overrides: { name?: string; category?: { id: string; name: string } | null } = {},
) {
  return {
    id: `${type}-${Math.random()}`,
    type,
    name: overrides.name ?? type,
    amount: decimal(amount),
    occurredAt: new Date(2026, 7, 2),
    expenseCategory: overrides.category ?? null,
  };
}

describe("summarizeCycleFinancials", () => {
  it("sums base income from every income entry", () => {
    const result = summarizeCycleFinancials(
      [{ netAmount: decimal(500) }, { netAmount: decimal(300) }],
      [],
    );
    expect(result.baseIncome).toBe(800);
  });

  it("computes amountLeft as income minus expenses minus savings", () => {
    const result = summarizeCycleFinancials(
      [{ netAmount: decimal(1000) }],
      [
        tx("EXPENSE", 200),
        tx("EXPENSE", 50),
        tx("SAVINGS", 100),
        tx("INCOME", 75),
      ],
    );
    expect(result.extraIncome).toBe(75);
    expect(result.totalExpenses).toBe(250);
    expect(result.totalSavings).toBe(100);
    // 1000 (base) + 75 (extra) - 250 (expenses) - 100 (savings) = 725
    expect(result.amountLeft).toBe(725);
  });

  it("can go negative when spending exceeds income", () => {
    const result = summarizeCycleFinancials(
      [{ netAmount: decimal(100) }],
      [tx("EXPENSE", 300)],
    );
    expect(result.amountLeft).toBe(-200);
  });

  it("groups expense totals by category and sums within each", () => {
    const groceries = { id: "cat-groceries", name: "Groceries" };
    const rent = { id: "cat-rent", name: "Rent" };
    const result = summarizeCycleFinancials(
      [],
      [
        tx("EXPENSE", 30, { category: groceries }),
        tx("EXPENSE", 20, { category: groceries }),
        tx("EXPENSE", 800, { category: rent }),
      ],
    );
    const groceriesTotal = result.categoryTotals.find((c) => c.categoryId === "cat-groceries");
    const rentTotal = result.categoryTotals.find((c) => c.categoryId === "cat-rent");
    expect(groceriesTotal?.amount).toBe(50);
    expect(rentTotal?.amount).toBe(800);
  });

  it("sorts categoryTotals descending by amount", () => {
    const result = summarizeCycleFinancials(
      [],
      [
        tx("EXPENSE", 10, { category: { id: "small", name: "Small" } }),
        tx("EXPENSE", 999, { category: { id: "big", name: "Big" } }),
        tx("EXPENSE", 100, { category: { id: "mid", name: "Mid" } }),
      ],
    );
    expect(result.categoryTotals.map((c) => c.categoryId)).toEqual(["big", "mid", "small"]);
  });

  it("excludes SAVINGS/INCOME transactions and uncategorized expenses from categoryTotals", () => {
    const result = summarizeCycleFinancials(
      [],
      [
        tx("SAVINGS", 100, { category: { id: "cat-savings", name: "Emergency Fund" } }),
        tx("INCOME", 50),
        tx("EXPENSE", 20, { category: null }),
      ],
    );
    expect(result.categoryTotals).toEqual([]);
  });

  it("caps topCategories at 5 even with more categories present", () => {
    const categories = Array.from({ length: 8 }, (_, i) => ({ id: `cat-${i}`, name: `Cat ${i}` }));
    const transactions = categories.map((category, i) =>
      tx("EXPENSE", (i + 1) * 10, { category }),
    );
    const result = summarizeCycleFinancials([], transactions);
    expect(result.categoryTotals).toHaveLength(8);
    expect(result.topCategories).toHaveLength(5);
    // Highest amounts (cat-7..cat-3) should be the top 5.
    expect(result.topCategories.map((c) => c.categoryId)).toEqual([
      "cat-7",
      "cat-6",
      "cat-5",
      "cat-4",
      "cat-3",
    ]);
  });

  it("returns zeroed totals for an empty cycle", () => {
    const result = summarizeCycleFinancials([], []);
    expect(result).toMatchObject({
      baseIncome: 0,
      extraIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      amountLeft: 0,
      transactions: [],
      categoryTotals: [],
      topCategories: [],
    });
  });

  it("maps each transaction's categoryName from its linked category, null when uncategorized", () => {
    const result = summarizeCycleFinancials(
      [],
      [
        tx("EXPENSE", 20, { category: { id: "cat-1", name: "Groceries" }, name: "Weekly shop" }),
        tx("INCOME", 50, { name: "Bonus" }),
      ],
    );
    const [expenseRow, incomeRow] = result.transactions;
    expect(expenseRow.name).toBe("Weekly shop");
    expect(expenseRow.categoryName).toBe("Groceries");
    expect(incomeRow.categoryName).toBeNull();
  });
});

describe("toCycleTransactionSummary", () => {
  it("maps a raw transaction into the shared summary shape with no extras by default", () => {
    const row = tx("EXPENSE", 42, { category: { id: "cat-1", name: "Groceries" }, name: "Weekly shop" });
    const result = toCycleTransactionSummary(row);
    expect(result).toEqual({
      id: row.id,
      type: "EXPENSE",
      name: "Weekly shop",
      amount: 42,
      categoryName: "Groceries",
      occurredAt: row.occurredAt,
      isImported: false,
      importSource: "MANUAL",
      paymentMethod: null,
    });
  });

  it("marks isImported true when sourceMessageId is set", () => {
    const row = { ...tx("EXPENSE", 10), sourceMessageId: "gmail-msg-1" };
    expect(toCycleTransactionSummary(row).isImported).toBe(true);
  });

  it("defaults importSource to MANUAL and paymentMethod to null when not provided, and passes through explicit values", () => {
    const manualRow = tx("EXPENSE", 10);
    expect(toCycleTransactionSummary(manualRow).importSource).toBe("MANUAL");
    expect(toCycleTransactionSummary(manualRow).paymentMethod).toBeNull();

    const importedRow = { ...tx("EXPENSE", 10), importSource: "GMAIL" as const, paymentMethod: "YAPPY" as const };
    expect(toCycleTransactionSummary(importedRow).importSource).toBe("GMAIL");
    expect(toCycleTransactionSummary(importedRow).paymentMethod).toBe("YAPPY");
  });

  it("applies cycleLabel and isEditable only when extra is passed", () => {
    const row = tx("EXPENSE", 10);
    const withExtra = toCycleTransactionSummary(row, { cycleLabel: "2026-08-01", isEditable: false });
    expect(withExtra.cycleLabel).toBe("2026-08-01");
    expect(withExtra.isEditable).toBe(false);

    const withoutExtra = toCycleTransactionSummary(row);
    expect(withoutExtra.cycleLabel).toBeUndefined();
    expect(withoutExtra.isEditable).toBeUndefined();
  });
});

describe("sumFixedTargetSpend", () => {
  it("only sums categories that are in the fixed-target id list", () => {
    const total = sumFixedTargetSpend(
      [
        { categoryId: "rent", categoryName: "Rent", amount: 500 },
        { categoryId: "groceries", categoryName: "Groceries", amount: 200 },
        { categoryId: "spotify", categoryName: "Spotify", amount: 10 },
      ],
      ["rent", "spotify"],
    );
    expect(total).toBe(510);
  });

  it("returns 0 when no category totals match a fixed target", () => {
    const total = sumFixedTargetSpend(
      [{ categoryId: "groceries", categoryName: "Groceries", amount: 200 }],
      ["rent"],
    );
    expect(total).toBe(0);
  });

  it("returns 0 for an empty category totals list", () => {
    expect(sumFixedTargetSpend([], ["rent"])).toBe(0);
  });
});
