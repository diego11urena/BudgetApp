import { revalidatePath } from "next/cache";

/**
 * Any transaction/budget/goal/category mutation can affect all of these —
 * e.g. logging a transaction under a new category name creates an
 * ExpenseCategory row that Profile's "Manage categories" list should show
 * without a full reload too. Deliberately over-broad rather than scoped
 * per-mutation: every one of these pages is fully dynamic (auth() on every
 * request, no static/ISR caching anywhere in the app), so an unnecessary
 * revalidatePath call is cheap -- a missing one is what actually costs a
 * user a stale screen. History and the paycheck breakdown used to be
 * missing here, papered over by client components calling
 * router.refresh() themselves (see e.g. EditPayInfoSheet's own comment) --
 * real, but a convention every future action has to remember to repeat,
 * not a guarantee this function actually provides.
 */
export function revalidateAppPages() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/transactions/breakdown");
  revalidatePath("/plan");
  revalidatePath("/profile");
  revalidatePath("/history");
  revalidatePath("/history/[cycleId]", "page");
}
