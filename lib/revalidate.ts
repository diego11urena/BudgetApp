import { revalidatePath } from "next/cache";

/**
 * Any transaction/budget/goal/category mutation can affect all of these —
 * e.g. logging a transaction under a new category name creates an
 * ExpenseCategory row that Profile's "Manage categories" list should show
 * without a full reload too.
 */
export function revalidateAppPages() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/goals");
  revalidatePath("/profile");
}
