import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test.describe("closing a quincena", () => {
  test("'I just got paid' closes the cycle, shows a summary, and starts a fresh one", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");

    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector('button:has-text("Yes, I got paid")');
    await page.click('button:has-text("Yes, I got paid")');

    // The closed-cycle summary overlay.
    await expect(page.getByText("Quincena closed")).toBeVisible();
    await expect(page.getByText("Spent")).toBeVisible();
    await page.click('button:has-text("Continue")');

    // Back on Home, in a fresh cycle with the same recurring income
    // carried forward and a full runway again. Not asserting the exact day
    // count here — a brand-new cycle starting *today* is 13-16 days
    // depending on where today falls in the calendar (see
    // lib/quincena-pace.ts's quincenaLengthDays), by design, so hardcoding
    // "15" would make this test fail on whatever days it isn't 15.
    await expect(page.getByText("Quincena closed")).toHaveCount(0);
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");
    await expect(page.locator(".hero-pace")).toContainText(/\d+ days? left/);
  });
});
