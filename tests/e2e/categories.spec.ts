import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

/** Clicks a sheet's submit button by its exact visible text — every sheet in this app follows this convention, and several buttons across sheets share text ("Save", "Cancel"), so this scopes to whichever sheet is currently open. */
async function clickSheetButton(page: import("@playwright/test").Page, text: string) {
  await page.locator(".sheet").getByRole("button", { name: text, exact: true }).click();
}

test.describe("managing categories", () => {
  test("merging two categories moves the source's transactions and removes it from the list", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    // Two categories that should have ended up as one (a typo'd duplicate).
    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("15.00");
    await fillCategory(page, "Dining");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("22.00");
    await fillCategory(page, "Dinning"); // the typo being merged away
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/profile/categories");
    const sourceRow = page.locator(".category-row", { hasText: "Dinning" });
    await expect(sourceRow).toHaveCount(1);

    await sourceRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    const mergeTarget = page.getByLabel("Merge into");
    await mergeTarget.waitFor();
    await mergeTarget.selectOption({ label: "Dining" });
    await page.click('button:has-text("Continue")');
    await expect(page.getByText("Merge Dinning into Dining?")).toBeVisible();
    await clickSheetButton(page, "Merge categories");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-row-name", { hasText: /^Dinning$/ })).toHaveCount(0);
    await expect(page.locator(".category-row-name", { hasText: /^Dining$/ })).toHaveCount(1);

    // Both transactions now live under the surviving category.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "-$15.00" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "-$22.00" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "Dining" })).toHaveCount(2);
  });

  test("typing an existing category's name in a different case reuses it instead of creating a duplicate", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("50.00");
    await fillCategory(page, "Rent");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Second entry, category typed lowercase.
    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("5.00");
    await page.click('.category-chip:has-text("Other")');
    await page.fill('input[placeholder="Category name"]', "rent");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/profile/categories");
    // Exactly one row whose own name is "Rent" -- not two ("Rent" and
    // "rent"). The exact regex avoids "Rent" also matching inside some
    // other unrelated category's longer name.
    await expect(page.locator(".category-row-name", { hasText: /^Rent$/ })).toHaveCount(1);
    await expect(page.locator(".category-row-name", { hasText: /^rent$/ })).toHaveCount(0);
  });

  test("creating a category through the icon picker saves and renders that icon", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.goto("/profile/categories");
    await page.click('button[aria-label="Add category"]');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();
    await categoryNameField.fill("Pet Supplies");

    await page.click('button[aria-label="Choose an icon"]');
    await page.waitForSelector('input[aria-label="Search icons"]');
    await page.fill('input[aria-label="Search icons"]', "dog");
    await page.waitForSelector('.icon-picker-item[aria-label="Dog"]');
    await page.click('.icon-picker-item[aria-label="Dog"]');

    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Never used yet (no transaction logged against it), so it correctly
    // lands in the collapsed Unused section rather than the active list.
    await page.click(".category-unused-toggle");
    const row = page.locator(".category-row", { hasText: "Pet Supplies" });
    await expect(row).toBeVisible();
    // The icon persists after a full reload -- not just client state.
    await page.reload();
    await page.click(".category-unused-toggle");
    await expect(
      page.locator(".category-row", { hasText: "Pet Supplies" }).locator(".category-row-swatch svg"),
    ).toBeVisible();
  });

  test("editing a category's name and icon preserves its existing transactions", async ({ page }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("42.00");
    await fillCategory(page, "Groceries");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/profile/categories");
    const row = page.locator(".category-row", { hasText: "Groceries" });
    await row.locator(".category-row-kebab").click();
    await page.click('button:has-text("Edit")');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();
    await categoryNameField.fill("Food & Dining");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-row-name", { hasText: "Food & Dining" })).toBeVisible();
    await expect(page.locator(".category-row-name", { hasText: /^Groceries$/ })).toHaveCount(0);

    // The transaction itself is untouched -- same amount, now filed under
    // the renamed category, not orphaned or duplicated.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "-$42.00" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "Food & Dining" })).toHaveCount(1);
  });

  test("deleting an unused category removes it with no further consequence", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.goto("/profile/categories");
    await page.click('button[aria-label="Add category"]');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();
    await categoryNameField.fill("Never Used");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-unused-toggle")).toContainText("Unused categories · 1");
    await page.click(".category-unused-toggle");
    const row = page.locator(".category-row", { hasText: "Never Used" });
    await row.locator(".category-row-kebab").click();
    await page.click('button:has-text("Delete")');
    await page.waitForSelector('button:has-text("Delete category")');
    // No transactions/budget history exist for it -- the lighter confirmation copy.
    await expect(page.getByText(/no transactions or budget history/)).toBeVisible();
    await clickSheetButton(page, "Delete category");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-row-name", { hasText: "Never Used" })).toHaveCount(0);
  });

  test("deleting a used category leaves its transaction intact as Uncategorized", async ({ page }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("18.00");
    await fillCategory(page, "Streaming");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/profile/categories");
    const row = page.locator(".category-row", { hasText: "Streaming" });
    await row.locator(".category-row-kebab").click();
    await page.click('button:has-text("Delete")');
    await page.waitForSelector('button:has-text("Delete category")');
    await expect(page.getByText(/will become Uncategorized/)).toBeVisible();
    await clickSheetButton(page, "Delete category");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-row-name", { hasText: "Streaming" })).toHaveCount(0);

    // The transaction itself was never deleted -- it just lost its category.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "-$18.00" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "Uncategorized" })).toBeVisible();
  });

  test("deleting a category with closed-cycle recurring-expense history is blocked, not silently destroyed", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/budget");
    await page.waitForSelector(".dashboard-section");
    try {
      await page.locator(".sheet-backdrop").waitFor({ state: "visible", timeout: 3000 });
      await page.click('button:has-text("Got it")');
      await page.waitForSelector(".sheet-backdrop", { state: "detached" });
    } catch {
      // Never showed.
    }
    await page.click('button:has-text("+ New recurring expense")');
    const recurringNameField = page.getByLabel("Name");
    await recurringNameField.waitFor();
    await recurringNameField.fill("Spotify");
    await page.getByLabel("Amount (USD)").fill("9.99");
    await page.getByLabel("Category").fill("Subscriptions");
    await page.click('.sheet button[type="submit"]');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Close a cycle so "Subscriptions" has real closed-cycle history.
    await page.goto("/dashboard");
    await page.waitForSelector(".dashboard-section");
    await page.click('button:has-text("I just got paid")');
    await page.getByLabel("When did you get paid?").waitFor();
    await page.click('button:has-text("Yes, I got paid")');
    await expect(page.getByText("Quincena closed")).toBeVisible();
    await page.click('button:has-text("Continue")');

    await page.goto("/profile/categories");
    const row = page.locator(".category-row", { hasText: "Subscriptions" });
    await row.locator(".category-row-kebab").click();
    await page.click('button:has-text("Delete")');
    await page.waitForSelector('button:has-text("Delete category")');
    await clickSheetButton(page, "Delete category");

    await expect(page.getByText(/recurring-expense history from past quincenas/)).toBeVisible();
    // Blocked -- the category is still there.
    await expect(page.locator(".sheet-backdrop")).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator(".category-row-name", { hasText: "Subscriptions" })).toBeVisible();
  });

  test("possible duplicates are surfaced for review, and Review opens a prefilled merge that requires confirmation", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("20.00");
    await fillCategory(page, "Gift");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/profile/categories");
    await page.click('button[aria-label="Add category"]');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();
    await categoryNameField.fill("Gifts");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-cleanup")).toBeVisible();
    await expect(page.locator(".category-cleanup")).toContainText("Gift + Gifts");

    await page.click(".category-cleanup-review");
    // Opens straight into the confirmation step (both sides already
    // chosen), not the source/target picker -- but it still requires an
    // explicit tap to actually merge; nothing merges automatically. "Gifts"
    // (0 transactions, just created) merges into "Gift" (1 transaction) --
    // the lower-usage side defaults as the source, the more-established
    // one as the target.
    await expect(page.getByText(/Merge Gifts into Gift\?/)).toBeVisible();
    // Cancel at the confirmation step backs up to the source/target picker
    // (still open) rather than fully dismissing -- same "cancel returns to
    // the editable step" convention this app's other confirm-then-commit
    // flows use (e.g. EditGoalSheet's saved-amount confirmation). The
    // picker's own Cancel is what actually closes the sheet.
    await clickSheetButton(page, "Cancel");
    await expect(page.getByLabel("Merge into")).toBeVisible();
    await clickSheetButton(page, "Cancel");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Declining the review leaves both categories exactly as they were --
    // "Gift" (used) stays in the active list, "Gifts" (unused) stays under
    // the collapsed Unused section.
    await expect(page.locator(".category-row-name", { hasText: /^Gift$/ })).toHaveCount(1);
    await page.click(".category-unused-toggle");
    await expect(page.locator(".category-row-name", { hasText: /^Gifts$/ })).toHaveCount(1);
  });

  test("search filters the category list instantly", async ({ page }) => {
    await signUpAndOnboard(page);

    for (const name of ["Groceries", "Gas", "Gym"]) {
      await page.goto("/profile/categories");
      await page.click('button[aria-label="Add category"]');
      const categoryNameField = page.getByLabel("Category name");
      await categoryNameField.waitFor();
      await categoryNameField.fill(name);
      await clickSheetButton(page, "Save");
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    }

    await page.fill('input[aria-label="Search categories"]', "ga");
    await expect(page.locator(".category-row-name", { hasText: /^Groceries$/ })).toHaveCount(0);
    await expect(page.locator(".category-row-name", { hasText: /^Gas$/ })).toHaveCount(1);
    await expect(page.locator(".category-row-name", { hasText: /^Gym$/ })).toHaveCount(0);
  });

  test("category rows stay on a single line without overlap at a narrow mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await signUpAndOnboard(page);

    await page.goto("/profile/categories");
    await page.click('button[aria-label="Add category"]');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();
    await categoryNameField.fill("A Fairly Long Category Name For Testing");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Never used yet, so it's in the collapsed Unused section.
    await page.click(".category-unused-toggle");
    const row = page.locator(".category-row", { hasText: "A Fairly Long Category Name" });
    const nameBox = await row.locator(".category-row-name").boundingBox();
    const kebabBox = await row.locator(".category-row-kebab").boundingBox();
    expect(nameBox).not.toBeNull();
    expect(kebabBox).not.toBeNull();
    // The name never overlaps the "•••" button -- it truncates (ellipsis)
    // instead, and the row itself stays a single line (fixed row height).
    expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(kebabBox!.x + 1);
  });

  test("the action buttons sit above the category list, not below it", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.goto("/profile/categories");
    await page.click('button[aria-label="Add category"]');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();
    await categoryNameField.fill("Whatever");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    const actionsRow = page.locator(".category-section-header");
    await expect(actionsRow).toBeVisible();
    const actionsBox = await actionsRow.boundingBox();
    // "Whatever" has no transactions/budget goal, so it's in the collapsed
    // Unused section -- expand it to get a real row to compare against.
    await page.click(".category-unused-toggle");
    const rowBox = await page.locator(".category-row", { hasText: "Whatever" }).boundingBox();
    expect(actionsBox).not.toBeNull();
    expect(rowBox).not.toBeNull();
    expect(actionsBox!.y).toBeLessThan(rowBox!.y);
  });

  test("editing an income category supports name and icon, identically to expense", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.goto("/profile/categories/income");
    const row = page.locator(".category-row", { hasText: "Salary" });
    await row.locator(".category-row-kebab").click();
    // Income's menu offers the same three actions as Expense's, not a
    // reduced "Rename" option.
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await page.click('button:has-text("Edit")');
    const categoryNameField = page.getByLabel("Category name");
    await categoryNameField.waitFor();

    await categoryNameField.fill("Paycheck");
    await page.click('button[aria-label="Choose an icon"]');
    await page.waitForSelector('input[aria-label="Search icons"]');
    await page.fill('input[aria-label="Search icons"]', "dog");
    await page.waitForSelector('.icon-picker-item[aria-label="Dog"]');
    await page.click('.icon-picker-item[aria-label="Dog"]');
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    const renamed = page.locator(".category-row", { hasText: "Paycheck" });
    await expect(renamed).toBeVisible();
    await expect(renamed.locator(".category-row-swatch svg")).toBeVisible();
    await expect(page.locator(".category-row-name", { hasText: /^Salary$/ })).toHaveCount(0);

    // Persists after reload -- a real stored field, not client-only state.
    await page.reload();
    await expect(page.locator(".category-row", { hasText: "Paycheck" }).locator(".category-row-swatch svg")).toBeVisible();
  });

  test("deleting an income category works the same way as expense, with a consistent confirmation", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await page.goto("/profile/categories/income");
    const row = page.locator(".category-row", { hasText: "Side work" });
    await row.locator(".category-row-kebab").click();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    await page.click('button:has-text("Delete")');
    await page.waitForSelector('button:has-text("Delete category")');
    await expect(page.getByText(/no transactions or budget history/)).toBeVisible();
    await clickSheetButton(page, "Delete category");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".category-row-name", { hasText: /^Side work$/ })).toHaveCount(0);
  });
});
