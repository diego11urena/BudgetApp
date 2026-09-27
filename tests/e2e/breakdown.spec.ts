import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory, fillAmount } from "./helpers";

test.describe("Breakdown", () => {
  test("LIVE: renders real pacing and populated chapters, not the error boundary", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "2000" });

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "120.00");
    await fillCategory(page, "Groceries");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Groceries" })).toBeVisible();

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "45.00");
    await fillCategory(page, "Transport");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Transport" })).toBeVisible();

    await page.goto("/transactions");
    await page.click('a:has-text("Breakdown")');
    await page.waitForURL(/\/transactions\/breakdown/, { waitUntil: "commit" });

    // The crash this screen used to die with: passing the Dictionary across
    // the server/client boundary threw and tripped the error boundary.
    await expect(page.getByText("We hit a snag")).toHaveCount(0);
    await expect(page.locator(".breakdown-screen-v2")).toBeVisible();

    // Real pacing, not the "Day X of Y · $XXX" placeholders this shipped with.
    const banner = page.locator(".breakdown-banner");
    await expect(banner).toContainText(/Day \d+ of \d+/);
    await expect(banner).toContainText("$165.00");
    await expect(banner).not.toContainText("XXX");

    await expect(page.locator(".breakdown-chapter")).toHaveCount(5);

    // No leftover pie/donut/area-chart remnant from the pre-rework version.
    await expect(page.locator('[class*="trend-area-chart"], [class*="small-multiples"], [class*="pie"], [class*="donut"]')).toHaveCount(0);

    // 01 — cash flow: both logged transactions are discretionary (no
    // recurring link, no goal), so everythingElse = $165, fixed/saved = $0,
    // and leftover is whatever's left of the $2,000 net pay.
    const cashFlowChapter = page.locator(".breakdown-chapter").nth(0);
    await expect(cashFlowChapter.locator(".cash-flow-legend")).toContainText("Everything else");
    await expect(cashFlowChapter.locator(".cash-flow-legend")).toContainText("$165.00");
    await expect(cashFlowChapter.locator(".cash-flow-legend")).toContainText("$1,835.00");

    // 02 — recurring: a brand-new account has none set up (signUpAndOnboard
    // removes the seeded example row), so this renders its 0-of-0 state
    // rather than erroring.
    await expect(page.locator(".recurring-fulfillment-card")).toBeVisible();

    // 03 — a bar per category, biggest first, each new (no prior history).
    const categories = page.locator(".breakdown-category-row");
    await expect(categories).toHaveCount(2);
    await expect(categories.first()).toContainText("Groceries");
    await expect(categories.first()).toContainText("$120.00");
    await expect(categories.first()).toContainText("New this period");

    // 04 — the heatmap is drawn, and (LIVE) today is preselected with its
    // own transactions listed under it.
    await expect(page.locator(".heatmap-grid")).toBeVisible();
    await expect(page.locator(".heatmap-cell--selected")).toHaveCount(1);
    await expect(page.locator(".breakdown-day-row-name")).toHaveCount(2);
    await expect(page.locator(".breakdown-day-detail-total")).toHaveText("$165.00");

    // 05 — biggest transactions excludes whichever day chapter 04 defaulted
    // to; both logged transactions happened today (LIVE's default day), so
    // this chapter has nothing left to show -- the exclusion rule working
    // as designed, not a bug (see lib/breakdown-v2's pickDefaultSelectedDay).
    await expect(page.locator(".biggest-transaction-row")).toHaveCount(0);
    await expect(page.locator(".breakdown-chapter").nth(4).getByText("No spending")).toBeVisible();
  });

  test("a brand-new cycle with no spending says so instead of erroring", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/transactions/breakdown");
    await expect(page.getByText("We hit a snag")).toHaveCount(0);
    await expect(page.locator(".breakdown-screen-v2")).toBeVisible();
    await expect(page.locator(".breakdown-chapter")).toHaveCount(5);
    // No invented data: chapters 03 (by category), 04 (when you spend) and
    // 05 (biggest transactions) all report "No spending" rather than
    // drawing empty bars/rows.
    await expect(page.getByText("No spending")).toHaveCount(3);
    // 01 (cash flow) and 02 (recurring) still render -- $0 everywhere is a
    // real, valid state for those, not an empty one.
    await expect(page.locator(".cash-flow-legend")).toBeVisible();
    await expect(page.locator(".recurring-fulfillment-card")).toBeVisible();
  });

  test("chapter 03's 'Usual: $X' line appears once there's real prior-period history for that category", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1200" });

    // One closed cycle with a Coffee purchase in it, so chapter 03's rolling
    // average has a real prior period to average, not just the current one.
    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "10.00");
    await fillCategory(page, "Coffee");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Coffee" })).toBeVisible();

    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector('button:has-text("Yes, I got paid")');
    await page.click('button:has-text("Yes, I got paid")');
    await page.waitForURL(/\/dashboard\/summary\//, { timeout: 60_000, waitUntil: "commit" });
    await page.click(".summary-cta-primary");
    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 60_000, waitUntil: "commit" });

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "80.00");
    await fillCategory(page, "Coffee");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Coffee" })).toBeVisible();

    await page.goto("/transactions/breakdown");
    await expect(page.getByText("We hit a snag")).toHaveCount(0);

    const coffeeRow = page.locator(".breakdown-category-row", { hasText: "Coffee" });
    await expect(coffeeRow).toContainText("$80.00");
    await expect(coffeeRow).toContainText("Usual: $10.00");
    await expect(coffeeRow).not.toContainText("New this period");
  });

  test("CLOSED: reachable from History with prev/next navigation", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1500" });

    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector('button:has-text("Yes, I got paid")');
    await page.click('button:has-text("Yes, I got paid")');
    await page.waitForURL(/\/dashboard\/summary\//, { timeout: 60_000, waitUntil: "commit" });

    await page.goto("/history");
    await page.locator("a[href^='/history/']").first().click();
    await page.waitForURL(/\/history\/[a-z0-9]+/, { waitUntil: "commit" });
    await page.click('a:has-text("Breakdown")');
    await page.waitForURL(/\/transactions\/breakdown\?cycle=/, { waitUntil: "commit" });

    await expect(page.getByText("We hit a snag")).toHaveCount(0);
    await expect(page.locator(".breakdown-screen-v2")).toBeVisible();
    await expect(page.locator(".breakdown-header-title")).toHaveText("Where it went");
  });
});
