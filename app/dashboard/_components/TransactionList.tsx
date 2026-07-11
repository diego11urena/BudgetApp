import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { deleteTransactionAction } from "../actions";

function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const TYPE_LABEL: Record<CycleTransactionSummary["type"], string> = {
  EXPENSE: "Expense",
  INCOME: "Extra income",
  SAVINGS: "Savings",
};

export function TransactionList({
  transactions,
}: {
  transactions: CycleTransactionSummary[];
}) {
  if (transactions.length === 0) {
    return <p className="field-hint">Nothing logged yet this cycle.</p>;
  }

  return (
    <div>
      {transactions.map((tx) => (
        <div className="transaction-row" key={tx.id}>
          <div className="transaction-meta">
            <span className="transaction-name">{tx.name}</span>
            <span className="transaction-sub">
              {TYPE_LABEL[tx.type]}
              {tx.categoryName && tx.categoryName !== tx.name ? ` · ${tx.categoryName}` : ""}
            </span>
          </div>
          <div className="transaction-row-actions">
            <span
              className={`transaction-amount ${tx.type === "INCOME" ? "transaction-amount--income" : ""}`}
            >
              {tx.type === "INCOME" ? "+" : "-"}
              {formatUSD(tx.amount)}
            </span>
            <form action={deleteTransactionAction}>
              <input type="hidden" name="transactionId" value={tx.id} />
              <button type="submit" className="icon-button" aria-label={`Delete ${tx.name}`}>
                Delete
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
