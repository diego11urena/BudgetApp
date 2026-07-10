export interface DefaultCategory {
  name: string;
  type: "EXPENSE" | "SAVINGS";
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Housing", type: "EXPENSE" },
  { name: "Utilities", type: "EXPENSE" },
  { name: "Groceries", type: "EXPENSE" },
  { name: "Transportation", type: "EXPENSE" },
  { name: "Health", type: "EXPENSE" },
  { name: "Entertainment", type: "EXPENSE" },
  { name: "Debt Payments", type: "EXPENSE" },
  { name: "Savings", type: "SAVINGS" },
];
