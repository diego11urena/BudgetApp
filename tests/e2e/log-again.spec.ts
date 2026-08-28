import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

test.describe("'Log again' shortcut", () => {
  test("repeats the most recent transaction's amount/category/merchant, pre-filled but requiring its own submit", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Expense");
    await page.getByLabel("Amount (USD)").fill("4.50");
    await fillCategory(page, "Coffee");
    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/dashboard");
    const logAgain = page.getByRole("button", { name: "Log again: $4.50 · Coffee" });
    await expect(logAgain).toBeVisible();

    await logAgain.click();
    // "More details" auto-expanded (unlike a from-scratch create) so the
    // prefilled merchant name is visible before the user commits to it.
    const amountField = page.getByLabel("Amount (USD)");
    await amountField.waitFor();
    await expect(amountField).toHaveValue("4.50");
    await expect(page.getByLabel("Merchant / name")).toHaveValue("Coffee");

    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Two separate transactions now exist, not one edited in place.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "-$4.50" })).toHaveCount(2);
  });

  test("does not appear for a brand-new user with no transactions yet", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Log again/ })).toHaveCount(0);
  });
});
