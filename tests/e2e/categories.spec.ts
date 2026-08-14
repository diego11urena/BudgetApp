import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

test.describe("managing categories", () => {
  test("merging two categories moves the source's transactions and removes it from the list", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    // Two categories that should have ended up as one (a typo'd duplicate).
    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "15.00");
    await fillCategory(page, "Dining");
    await page.click('button:has-text("Log it")');
    await page.waitForTimeout(500);

    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "22.00");
    await fillCategory(page, "Dinning"); // the typo being merged away
    await page.click('button:has-text("Log it")');
    await page.waitForTimeout(500);

    // Signup seeds a handful of default Income categories alongside these
    // two Expense ones, so the row count itself isn't a useful assertion
    // here -- check the specific rows we care about instead.
    await page.goto("/profile/categories");
    const rows = page.locator(".category-manage-row");
    const sourceRow = rows.filter({ has: page.locator('input[value="Dinning"]') });
    await expect(sourceRow).toHaveCount(1);

    await sourceRow.locator("select").selectOption({ label: "Dining" });
    await sourceRow.locator('button:has-text("Merge")').click();
    await sourceRow.locator('button:has-text("Confirm merge")').click();

    await expect(page.locator('.category-manage-row input[value="Dinning"]')).toHaveCount(0);
    await expect(page.locator('.category-manage-row input[value="Dining"]')).toHaveCount(1);

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
    await page.fill("#sheet-amount", "50.00");
    await fillCategory(page, "Rent");
    await page.click('button:has-text("Log it")');
    await page.waitForTimeout(500);

    // Second entry, category typed lowercase.
    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "5.00");
    await page.click('.category-chip:has-text("Other")');
    await page.fill('input[placeholder="Category name"]', "rent");
    await page.click('button:has-text("Log it")');
    await page.waitForTimeout(500);

    await page.goto("/profile/categories");
    // Exactly one row whose own name is "Rent" -- not two ("Rent" and
    // "rent"). Matching on the rename input's *value* (not row text)
    // avoids false matches from every other row's own "Merge into…"
    // dropdown, which lists "Rent" as an option too.
    await expect(page.locator('.category-manage-row input[value="Rent"]')).toHaveCount(1);
    await expect(page.locator('.category-manage-row input[value="rent"]')).toHaveCount(0);
  });
});
