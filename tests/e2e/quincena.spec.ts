import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test.describe("closing a quincena", () => {
  test("'I just got paid' closes the cycle, lands on Summary, and starts a fresh one", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");

    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector('button:has-text("Yes, I got paid")');
    await page.click('button:has-text("Yes, I got paid")');

    // The redesign replaced the old CycleClosedCard overlay with a real
    // Summary page for the cycle that just closed -- see
    // app/(app)/dashboard/summary/[cycleId]/page.tsx and the closedCycleId
    // that justGotPaidAction now returns for exactly this navigation.
    await page.waitForURL(/\/dashboard\/summary\/[a-z0-9]+/, { timeout: 60_000, waitUntil: "commit" });
    await expect(page.locator(".summary-screen")).toBeVisible();
    await expect(page.locator(".summary-stat-row")).toContainText("Spent");

    // "Start next paycheck" takes them back to Home, in a fresh cycle with
    // the same recurring income carried forward and a full runway again.
    // Not asserting the exact day count -- a brand-new cycle starting
    // *today* is 13-16 days depending on where today falls in the calendar
    // (see lib/quincena-pace.ts's quincenaLengthDays), by design, so
    // hardcoding "15" would fail on whatever days it isn't 15.
    await page.click(".summary-cta-primary");
    await page.waitForURL(/\/dashboard/, { timeout: 60_000, waitUntil: "commit" });
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");
    await expect(page.locator(".hero-elapsed-label")).toContainText(/\d+ days? left/);
  });
});
