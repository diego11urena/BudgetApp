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

    await expect(page.locator(".breakdown-chapter")).toHaveCount(4);

    // 01 — the heatmap is drawn, and the highest-spend day is preselected
    // with its own transactions listed under it.
    await expect(page.locator(".heatmap-grid")).toBeVisible();
    await expect(page.locator(".heatmap-cell--selected")).toHaveCount(1);
    await expect(page.locator(".breakdown-day-row-name")).toHaveCount(2);
    await expect(page.locator(".breakdown-day-detail-total")).toHaveText("$165.00");

    // 04 — a bar per category, biggest first.
    const categories = page.locator(".breakdown-category-row");
    await expect(categories).toHaveCount(2);
    await expect(categories.first()).toContainText("Groceries");
    await expect(categories.first()).toContainText("$120.00");

    // 02/03 need history a brand-new account doesn't have, so they should
    // say so rather than drawing a one-point "trend".
    await expect(page.getByText(/Not enough history yet/)).toHaveCount(2);
  });

  test("a brand-new cycle with no spending says so instead of erroring", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/transactions/breakdown");
    await expect(page.getByText("We hit a snag")).toHaveCount(0);
    await expect(page.locator(".breakdown-screen-v2")).toBeVisible();
    await expect(page.locator(".breakdown-chapter")).toHaveCount(4);
    // No invented data: chapters 01 and 04 report empty, 02/03 report thin history.
    await expect(page.getByText("No spending")).toHaveCount(2);
  });

  test("chapters 02 and 03 draw once there IS history to compare against", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1200" });

    // One closed cycle with spending in it, so the trailing series has a
    // real prior period rather than only the current one.
    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "300.00");
    await fillCategory(page, "Rent");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Rent" })).toBeVisible();

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

    // 02 -- the stacked area actually renders, with its legend.
    await expect(page.locator(".trend-area-chart")).toBeVisible();
    await expect(page.locator(".breakdown-legend-item").first()).toBeVisible();

    // 03 -- one bar per period, and a stated direction rather than the
    // "not enough history" fallback.
    await expect(page.locator(".small-multiples-bar")).toHaveCount(2);
    await expect(page.getByText(/Your fixed share is/)).toBeVisible();
    await expect(page.getByText(/Not enough history yet/)).toHaveCount(0);
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
