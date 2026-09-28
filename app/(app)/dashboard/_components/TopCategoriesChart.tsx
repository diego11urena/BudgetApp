import type { CategoryTotal } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { categoryColorVar } from "@/lib/category-colors";
import { EmptyState } from "../../_components/EmptyState";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { BudgetFrequency } from "@/lib/quincena-pace";

export async function TopCategoriesChart({
  categories,
  title,
  badge,
  budgetFrequency = "QUINCENAL",
}: {
  categories: CategoryTotal[];
  /** "This quincena" only reads correctly on Home — a past cycle's own page passes a plain "Top categories" instead. */
  title?: string;
  /** Home passes "Top 6" -- a small trailing label next to the header, matching the design system's "Where it's going" spec. Omitted (History) renders no badge. */
  badge?: string;
  /** Only matters when `title` is omitted (defaults to the period-qualified fallback) -- callers that pass their own title (dashboard/page.tsx always does) don't need this. */
  budgetFrequency?: BudgetFrequency;
}) {
  const dict = getDictionary(await getRequestLocale());
  const t = dict.dashboard;
  const resolvedTitle = title ?? t.topCategoriesTitle(resolveVocab(dict, budgetFrequency));

  if (categories.length === 0) {
    return (
      <div>
        <h2>{resolvedTitle}</h2>
        <EmptyState>{t.noExpensesYet(resolveVocab(dict, budgetFrequency))}</EmptyState>
      </div>
    );
  }

  const maxAmount = Math.max(...categories.map((c) => c.amount));

  return (
    <div>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0 }}>{resolvedTitle}</h2>
        {badge && <span className="chart-badge">{badge}</span>}
      </div>
      <div className="bar-chart">
        {categories.map((category) => (
          <div className="bar-chart-row" key={category.categoryId}>
            {/* No icon: the spec's row is label / bar / amount on a
                76px 1fr 62px grid, and screens/01 draws it that way. An
                icon in a 76px column left the longer category names
                ellipsed down to almost nothing. */}
            <span className="bar-chart-label">{category.categoryName}</span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{
                  width: `${(category.amount / maxAmount) * 100}%`,
                  // Per-category identity, not position. The palette rule
                  // is "Fixed per category (not per rank)", so Food is the
                  // same pink here as in Breakdown's donut -- which is the
                  // whole point of the two screens sharing a palette.
                  background: categoryColorVar(category.categoryName),
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
