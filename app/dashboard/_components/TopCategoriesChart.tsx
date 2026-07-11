import type { CategoryTotal } from "@/lib/cycle-financials";

function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function TopCategoriesChart({ categories }: { categories: CategoryTotal[] }) {
  if (categories.length === 0) {
    return (
      <div>
        <h2>Top categories this cycle</h2>
        <p className="field-hint">No expenses logged yet this cycle.</p>
      </div>
    );
  }

  const maxAmount = Math.max(...categories.map((c) => c.amount));

  return (
    <div>
      <h2>Top categories this cycle</h2>
      <div className="bar-chart">
        {categories.map((category) => (
          <div className="bar-chart-row" key={category.categoryId}>
            <span className="bar-chart-label">{category.categoryName}</span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{ width: `${(category.amount / maxAmount) * 100}%` }}
              />
            </div>
            <span className="bar-chart-value">{formatUSD(category.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
