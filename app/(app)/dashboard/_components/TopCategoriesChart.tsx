import type { CategoryTotal } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { EmptyState } from "../../_components/EmptyState";

export function TopCategoriesChart({
  categories,
  title = "Top categories this quincena",
  badge,
}: {
  categories: CategoryTotal[];
  /** "This quincena" only reads correctly on Home — a past cycle's own page passes a plain "Top categories" instead. */
  title?: string;
  /** Home passes "Top 6" -- a small trailing label next to the header, matching the design system's "Where it's going" spec. Omitted (History) renders no badge. */
  badge?: string;
}) {
  if (categories.length === 0) {
    return (
      <div>
        <h2>{title}</h2>
        <EmptyState>No expenses logged yet this quincena.</EmptyState>
      </div>
    );
  }

  const maxAmount = Math.max(...categories.map((c) => c.amount));

  return (
    <div>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0 }}>{title}</h2>
        {badge && <span className="chart-badge">{badge}</span>}
      </div>
      <div className="bar-chart">
        {categories.map((category, index) => (
          <div className="bar-chart-row" key={category.categoryId}>
            <span className="bar-chart-label">
              <CategoryIcon
                name={category.categoryName}
                icon={category.categoryIcon}
                className="bar-chart-icon"
                size={16}
                aria-hidden="true"
              />
              {category.categoryName}
            </span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{
                  width: `${(category.amount / maxAmount) * 100}%`,
                  // Position-based, not a per-category identity color --
                  // "Where it's going" is always the top 6 for THIS cycle,
                  // so row 1 is always the categorical palette's first hue
                  // regardless of which category happens to be biggest.
                  background: `var(--chart-cat-${(index % 6) + 1})`,
                }}
              />
            </div>
            <span className="bar-chart-value">{formatCurrency(category.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
