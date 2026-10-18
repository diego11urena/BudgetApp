import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

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
