import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

/** Clicks a sheet's submit button by its exact visible text, scoped to whichever sheet is currently open — same convention as categories.spec.ts. */
async function clickSheetButton(page: import("@playwright/test").Page, text: string) {
  await page.locator(".sheet").getByRole("button", { name: text, exact: true }).click();
}

test.describe("Fixed Expenses screen", () => {
  test("has a page <h1> matching every other tab, and the card header shows the cycle's date range instead of repeating it", async ({
    page,
  }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");
    await page.waitForSelector(".dashboard-section");

    // Fresh signup auto-shows the explainer tooltip, whose own dialog title
    // legitimately says "Fixed expenses" -- dismiss it first so this checks
    // the underlying page, not a modal covering it.
    if (await page.locator(".sheet-backdrop").isVisible()) {
      await clickSheetButton(page, "Got it");
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    }

    // Matches Goals/History/Transactions/Profile's own <h1 className="page-title">.
    await expect(page.locator("h1.page-title")).toHaveText("Fixed Expenses");
    // The card header itself renders the cycle's own date range, not a
    // second/third repeat of "Fixed Expenses".
    await expect(page.locator(".dashboard-section h2")).not.toHaveText(/Fixed [Ee]xpenses/);
  });

  test("the explainer tooltip auto-shows once, then only on tap", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");

    // First-ever visit: auto-shown with no interaction.
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await expect(page.getByText(/Recurring fixed expenses carry into every quincena/)).toBeVisible();
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Reload: does not auto-show a second time.
    await page.reload();
    await page.waitForSelector(".dashboard-section");
    await page.waitForTimeout(500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    // Tap-to-reopen still works after the one-time auto-show is spent.
    await page.click('button[aria-label="What are fixed expenses?"]');
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await expect(page.getByText(/Recurring fixed expenses carry into every quincena/)).toBeVisible();
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
  });

  test("the tooltip does not auto-show again for a returning user across a fresh page load", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // A real fresh navigation (not just a client-side re-render) -- the
    // "seen" flag has to be server-persisted, not just component state.
    await page.goto("/dashboard");
    await page.goto("/budget");
    await page.waitForSelector(".dashboard-section");
    await page.waitForTimeout(500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
  });

  test("the fixed-expense creation button has no leading + and sits beside Edit", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.getByRole("button", { name: "New fixed expense", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add fixed expense", exact: true })).toHaveCount(0);
  });

  test("tapping a fixed-expense row opens its transactions, filtered to that category and cycle, with a way back", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.click('button:has-text("New fixed expense")');
    await page.waitForSelector("#budget-name");
    await page.fill("#budget-name", "Panapass");
    await page.fill("#budget-amount", "50");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "50.00");
    await fillCategory(page, "Panapass");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/budget");
    await page.waitForSelector(".budget-goal-row");
    await page.locator(".budget-goal-row-summary-link").click();

    await page.waitForURL(/\/transactions\?.*category=/, { timeout: 10_000 });
    // The category filter (reusing the Transactions tab's own existing
    // dropdown, not a new UI) already reflects the incoming filter.
    await expect(page.locator('select[aria-label="Filter by category"]')).toHaveValue(/.+/);
    await expect(page.locator(".transaction-row", { hasText: "Panapass" })).toBeVisible();

    const backLink = page.locator(".back-link", { hasText: "Back to Fixed Expenses" });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL(/\/budget/, { timeout: 10_000 });
  });

  test("does not offer the row-tap link while in edit mode", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.click('button:has-text("New fixed expense")');
    await page.waitForSelector("#budget-name");
    await page.fill("#budget-name", "Gym");
    await page.fill("#budget-amount", "30");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.click('button:has-text("Edit")');
    await page.waitForSelector(".budget-goal-row-controls");
    await expect(page.locator(".budget-goal-row-summary-link")).toHaveCount(0);
  });

  test("a category spent exactly to its target renders green, not orange", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.click('button:has-text("New fixed expense")');
    await page.waitForSelector("#budget-name");
    await page.fill("#budget-name", "Subscriptions");
    await page.fill("#budget-amount", "20");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "20.00");
    await fillCategory(page, "Subscriptions");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/budget");
    await page.waitForSelector(".budget-goal-row");
    await expect(page.locator(".progress-bar-label", { hasText: "100%" })).toBeVisible();
    const color = await page.locator(".progress-bar-fill").first().evaluate((el) => getComputedStyle(el).backgroundColor);
    // --color-success, not --color-warning/--color-error.
    expect(color).toBe("rgb(31, 138, 92)");
  });
});
