import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CategoryTotal } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";

export function TopCategoriesChart({ categories }: { categories: CategoryTotal[] }) {
  if (categories.length === 0) {
    return (
      <div>
        <h2>Top categories this quincena</h2>
        <p className="field-hint">No expenses logged yet this quincena.</p>
        <Link href="/dashboard/breakdown" className="line-item line-item--link">
          <span>View breakdown</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const maxAmount = Math.max(...categories.map((c) => c.amount));

  return (
    <div>
      <h2>Top categories this quincena</h2>
      <div className="bar-chart">
        {categories.map((category) => (
          <div className="bar-chart-row" key={category.categoryId}>
            <span className="bar-chart-label">
              <CategoryIcon
                name={category.categoryName}
                className="bar-chart-icon"
                size={16}
                aria-hidden="true"
              />
              {category.categoryName}
            </span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{ width: `${(category.amount / maxAmount) * 100}%` }}
              />
            </div>
            <span className="bar-chart-value">{formatCurrency(category.amount)}</span>
          </div>
        ))}
      </div>
      <Link href="/dashboard/breakdown" className="line-item line-item--link">
        <span>View breakdown</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
