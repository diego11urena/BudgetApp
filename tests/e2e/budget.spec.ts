import { test, expect, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/** Clicks a sheet's submit button by its exact visible text, scoped to whichever sheet is currently open — same convention as categories.spec.ts. */
async function clickSheetButton(page: Page, text: string) {
  await page.locator(".sheet").getByRole("button", { name: text, exact: true }).click();
}

/** Dismisses the auto-shown explainer tooltip if it appears -- waitFor (not a synchronous isVisible check) since it opens via a useEffect + rAF a beat after mount. */
async function dismissHintIfShown(page: Page) {
  try {
    await page.locator(".sheet-backdrop").waitFor({ state: "visible", timeout: 3000 });
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
  } catch {
    // Never showed -- nothing to dismiss.
  }
}

async function createRecurringExpense(
  page: Page,
  opts: { name: string; amount: string; category: string },
) {
  await page.click('button:has-text("+ New recurring expense")');
  await page.waitForSelector("#recurring-expense-name");
  await page.fill("#recurring-expense-name", opts.name);
  await page.fill("#recurring-expense-amount", opts.amount);
  await page.fill("#recurring-expense-category", opts.category);
  await clickSheetButton(page, "Save");
  await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
}

test.describe("Recurring Expenses screen", () => {
  test("has a page <h1> matching every other tab, and the card header shows the cycle's date range instead of repeating it", async ({
    page,
  }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");
    await page.waitForSelector(".dashboard-section");
    await dismissHintIfShown(page);

    // Matches Goals/History/Transactions/Profile's own <h1 className="page-title">.
    await expect(page.locator("h1.page-title")).toHaveText("Recurring Expenses");
    // The card header itself renders the cycle's own date range, not a
    // second/third repeat of the page title.
    await expect(page.locator(".dashboard-section h2")).not.toHaveText(/Recurring [Ee]xpenses/);
  });

  test("the explainer tooltip auto-shows once, then only on tap", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/budget");

    // First-ever visit: auto-shown with no interaction.
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await expect(page.getByText(/Each category can hold several recurring expenses/)).toBeVisible();
    await clickSheetButton(page, "Got it");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Reload: does not auto-show a second time.
    await page.reload();
    await page.waitForSelector(".dashboard-section");
    await page.waitForTimeout(500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    // Tap-to-reopen still works after the one-time auto-show is spent.
    await page.click('button[aria-label="What are recurring expenses?"]');
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await expect(page.getByText(/Each category can hold several recurring expenses/)).toBeVisible();
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

  test("creating a category through its first recurring expense, then adding a second, sums into one category aggregate", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);

    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });
    await expect(page.locator(".category-progress-row")).toHaveCount(1);
    // Collapsed by default -- no child rows visible yet.
    await expect(page.locator(".recurring-expense-row")).toHaveCount(0);

    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });
    // Still exactly one category row (same category, not a duplicate).
    await expect(page.locator(".category-progress-row")).toHaveCount(1);
    await expect(page.locator(".category-progress-row-content")).toContainText("$25.98");

    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2);
    await expect(page.locator(".recurring-expense-row-name")).toHaveText(["Spotify", "Netflix"]);

    // Collapses again on a second tap of the summary.
    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-row")).toHaveCount(0);
  });

  test("recording a payment marks a recurring expense Paid and updates the category's own aggregate spend", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-status--not-started")).toBeVisible();

    await page.click('button:has-text("Record payment")');
    await page.waitForSelector("#record-payment-amount");
    await clickSheetButton(page, "Record payment");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".recurring-expense-status--paid")).toBeVisible();
    await expect(page.locator(".recurring-expense-status-amount")).toHaveText("$9.99 / $9.99");
    // The category-level bar reflects real spend now too.
    await expect(page.locator(".category-progress-row-content")).toContainText("$9.99 / $9.99");
  });

  test("a recurring expense spent exactly to its target renders green (paid), not the category-level warning color", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    await createRecurringExpense(page, { name: "Gym", amount: "20.00", category: "Fitness" });

    // Record payment, not a raw QuickAdd transaction -- since the P1.1 fix,
    // the category-level bar only counts spend actually linked to a
    // recurring expense, not every transaction posted to the category.
    await page.click(".category-progress-row-summary");
    await page.click('button:has-text("Record payment")');
    await page.waitForSelector("#record-payment-amount");
    await page.click('.sheet button[type="submit"]');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".progress-bar-label", { hasText: "100%" })).toBeVisible();
    const color = await page
      .locator(".progress-bar-fill")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    // --color-success, not --color-warning/--color-error.
    expect(color).toBe("rgb(31, 138, 92)");
  });

  test("editing a recurring expense's amount updates the category aggregate", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.click(".category-progress-row-summary");
    await page.click(".recurring-expense-row-main");
    await page.waitForSelector("#recurring-expense-name");
    await expect(page.locator("#recurring-expense-name")).toHaveValue("Spotify");
    await page.fill("#recurring-expense-amount", "12.99");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-progress-row-content")).toContainText("$12.99");
    await expect(page.locator(".recurring-expense-row-amount")).toHaveText("$12.99");
  });

  test("deleting a recurring expense recomputes the category aggregate, with Undo", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });

    await page.click(".category-progress-row-summary");
    const netflixRow = page.locator(".recurring-expense-row", { hasText: "Netflix" });
    await netflixRow.locator(".recurring-expense-row-main").click();
    await page.waitForSelector("#recurring-expense-name");
    await page.click('button:has-text("Delete")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
    await expect(page.locator(".category-progress-row-content")).toContainText("$9.99");
    await expect(page.locator(".toast", { hasText: "Deleted" })).toBeVisible();

    await page.click(".toast-action");
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2, { timeout: 15_000 });
    await expect(page.locator(".category-progress-row-content")).toContainText("$25.98");
  });

  test("closing a quincena carries a recurring expense forward and freezes a historical snapshot on History", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.goto("/dashboard");
    await page.waitForSelector(".dashboard-section");
    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector("#pay-date");
    await page.click('button:has-text("Yes, I got paid")');
    await expect(page.getByText("Quincena closed")).toBeVisible();
    await page.click('button:has-text("Continue")');

    // The new active cycle carried the recurring expense forward.
    await page.goto("/budget");
    await page.waitForSelector(".category-progress-row");
    await expect(page.locator(".category-progress-row-content")).toContainText("$9.99");

    // The closed cycle's History page shows the same historical snapshot,
    // read-only.
    await page.goto("/history");
    await page.click(".preview-box .line-item >> nth=0");
    await page.waitForSelector(".hero-card");
    await expect(page.getByRole("heading", { name: "Recurring expenses", exact: true })).toBeVisible();
    await expect(page.locator(".category-progress-row")).toHaveCount(1);

    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-row-name")).toHaveText("Spotify");
    await expect(page.locator("button:has-text('Record payment')")).toHaveCount(0);

    // Read-only: tapping the child row doesn't open an edit sheet.
    await page.click(".recurring-expense-row-main");
    await page.waitForTimeout(500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
  });
});

test.describe("merging categories moves their recurring expenses", () => {
  test("merging two EXPENSE categories combines their recurring expenses under the target", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Streaming" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });

    await page.goto("/profile/categories");
    const streamingRow = page.locator(".category-row", { hasText: "Streaming" });
    await streamingRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    await page.waitForSelector("#merge-target");
    await page.selectOption("#merge-target", { label: "Subscriptions" });
    await page.click('button:has-text("Continue")');
    await expect(page.getByText("Merge Streaming into Subscriptions?")).toBeVisible();
    await page.locator(".sheet").getByRole("button", { name: "Merge categories", exact: true }).click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/budget");
    await page.waitForSelector(".category-progress-row");
    // Exactly one category row left (Streaming merged away), holding both
    // recurring expenses, aggregate summed.
    await expect(page.locator(".category-progress-row")).toHaveCount(1);
    await expect(page.locator(".category-progress-row-content")).toContainText("$25.98");
    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2);
  });

  test("merging categories that both have a same-named recurring expense consolidates it instead of duplicating", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await dismissHintIfShown(page);
    // Both categories have a "Netflix" line -- a realistic collision.
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Streaming" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });
    await createRecurringExpense(page, { name: "Hulu", amount: "7.99", category: "Streaming" });

    await page.goto("/profile/categories");
    const streamingRow = page.locator(".category-row", { hasText: "Streaming" });
    await streamingRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    await page.waitForSelector("#merge-target");
    await page.selectOption("#merge-target", { label: "Subscriptions" });
    await page.click('button:has-text("Continue")');
    await page.locator(".sheet").getByRole("button", { name: "Merge categories", exact: true }).click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/budget");
    await page.waitForSelector(".category-progress-row");
    await page.click(".category-progress-row-summary");
    // Netflix consolidated into one row (not duplicated), Hulu moved over
    // alongside it -- three recurring expenses total would mean the merge
    // failed to dedupe.
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2);
    await expect(page.locator(".recurring-expense-row-name", { hasText: /^Netflix$/ })).toHaveCount(1);
    await expect(page.locator(".recurring-expense-row-name", { hasText: /^Hulu$/ })).toHaveCount(1);
    // Both sides had a current-cycle snapshot for "Netflix", so they sum
    // (same "sum instead of drop" rule the rest of this merge uses) rather
    // than one silently overwriting the other: $15.99 + $15.99 + $7.99.
    await expect(page.locator(".recurring-expense-row-amount")).toHaveText(["$31.98", "$7.99"]);
    await expect(page.locator(".category-progress-row-content")).toContainText("$39.97");
  });
});
