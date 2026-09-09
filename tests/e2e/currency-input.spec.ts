import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/**
 * Regression cover for a money-corrupting bug in CurrencyInput.
 *
 * It accumulates cents by re-parsing every digit in the field on each
 * keystroke, and depends on `onFocus -> select()` to make typing replace
 * rather than splice. But onFocus fires only on the focus TRANSITION, so on
 * any sheet whose amount field carries autoFocus the field is already
 * focused by the time the user taps it: no focus event, no select(), and
 * the tap drops a caret mid-value. Digits typed there get folded into the
 * number -- tapping the untouched "0.00" one character in and typing
 * 1-5-0-0-0 produced $10,050.00 instead of $150.00, and a goal contribution
 * of $150 took Safe-to-spend to -$9,050.
 *
 * These type the way a person actually does on a phone -- tap the field
 * FIRST, then type -- which is what the other specs' fillAmount helper also
 * does, but here it's the point of the test rather than incidental.
 */
test.describe("CurrencyInput on an autoFocused sheet", () => {
  test("tapping the amount field before typing does not multiply the amount", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Emergency Fund");
    await page.locator("#goal-lifetime").click();
    await page.locator("#goal-lifetime").pressSequentially("300000", { delay: 30 });
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    const goalRow = page.locator(".goal-row", { hasText: "Emergency Fund" });
    // The goal's own target went through the same input on the same sheet.
    await expect(goalRow.getByText("$0.00 of $3,000.00")).toBeVisible();

    await goalRow.locator('button:has-text("Contribute")').click();
    const amount = page.getByLabel("Amount (USD)");
    await amount.waitFor();
    // Tap first, then type -- the gesture that used to corrupt the value.
    await amount.click();
    await amount.pressSequentially("15000", { delay: 30 });
    // What's on screen must already be right, before anything is submitted.
    await expect(amount).toHaveValue("150.00");

    await page.locator(".sheet").getByRole("button", { name: "Contribute", exact: true }).click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$150.00 of $3,000.00")).toBeVisible();

    // And the money actually left this cycle's spendable balance, once.
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$850.00");
  });

  test("tapping a pre-filled amount replaces it rather than appending to it", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    // Edit pay info opens with the existing amount already in the field --
    // the case where splice-vs-replace changes the result even when the
    // caret lands at the very end.
    await page.goto("/dashboard");
    await page.click('button:has-text("Edit")');
    const amount = page.getByLabel(/Net pay/);
    await amount.waitFor();
    await expect(amount).toHaveValue("1,000.00");

    await amount.click();
    await amount.pressSequentially("120000", { delay: 30 });
    await expect(amount).toHaveValue("1,200.00");
  });
});
