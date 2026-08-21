export interface CategoryWithUsage {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  transactionCount: number;
  totalAmount: number;
  hasBudgetGoal: boolean;
  isUnused: boolean;
}
