import { test, expect } from "@playwright/test";
import { signUpAndOnboard, fillAmount } from "./helpers";

/**
 * The acceptance-criteria scenario for the pay-frequency/budget-frequency
 * split: a MONTHLY-budget account with twice-monthly (or biweekly) real
 * pay must accumulate multiple paychecks into ONE monthly cycle instead
 * of the cycle resetting on every "I just got paid" tap, and closing the
 * month must never ask for a paycheck amount (income was already logged
 * per-paycheck). No calendar backdating needed here, unlike
 * payday-overdue.spec.ts -- MONTHLY rollover is manual-only by design
 * (no auto-detected nudge), so "Close this month" is always available
 * without faking the clock.
 */
test.describe("MONTHLY budget cadence", () => {
  test("two logged paychecks sum into one still-open cycle, and closing the month never asks for a paycheck amount", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { budgetFrequency: "MONTHLY", netQuincenaAmount: "800" });

    // Both explicit actions are always visible -- no auto-surfaced overdue
    // banner for MONTHLY (manual-only rollover, per the product decision).
    await expect(page.locator(".hero-action-link", { hasText: "I just got paid" })).toBeVisible();
    await expect(page.locator(".hero-action-link", { hasText: "Close this month" })).toBeVisible();
    await expect(page.locator(".banner--action")).toHaveCount(0);

    // Log a second $800 paycheck via "I just got paid" -- additive, never closes.
    await page.locator(".hero-action-link", { hasText: "I just got paid" }).click();
    await expect(page.getByText("Log a paycheck")).toBeVisible();
    await fillAmount(page.locator(".sheet input[type=\"text\"]").first(), "800");
    await page.click('button:has-text("Log paycheck")');
    // Waits for the full unmount (not just the text disappearing mid-
    // transition), same pattern goals.spec.ts already uses after a
    // mutation -- LogPaycheckSheet's onDone fires router.refresh() only
    // once it unmounts, and MonthlyIncomeEntriesButton's own `entries`
    // prop is only as fresh as Header.tsx's last completed server
    // render, not something the sheet re-fetches on its own when
    // opened -- networkidle below gives that refresh's round trip a
    // chance to actually land before "Edit" is tapped again, the same
    // gap a real user's natural pause between actions would avoid.
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Still the same open cycle -- both actions still there, nothing closed.
    await expect(page.locator(".hero-action-link", { hasText: "I just got paid" })).toBeVisible();
    await expect(page.locator(".hero-action-link", { hasText: "Close this month" })).toBeVisible();

    // The "Edit" pill now opens the per-entry list (MonthlyIncomeEntriesSheet)
    // instead of the single amount/date form -- confirm both paychecks
    // are there as two separate, editable entries.
    await page.click('button:has-text("Edit")');
    await expect(page.getByText("This month's paychecks")).toBeVisible();
    await expect(page.getByText("$800.00")).toHaveCount(2);
    await page.click('button:has-text("Close")');

    // Close the month -- reuses the same date-step sheet as QUINCENAL's
    // "I just got paid", but with "Close this month" copy, and skips the
    // income-confirm step entirely afterward.
    await page.locator(".hero-action-link", { hasText: "Close this month" }).click();
    await expect(page.getByText("Close this month?")).toBeVisible();
    await page.click('button:has-text("Yes, close this month")');

    await expect(page.getByText("Month closed")).toBeVisible();
    // No "How much did you get paid?" prompt for MONTHLY -- dismissing the
    // closed-cycle summary goes straight back to the dashboard.
    await page.click('button:has-text("Continue")');
    await expect(page.getByText("How much did you get paid?")).toHaveCount(0);
    // Same router.refresh()-lands-async gap as after logging a paycheck
    // above -- give it a chance to complete before re-opening "Edit".
    await page.waitForLoadState("networkidle");

    // The new month starts at $0 income -- not seeded from the last
    // logged paycheck amount (that would double-count once real
    // paychecks get logged into it).
    await page.click('button:has-text("Edit")');
    await expect(page.getByText("No paychecks logged yet this month.")).toBeVisible();
  });
});
