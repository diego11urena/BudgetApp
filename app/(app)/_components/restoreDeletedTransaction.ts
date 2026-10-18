import { restoreTransactionAction, type DeletedTransactionSnapshot } from "../_actions/transactions";

/** Undo for deleteTransactionAction: resubmits its snapshot to restoreTransactionAction. */
export function restoreDeletedTransaction(d: DeletedTransactionSnapshot) {
  const fd = new FormData();
  fd.set("cycleId", d.cycleId);
  fd.set("type", d.type);
  fd.set("name", d.name);
  fd.set("amount", String(d.amount));
  fd.set("occurredAt", d.occurredAt);
  if (d.paymentMethod) fd.set("paymentMethod", d.paymentMethod);
  if (d.description) fd.set("description", d.description);
  if (d.expenseCategoryId) fd.set("expenseCategoryId", d.expenseCategoryId);
  if (d.recurringExpenseId) fd.set("recurringExpenseId", d.recurringExpenseId);
  fd.set("importSource", d.importSource);
  if (d.sourceMessageId) fd.set("sourceMessageId", d.sourceMessageId);
  return restoreTransactionAction(fd);
}
