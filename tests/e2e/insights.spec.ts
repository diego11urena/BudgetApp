import { test, expect } from "@playwright/test";
import { seed, signUpAndOnboard } from "./helpers";

test.describe("Insights card", () => {
  test("dismissing an insight hides it, and it stays hidden after a reload", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/dashboard");

    // A new account always has the pace insight.
    const onTrack = page.locator(".insights-row", { hasText: "sustainable pace" });
    await expect(onTrack).toBeVisible();
    await onTrack.getByRole("button", { name: "Dismiss" }).click();
    await expect(onTrack).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".insights-row", { hasText: "sustainable pace" })).toHaveCount(0);
  });
});

test.describe("Duplicate charge prompt", () => {
  async function setUp(page: import("@playwright/test").Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({
      email,
      cycleStartDaysAgo: 3,
      transactions: [
        { name: "McDonald's", amount: 5.49, daysAgo: 1, category: "Food", importSource: "GMAIL" },
        { name: "McDonald's", amount: 5.49, daysAgo: 0, category: "Food", importSource: "GMAIL" },
      ],
    });
    await page.goto("/dashboard");
    const insight = page.locator(".insights-row", { hasText: "Is one a duplicate?" });
    await expect(insight).toBeVisible();
    await insight.locator("a").click();
    await page.waitForURL(/\/transactions\?.*prompt=duplicate/);
    await expect(page.locator(".transaction-row.is-highlighted")).toHaveCount(2);
    await expect(page.getByRole("dialog", { name: "Is this a duplicate?" })).toBeVisible();
  }

  test("Yes, remove one: pick a charge, confirm, it's deleted with Undo, and the insight goes away", async ({ page }) => {
    await setUp(page);
    await page.getByRole("button", { name: "Yes, remove one" }).click();
    const pick = page.getByRole("dialog", { name: "Which one should go?" });
    await expect(pick.getByRole("button")).toHaveText([/· \$5\.49/, /· \$5\.49/, "Cancel"]);
    await pick.getByRole("button").first().click();
    await page.getByRole("dialog", { name: "Delete this charge?" }).getByRole("button", { name: "Delete charge" }).click();

    await expect(page.locator(".toast", { hasText: "Deleted" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(1);

    // Undo brings it back.
    await page.click(".toast-action");
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(2);

    // Delete again and leave it deleted: the card moves on.
    await page.goto("/dashboard");
    await page.locator(".insights-row", { hasText: "Is one a duplicate?" }).locator("a").click();
    await page.getByRole("button", { name: "Yes, remove one" }).click();
    await page.getByRole("dialog", { name: "Which one should go?" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Delete charge" }).click();
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(1);
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "duplicate" })).toHaveCount(0);
  });

  test("No, both are real: the pair is never flagged again", async ({ page }) => {
    await setUp(page);
    await page.getByRole("button", { name: "No, both are real" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(2);
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "duplicate" })).toHaveCount(0);
  });

  test("Decide later: closes the sheet and keeps the insight", async ({ page }) => {
    await setUp(page);
    await page.getByRole("button", { name: "Decide later" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "Is one a duplicate?" })).toBeVisible();
  });
});
