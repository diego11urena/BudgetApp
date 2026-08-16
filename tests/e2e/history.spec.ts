import { test, expect } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, fillCategory } from "./helpers";

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test.describe("past quincenas", () => {
  test("adding a transaction to a closed cycle updates its own totals without touching the active cycle", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "50");
    await fillCategory(page, "Groceries");
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector('button:has-text("Yes, I got paid")');
    await page.click('button:has-text("Yes, I got paid")');
    await expect(page.getByText("Quincena closed")).toBeVisible();
    await page.click('button:has-text("Continue")');

    // Back on Home, in the new active cycle — no expenses logged there yet.
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");

    await page.goto("/history");
    await page.click(".preview-box .line-item >> nth=0");
    await page.waitForSelector(".hero-card");
    await expect(page.locator(".hero-label")).toHaveText("Final available");
    await expect(page.locator(".hero-value")).toHaveText("$950.00");

    // Add a transaction directly into this closed cycle via its own "+".
    await page.click('button:has-text("Add to this quincena")');
    await page.waitForSelector(".quick-actions");
    await page.click('button:has-text("Add Expense")');
    await page.waitForSelector("#sheet-amount");
    await page.fill("#sheet-amount", "25");
    await fillCategory(page, "Groceries");
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    // The closed cycle's own numbers reflect it immediately...
    await expect(page.locator(".hero-value")).toHaveText("$925.00");

    // ...and the active cycle (Home) is completely unaffected.
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");
  });

  test("editing a transaction's date across a quincena boundary asks for confirmation, and only moves it once confirmed", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    // Push the still-open cycle's start back 10 real days via the real
    // "Edit pay info" flow (Home's own affordance for correcting an
    // already-recorded pay date) — not a test backdoor, so this exercises
    // an in-scope feature along the way. Needed because the server's real
    // clock can't be advanced mid-test, and this is the only way to get
    // two quincenas with a genuinely distinct, non-degenerate boundary
    // within a single run. Every date below stays several days clear of
    // "today" on purpose — the client computes "today" from the browser's
    // local clock and the server from Panama's, and a test runner whose
    // own local clock sits in yet another timezone can disagree with both
    // right at a day boundary; multi-day margins make that skew harmless.
    await page.click("text=Edit");
    await page.waitForSelector("#edit-pay-date");
    await page.fill("#edit-pay-date", daysAgoISO(10));
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    await openQuickAdd(page, "Expense");
    await page.fill("#sheet-amount", "40");
    await fillCategory(page, "Coffee");
    await page.fill("#sheet-date", daysAgoISO(8));
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    // Close backdated to 4 days ago (within ConfirmJustGotPaidSheet's own
    // 7-day lookback) -- the closed cycle now spans a real ~6-day range,
    // and the new active cycle starts 4 days ago, a genuinely distinct,
    // comfortably-in-the-past boundary.
    await page.click('button:has-text("I just got paid")');
    await page.waitForSelector("#pay-date");
    await page.fill("#pay-date", daysAgoISO(4));
    await page.click('button:has-text("Yes, I got paid")');
    await expect(page.getByText("Quincena closed")).toBeVisible();
    await page.click('button:has-text("Continue")');

    await page.goto("/history");
    await page.click(".preview-box .line-item >> nth=0");
    await page.waitForSelector(".hero-card");
    await expect(page.locator(".transaction-row")).toHaveCount(1);

    // Move the transaction to 1 day ago -- outside this (closed) cycle,
    // comfortably inside the new active one (which started 4 days ago).
    await page.click(".transaction-row");
    await page.waitForSelector("#sheet-amount");
    const destinationDate = daysAgoISO(1);
    await page.fill("#sheet-date", destinationDate);
    await page.click('.sheet button[type="submit"]');

    await expect(page.locator(".sheet")).toContainText("move this transaction to a different quincena");

    // Cancel -- the date reverts and nothing moves.
    await page.click('.sheet button:has-text("Cancel")');
    await expect(page.locator("#sheet-date")).toHaveValue(daysAgoISO(8));
    await page.keyboard.press("Escape");
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });
    await expect(page.locator(".transaction-row")).toHaveCount(1);

    // Redo it and confirm this time.
    await page.click(".transaction-row");
    await page.waitForSelector("#sheet-amount");
    await page.fill("#sheet-date", destinationDate);
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector('.sheet button:has-text("Continue")');
    await page.click('.sheet button:has-text("Continue")');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    await expect(page.locator(".transaction-row")).toHaveCount(0);

    // It really did move -- the active cycle now shows the $40 expense.
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$960.00");
  });
});
