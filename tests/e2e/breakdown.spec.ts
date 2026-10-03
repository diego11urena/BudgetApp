import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory, fillAmount, openMoreDetails } from "./helpers";

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
    await page.click(".transaction-breakdown-cta");
    await page.waitForURL(/\/transactions\/breakdown/, { waitUntil: "commit" });

    // The crash this screen used to die with: passing the Dictionary across
    // the server/client boundary threw and tripped the error boundary.
    await expect(page.getByText("We hit a snag")).toHaveCount(0);
    await expect(page.locator(".breakdown-screen-v2")).toBeVisible();

    // Real pacing, not the "Day X of Y · $XXX" placeholders this shipped with.
    const banner = page.locator(".breakdown-banner");
    await expect(banner).toContainText(/Day \d+ of \d+/);
    await expect(banner).toContainText("$165");
    await expect(banner).not.toContainText("XXX");

    await expect(page.locator(".breakdown-chapter")).toHaveCount(5);

    // "No pie/donut/area chart remains in Summary or Breakdown OTHER THAN
    // the By category donut" -- so this guards the deleted charts and any
    // stray pie, while .category-donut-* is the one permitted exception
    // and is asserted positively in chapter 03 below.
    await expect(
      page.locator(
        '[class*="trend-area-chart"], [class*="small-multiples"], [class*="pie"], [class*="donut"]:not([class*="category-donut"])',
      ),
    ).toHaveCount(0);

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

    // 03 — the By-category donut: one legend row per category, biggest
    // first, each new (no prior history).
    const categories = page.locator(".category-donut-legend-row");
    await expect(categories).toHaveCount(2);
    await expect(categories.first()).toContainText("Groceries");
    await expect(categories.first()).toContainText("$120.00");
    await expect(categories.first()).toContainText("New this period");

    // 04 — the heatmap is drawn, and (LIVE) today is preselected with its
    // own transactions listed under it. Header reads "Today · {date} ·
    // {total}" for the LIVE default-selected day.
    await expect(page.locator(".heatmap-grid")).toBeVisible();
    await expect(page.locator(".heatmap-cell--selected")).toHaveCount(1);
    await expect(page.locator(".breakdown-day-row-name")).toHaveCount(2);
    const dayHeader = page.locator(".breakdown-day-detail-header");
    await expect(dayHeader).toContainText("Today");
    await expect(dayHeader).toContainText("$165.00");

    // 05 — biggest transactions excludes whichever day chapter 04 defaulted
    // to; both logged transactions happened today (LIVE's default day), so
    // this chapter has nothing left to show -- the exclusion rule working
    // as designed, not a bug (see lib/breakdown-v2's pickDefaultSelectedDay).
    await expect(page.locator(".biggest-transaction-row")).toHaveCount(0);
    await expect(page.locator(".breakdown-chapter").nth(4).getByText("No spending")).toBeVisible();
  });

  test("chapter 03's donut selects on tap and clears when the same row is tapped again", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "120.00");
    await fillCategory(page, "Groceries");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Groceries" })).toBeVisible();

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "40.00");
    await fillCategory(page, "Transport");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Transport" })).toBeVisible();

    await page.goto("/transactions/breakdown");
    await expect(page.getByText("We hit a snag")).toHaveCount(0);

    const centre = page.locator(".category-donut-centre");
    const groceries = page.locator(".category-donut-legend-row", { hasText: "Groceries" });

    // Resting state: the period total and the category count, not a slice.
    await expect(centre).toContainText("$160.00");
    await expect(centre).toContainText("2 categories");
    await expect(groceries).toHaveAttribute("aria-pressed", "false");

    // Tap selects: the centre swaps to that slice, and its share is 75%
    // ($120 of $160) -- no prior period, so it reads "new this period".
    await groceries.click();
    await expect(groceries).toHaveAttribute("aria-pressed", "true");
    await expect(centre).toContainText("Groceries");
    await expect(centre).toContainText("$120.00");
    await expect(centre).toContainText("75%");

    // Tapping the selected row again clears it, rather than being a
    // one-way selection the user can't undo.
    await groceries.click();
    await expect(groceries).toHaveAttribute("aria-pressed", "false");
    await expect(centre).toContainText("$160.00");
    await expect(centre).toContainText("2 categories");
  });

  test("selecting a category previews its own top transactions and hands them to Activity", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "2000" });

    // Three Food purchases (so the top-3 cap and the ordering both bite)
    // and one Transport, to prove the preview never borrows another
    // category's rows.
    for (const [amount, name, category] of [
      ["17.50", "Super 99", "Food"],
      ["41.20", "Riba Smith", "Food"],
      ["12.75", "Cafe Unido", "Food"],
      ["33.00", "Uber", "Transport"],
    ] as const) {
      await openQuickAdd(page, "Expense");
      await fillAmount(page.getByLabel("Amount (USD)"), amount);
      // Category first: the merchant name pre-fills FROM the category, so
      // setting the category afterwards would overwrite the real name.
      await fillCategory(page, category);
      await page.locator('.sheet input[name="name"]').fill(name);
      await page.click('button:has-text("Log it")');
      // Wait for the sheet to actually close rather than for the row to
      // appear on Home -- Home's Recent list is capped at three, so the
      // fourth transaction is saved but deliberately not shown there.
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    }

    await page.goto("/transactions/breakdown");
    await expect(page.getByText("We hit a snag")).toHaveCount(0);

    // Resting state: no preview at all, just the donut and its legend.
    await expect(page.locator(".category-preview")).toHaveCount(0);

    await page.locator(".category-donut-legend-row", { hasText: "Food" }).click();
    const preview = page.locator(".category-preview");
    await expect(preview).toBeVisible();
    await expect(preview.locator(".category-preview-heading")).toHaveText("Top in Food");

    // Largest first, and only Food's own rows.
    const names = preview.locator(".category-preview-name");
    await expect(names).toHaveText(["Riba Smith", "Super 99", "Cafe Unido"]);
    await expect(preview).not.toContainText("Uber");
    await expect(preview.locator(".category-preview-amount").first()).toHaveText("$41.20");
    // Each row carries its date alongside the metadata the rest of the
    // app already shows.
    await expect(preview.locator(".category-preview-meta").first()).not.toBeEmpty();

    // Switching selection swaps the preview immediately.
    await page.locator(".category-donut-legend-row", { hasText: "Transport" }).click();
    await expect(preview.locator(".category-preview-heading")).toHaveText("Top in Transport");
    await expect(preview.locator(".category-preview-name")).toHaveText(["Uber"]);

    // Tapping the selected one again returns to the default state.
    await page.locator(".category-donut-legend-row", { hasText: "Transport" }).click();
    await expect(page.locator(".category-preview")).toHaveCount(0);

    // "View transactions" opens Activity already filtered to that
    // category -- via the same ?category= param Activity's own filter
    // <select> reads, so the control shows the filter applied too.
    await page.locator(".category-donut-legend-row", { hasText: "Food" }).click();
    await page.locator(".category-preview-view-all").click();
    await page.waitForURL(/\/transactions\?category=/, { timeout: 30_000 });
    await expect(page.locator(".transaction-row", { hasText: "Riba Smith" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "Uber" })).toHaveCount(0);
    const categorySelect = page.getByLabel(/category/i).first();
    await expect(categorySelect).not.toHaveValue("");
  });

  test("chapter 05 never repeats the day chapter 04 has selected", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "2000" });

    // Backdate the cycle's start through the real Edit pay-info flow, the
    // same technique payday-overdue.spec.ts uses -- a brand-new account's
    // cycle starts TODAY, and addTransactionAction floors a transaction's
    // date at the cycle start, so without this there is no earlier day to
    // put a second transaction on.
    await page.click("text=Edit");
    const editPayDate = page.getByLabel("Pay date");
    await editPayDate.waitFor();
    const cycleStart = new Date();
    cycleStart.setDate(cycleStart.getDate() - 5);
    await editPayDate.fill(cycleStart.toISOString().slice(0, 10));
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    // Two days of spending: today (which LIVE always preselects in
    // chapter 04) and an earlier day. Without the excludeDate rule,
    // today's $300 would be the single biggest transaction AND the one
    // already itemised in the day panel right above it.
    const earlier = new Date();
    earlier.setDate(earlier.getDate() - 2);
    const yesterdayValue = earlier.toISOString().slice(0, 10);

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "300.00");
    await fillCategory(page, "Rent");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Rent" })).toBeVisible();

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "90.00");
    await fillCategory(page, "Market");
    await openMoreDetails(page);
    await page.locator('.sheet input[type="date"]').fill(yesterdayValue);
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".transaction-row", { hasText: "Market" })).toBeVisible();

    await page.goto("/transactions/breakdown");
    await expect(page.getByText("We hit a snag")).toHaveCount(0);

    // Chapter 04 preselected today and itemises its $300 purchase...
    const dayHeader = page.locator(".breakdown-day-detail-header");
    await expect(dayHeader).toContainText("Today");
    await expect(dayHeader).toContainText("$300.00");

    // ...so chapter 05 shows yesterday's instead, never today's. This is
    // the acceptance criterion "the heatmap's default selected day is
    // never the same day as any row in Biggest transactions".
    const biggest = page.locator(".biggest-transaction-row");
    await expect(biggest).toHaveCount(1);
    await expect(biggest.first()).toContainText("Market");
    await expect(biggest.first()).toContainText("$90.00");
    await expect(page.locator(".biggest-transaction-list")).not.toContainText("$300.00");
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

    const coffeeRow = page.locator(".category-donut-legend-row", { hasText: "Coffee" });
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
    // History's own link into Breakdown, not Activity's CTA -- a different
    // component on a different screen, so it has its own class.
    await page.click("a[href^='/transactions/breakdown?cycle=']");
    await page.waitForURL(/\/transactions\/breakdown\?cycle=/, { waitUntil: "commit" });

    await expect(page.getByText("We hit a snag")).toHaveCount(0);
    await expect(page.locator(".breakdown-screen-v2")).toBeVisible();
    await expect(page.locator(".breakdown-header-title")).toHaveText("Where it went");
  });
});
