import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

test.describe("logging a transaction", () => {
  test("add, edit, and delete an expense", async ({ page }) => {
    await signUpAndOnboard(page);

    await test.step("add an expense", async () => {
      await openQuickAdd(page, "Expense");
      await page.fill("#sheet-amount", "24.50");
      await fillCategory(page, "Groceries");
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".transaction-row", { hasText: "Groceries" })).toBeVisible();
      await expect(page.locator(".transaction-row", { hasText: "-$24.50" })).toBeVisible();
    });

    await test.step("edit the amount", async () => {
      await page.locator(".transaction-row", { hasText: "Groceries" }).click();
      await page.waitForSelector("#sheet-amount");
      await page.fill("#sheet-amount", "30.00");
      await page.click('button:has-text("Save changes")');
      await expect(page.locator(".transaction-row", { hasText: "-$30.00" })).toBeVisible();
    });

    await test.step("delete it", async () => {
      await page.locator(".transaction-row", { hasText: "Groceries" }).click();
      await page.waitForSelector(".sheet-delete");
      await page.click(".sheet-delete");
      await expect(page.locator(".transaction-row", { hasText: "Groceries" })).toHaveCount(0);
    });
  });

  test("logging a transaction gives a visible confirmation and an Undo", async ({ page }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "10.00");
    await fillCategory(page, "Coffee");
    await page.click('button:has-text("Log it")');

    const undoButton = page.locator(".toast-action");
    await expect(undoButton).toBeVisible();
    await undoButton.click();
    await expect(page.locator(".transaction-row", { hasText: "Coffee" })).toHaveCount(0);
  });
});
