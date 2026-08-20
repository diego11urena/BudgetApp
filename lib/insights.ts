import type { CycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";

/**
 * Rule-based insights from real cycle history — no LLM call. Rules run in
 * priority order; up to 3 are shown. `previousClosedFinancials` must be
 * ordered newest-first (as getRecentCycles already returns).
 */
export function generateInsights(
  current: CycleFinancials,
  previousClosedFinancials: CycleFinancials[],
): string[] {
  const insights: string[] = [];

  // The category-delta and streak rules are inherently comparative --
  // "up/down vs last cycle" and "N cycles in a row" are meaningless with
  // no prior cycle to compare against, so they stay gated on history.
  // The on-track/over-budget rule below needs only the CURRENT cycle's
  // own numbers and must not be blocked by that same guard -- a
  // first-time user with exactly one cycle should still see it (this was
  // previously gated by a blanket early return that hid every rule,
  // including this one, whenever previousClosedFinancials was empty).
  if (previousClosedFinancials.length > 0) {
    const mostRecent = previousClosedFinancials[0];
    const topCategory = current.topCategories[0];
    if (topCategory) {
      const previousForCategory = mostRecent.categoryTotals.find(
        (c) => c.categoryId === topCategory.categoryId,
      );
      if (previousForCategory) {
        const delta = topCategory.amount - previousForCategory.amount;
        if (Math.abs(delta) >= 1) {
          const direction = delta > 0 ? "up" : "down";
          insights.push(
            `${topCategory.categoryName} spending is ${direction} ${formatCurrency(Math.abs(delta))} vs last cycle.`,
          );
        }
      }
    }
  }

  if (current.amountLeft >= 0) {
    insights.push(`You're on track to have ${formatCurrency(current.amountLeft)} left this cycle.`);
  } else {
    insights.push(
      `You're ${formatCurrency(Math.abs(current.amountLeft))} over budget this cycle so far.`,
    );
  }

  if (previousClosedFinancials.length > 0) {
    let streak = 0;
    for (const cycle of previousClosedFinancials) {
      if (cycle.amountLeft < 0) break;
      streak++;
    }
    if (streak >= 2) {
      insights.push(`You've stayed under budget for ${streak} cycles in a row.`);
    }
  }

  if (insights.length === 0) {
    insights.push("Log a few transactions to start seeing insights.");
  }

  return insights.slice(0, 3);
}
