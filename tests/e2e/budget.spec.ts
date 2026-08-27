import { test, expect, type Page } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

/** Clicks a sheet's submit button by its exact visible text, scoped to whichever sheet is currently open — same convention as categories.spec.ts. */
async function clickSheetButton(page: Page, text: string) {
  await page.locator(".sheet").getByRole("button", { name: text, exact: true }).click();
}

async function createRecurringExpense(
  page: Page,
  opts: { name: string; amount: string; category: string },
) {
  await page.click('button:has-text("+ New recurring expense")');
  const nameField = page.getByLabel("Name");
  await nameField.waitFor();
  await nameField.fill(opts.name);
  await page.getByLabel("Amount (USD)").fill(opts.amount);
  await page.getByLabel("Category").fill(opts.category);
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

    // Matches Goals/History/Transactions/Profile's own <h1 className="page-title">.
    await expect(page.locator("h1.page-title")).toHaveText("Recurring Expenses");
    // The card header itself renders the cycle's own date range, not a
    // second/third repeat of the page title.
    await expect(page.locator(".dashboard-section h2")).not.toHaveText(/Recurring [Ee]xpenses/);
  });

  test("creating a category through its first recurring expense, then adding a second, sums into one category aggregate", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");

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
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-status--not-started")).toBeVisible();

    await page.click('button:has-text("Record payment")');
    await page.getByLabel("Amount (USD)").waitFor();
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
    await createRecurringExpense(page, { name: "Gym", amount: "20.00", category: "Fitness" });

    // Record payment, not a raw QuickAdd transaction -- since the P1.1 fix,
    // the category-level bar only counts spend actually linked to a
    // recurring expense, not every transaction posted to the category.
    await page.click(".category-progress-row-summary");
    await page.click('button:has-text("Record payment")');
    await page.getByLabel("Amount (USD)").waitFor();
    await page.click('.sheet button[type="submit"]');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".progress-bar-label", { hasText: "100%" })).toBeVisible();
    const color = await page
      .locator(".progress-bar-fill")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    // --color-success, not --color-warning/--color-error.
    expect(color).toBe("rgb(26, 117, 78)");
  });

  test("editing a recurring expense's amount updates the category aggregate", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.click(".category-progress-row-summary");
    await page.click(".recurring-expense-row-main");
    const editNameField = page.getByLabel("Name");
    await editNameField.waitFor();
    await expect(editNameField).toHaveValue("Spotify");
    await page.getByLabel("Amount (USD)").fill("12.99");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-progress-row-content")).toContainText("$12.99");
    await expect(page.locator(".recurring-expense-row-amount")).toHaveText("$12.99");
  });

  test("deleting a recurring expense recomputes the category aggregate, with Undo", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });

    await page.click(".category-progress-row-summary");
    const netflixRow = page.locator(".recurring-expense-row", { hasText: "Netflix" });
    await netflixRow.locator(".recurring-expense-row-main").click();
    await page.getByLabel("Name").waitFor();
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
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.goto("/dashboard");
    await page.waitForSelector(".dashboard-section");
    await page.click('button:has-text("I just got paid")');
    await page.getByLabel("When did you get paid?").waitFor();
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

test.describe("the 'This is a recurring expense' toggle on a transaction", () => {
  test("toggling on a manual expense creates (or links to) a recurring expense, same-named repeats dedupe, and toggling off unlinks without deleting it", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await test.step("logging an expense with the toggle on creates a new recurring expense showing this transaction's amount as paid", async () => {
      await openQuickAdd(page, "Expense");
      await page.getByLabel("Amount (USD)").fill("20.00");
      await fillCategory(page, "Transportation");
      await page.getByLabel("This is a recurring expense").check();
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      await page.goto("/budget");
      await expect(page.locator(".category-progress-row-content")).toContainText("Transportation");
      await page.click(".category-progress-row-summary");
      await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
      // Name defaulted to the category ("Transportation") -- untouched, per Feature 1's fallback.
      await expect(page.locator(".recurring-expense-row-name")).toHaveText("Transportation");
      await expect(page.locator(".recurring-expense-status--paid")).toBeVisible();
      await expect(page.locator(".recurring-expense-status-amount")).toHaveText("$20.00 / $20.00");
    });

    await test.step("a second same-named expense logged with the toggle on links to the SAME recurring expense (summed actual), not a second row", async () => {
      await openQuickAdd(page, "Expense");
      await page.getByLabel("Amount (USD)").fill("15.00");
      await fillCategory(page, "Transportation");
      // Name defaults to the category ("Transportation") on both -- an
      // exact, same-name repeat, exactly the dedup case the toggle guards.
      await page.getByLabel("This is a recurring expense").check();
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      await page.goto("/budget");
      await page.click(".category-progress-row-summary");
      await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
      await expect(page.locator(".recurring-expense-status-amount")).toHaveText("$35.00 / $20.00");
    });

    await test.step("toggling it off on edit unlinks the payment but leaves the recurring expense itself intact", async () => {
      await page.goto("/transactions");
      // Both transactions share the same name/category ("Transportation") --
      // disambiguate by amount so this always unlinks the $15 one, leaving
      // the $20 one linked (actual == target == $20, a clean "paid" to
      // assert against below).
      await page.locator(".transaction-row", { hasText: "-$15.00" }).click();
      await page.getByLabel("Amount (USD)").waitFor();
      await expect(page.getByLabel("This is a recurring expense")).toBeChecked();
      await page.getByLabel("This is a recurring expense").uncheck();
      await page.click('button:has-text("Save changes")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      await page.goto("/budget");
      await page.waitForSelector(".category-progress-row");
      // Still exists -- just missing that one payment now ($20 left of $35).
      await page.click(".category-progress-row-summary");
      await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
      await expect(page.locator(".recurring-expense-status-amount")).toHaveText("$20.00 / $20.00");
    });
  });

  test("the toggle never appears for Income or Savings", async ({ page }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Income");
    await expect(page.getByLabel("This is a recurring expense")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await openQuickAdd(page, "Savings");
    await expect(page.getByLabel("This is a recurring expense")).toHaveCount(0);
  });
});

test.describe("merging categories moves their recurring expenses", () => {
  test("merging two EXPENSE categories combines their recurring expenses under the target", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/budget");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Streaming" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });

    await page.goto("/profile/categories");
    const streamingRow = page.locator(".category-row", { hasText: "Streaming" });
    await streamingRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    const mergeTarget = page.getByLabel("Merge into");
    await mergeTarget.waitFor();
    await mergeTarget.selectOption({ label: "Subscriptions" });
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
    // Both categories have a "Netflix" line -- a realistic collision.
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Streaming" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });
    await createRecurringExpense(page, { name: "Hulu", amount: "7.99", category: "Streaming" });

    await page.goto("/profile/categories");
    const streamingRow = page.locator(".category-row", { hasText: "Streaming" });
    await streamingRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    const mergeTarget = page.getByLabel("Merge into");
    await mergeTarget.waitFor();
    await mergeTarget.selectOption({ label: "Subscriptions" });
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
