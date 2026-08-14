import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test.describe("savings goals", () => {
  test("creating a goal and contributing to it updates saved-so-far and Available to spend", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/goals");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Emergency Fund");
    await page.fill("#goal-lifetime", "3000");
    await page.click('button:has-text("Save goal")');

    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
    const goalRow = page.locator(".goal-row", { hasText: "Emergency Fund" });
    await expect(goalRow).toBeVisible();
    await expect(goalRow.getByText("$0.00 / $3,000.00")).toBeVisible();

    await goalRow.locator('button:has-text("Contribute")').click();
    await page.waitForSelector("#contribute-amount");
    await page.fill("#contribute-amount", "150.00");
    // Scoped to the open sheet specifically -- the goal row's own
    // "Contribute" trigger button is text-identical to the sheet's submit
    // button and would otherwise make this locator ambiguous.
    await page.locator(".sheet").getByRole("button", { name: "Contribute", exact: true }).click();
    // A cold Turbopack compile of the server action on its first hit can
    // run well past the default 5s assertion timeout locally under `next
    // dev` (CI runs against a production build specifically to avoid
    // this) -- wait for the sheet to actually close before asserting on
    // what it should have updated.
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$150.00 / $3,000.00")).toBeVisible();

    // A savings contribution reduces Available to spend, same as an
    // expense would (it's money leaving this quincena's spendable
    // balance), even though it isn't spent.
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$850.00");
  });
});
