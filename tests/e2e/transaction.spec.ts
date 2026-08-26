import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

test.describe("logging a transaction", () => {
  test("add, edit, and delete an expense", async ({ page }) => {
    await signUpAndOnboard(page);

    await test.step("add an expense", async () => {
      await openQuickAdd(page, "Expense");
      await page.getByLabel("Amount (USD)").fill("24.50");
      await fillCategory(page, "Groceries");
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".transaction-row", { hasText: "Groceries" })).toBeVisible();
      await expect(page.locator(".transaction-row", { hasText: "-$24.50" })).toBeVisible();
    });

    await test.step("edit the amount", async () => {
      await page.locator(".transaction-row", { hasText: "Groceries" }).click();
      const amountField = page.getByLabel("Amount (USD)");
      await amountField.waitFor();
      await amountField.fill("30.00");
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
    await page.getByLabel("Amount (USD)").fill("10.00");
    await fillCategory(page, "Coffee");
    await page.click('button:has-text("Log it")');

    const undoButton = page.locator(".toast-action");
    await expect(undoButton).toBeVisible();
    await undoButton.click();
    await expect(page.locator(".transaction-row", { hasText: "Coffee" })).toHaveCount(0);
  });

  test("a merchant name distinct from category is the primary display text, editable after the fact, required but pre-filled from category by default", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await test.step("Name pre-fills live from the category field and is overridable", async () => {
      await openQuickAdd(page, "Expense");
      const nameField = page.getByLabel("Merchant / name");
      await expect(nameField).toHaveValue("");
      await fillCategory(page, "Transportation");
      // fillCategory's "Other…" free-text path -- the untouched Name field
      // tracks it live.
      await expect(nameField).toHaveValue("Transportation");

      await page.getByLabel("Amount (USD)").fill("45.50");
      await nameField.fill("Panapass");
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    });

    await test.step("name is primary text, category is secondary", async () => {
      const row = page.locator(".transaction-row", { hasText: "Panapass" });
      await expect(row.locator(".transaction-name")).toHaveText("Panapass");
      await expect(row.locator(".transaction-sub")).toContainText("Transportation");
    });

    await test.step("editing pre-fills the real name and lets it be corrected, without a category change silently rewriting it", async () => {
      await page.locator(".transaction-row", { hasText: "Panapass" }).click();
      const nameField = page.getByLabel("Merchant / name");
      await nameField.waitFor();
      await expect(nameField).toHaveValue("Panapass");
      await nameField.fill("Panapass - Corredor Norte");
      await page.click('button:has-text("Save changes")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
      await expect(
        page.locator(".transaction-row", { hasText: "Panapass - Corredor Norte" }),
      ).toBeVisible();
    });

    await test.step("leaving the name field untouched still submits fine, falling back to the category", async () => {
      await openQuickAdd(page, "Expense");
      // "Transportation" now exists as a category -- exercises the chip
      // (not free-text) pre-fill path.
      await expect(page.getByLabel("Merchant / name")).toHaveValue("Transportation");
      await page.getByLabel("Amount (USD)").fill("12.00");
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      const untouchedRow = page.locator(".transaction-row", { hasText: "Transportation" }).last();
      await expect(untouchedRow.locator(".transaction-name")).toHaveText("Transportation");
      // Name === category -- no redundant secondary line.
      await expect(untouchedRow.locator(".transaction-sub")).toHaveCount(0);
    });

    await test.step("clearing the name field entirely blocks submit, same as Amount/Category/Date", async () => {
      await openQuickAdd(page, "Expense");
      await page.getByLabel("Amount (USD)").fill("8.00");
      const nameField = page.getByLabel("Merchant / name");
      await expect(nameField).toHaveValue("Transportation");
      await nameField.fill("");
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".error-text")).toHaveText("Enter a merchant or business name");
      await expect(nameField).toHaveClass(/is-invalid/);
      // Never submitted -- sheet stays open.
      await expect(page.locator(".sheet-backdrop")).toBeVisible();
    });
  });
});
