import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/**
 * Coverage for the pay-frequency/budget-frequency simplification: BIWEEKLY
 * removed as a distinct pay-frequency option (collapsed into "Twice a
 * month / Quincenal"), and Monthly pay + Quincenal budget is no longer a
 * selectable combination -- only Monthly+Monthly, Quincenal+Quincenal, and
 * Quincenal+Monthly are supported. Quincenal+Quincenal and Quincenal+Monthly
 * are already covered by quincena.spec.ts and monthly-budget.spec.ts
 * respectively; this file covers the combination lock itself and the third
 * supported combination, Monthly+Monthly.
 */
test.describe("pay/budget frequency combination lock", () => {
  test("onboarding: choosing Once a month pay force-selects and locks Monthly budget", async ({ page }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    await page.context().addCookies([{ name: "balboa-locale", value: "en", url: baseURL }]);

    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.goto("/signup");
    await page.fill('input[name="name"]', "E2E Tester");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/onboarding\/income/, { timeout: 60_000, waitUntil: "commit" });

    // Scoped by each picker's own aria-labelled group -- "Quincenal" is a
    // substring of both the budget picker's own "Quincenal" option AND the
    // pay picker's "Twice a month / Quincenal" option, so an unscoped
    // button locator would match both and fail Playwright's strict mode.
    const payGroup = page.getByRole("group", { name: "How often do you get paid?" });
    const budgetGroup = page.getByRole("group", { name: "How do you want to budget?" });
    const quincenalBudgetButton = budgetGroup.locator("button", { hasText: "Quincenal" });

    // Default is Quincenal (Twice-a-month) pay -- both budget options
    // selectable, Quincenal budget is the default and not disabled.
    await expect(quincenalBudgetButton).toBeEnabled();
    await expect(payGroup.locator("button", { hasText: "Once a month" })).toBeVisible();
    await expect(payGroup.locator("button", { hasText: "Twice a month / Quincenal" })).toBeVisible();
    // No standalone "Biweekly" option anymore.
    await expect(payGroup.locator("button", { hasText: "Biweekly" })).toHaveCount(0);

    // Switching pay frequency to "Once a month" force-selects Monthly
    // budget and disables Quincenal -- not just visually unclickable, but
    // actually disabled (a real click can't select it).
    await payGroup.locator("button", { hasText: "Once a month" }).click();
    await expect(budgetGroup.locator("button", { hasText: "Monthly" })).toHaveClass(/is-active/);
    await expect(quincenalBudgetButton).toBeDisabled();
    await expect(page.getByText("Since you're paid once a month, your budget cycle is monthly too.")).toBeVisible();

    // Switching back to Twice a month re-enables Quincenal budget (doesn't
    // force it back on its own -- Monthly budget stays selected until the
    // user picks otherwise).
    await payGroup.locator("button", { hasText: "Twice a month / Quincenal" }).click();
    await expect(quincenalBudgetButton).toBeEnabled();
  });

  test("Monthly pay + Monthly budget: one paycheck belongs to the cycle, closed separately", async ({ page }) => {
    await signUpAndOnboard(page, { payFrequency: "MONTHLY", netQuincenaAmount: "2400" });

    // MONTHLY budget's two-explicit-action UI (same as the Quincenal-pay +
    // Monthly-budget case in monthly-budget.spec.ts) -- proves budgetFrequency
    // really was forced to MONTHLY server-side, not just in the picker.
    await expect(page.locator(".hero-action-link", { hasText: "I just got paid" })).toBeVisible();
    await expect(page.locator(".hero-action-link", { hasText: "Close this month" })).toBeVisible();

    // The one paycheck from onboarding is already this cycle's income --
    // close the month without logging anything further.
    await page.click('button:has-text("Edit")');
    await expect(page.getByText("This month's paychecks")).toBeVisible();
    await expect(page.getByText("$2,400.00")).toBeVisible();
    await page.click('button:has-text("Close")');

    await page.locator(".hero-action-link", { hasText: "Close this month" }).click();
    await expect(page.getByText("Close this month?")).toBeVisible();
    await page.click('button:has-text("Yes, close this month")');
    await expect(page.getByText("Month closed")).toBeVisible();
    await page.click('button:has-text("Continue")');
    await page.waitForLoadState("networkidle");

    // The new month starts at $0 -- not reseeded from the closed cycle's
    // paycheck (that would double-count once a real paycheck gets logged).
    await page.click('button:has-text("Edit")');
    await expect(page.getByText("No paychecks logged yet this month.")).toBeVisible();
  });

  test("Settings: switching pay frequency to Once a month force-locks budget frequency to Monthly", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "800" });

    await page.goto("/profile");
    const budgetGroup = page.getByRole("group", { name: "Budget frequency" });
    const payGroup = page.getByRole("group", { name: "Pay frequency" });

    await expect(budgetGroup.locator("button", { hasText: "Quincenal" })).toHaveClass(/is-active/);

    await payGroup.locator("button", { hasText: "Once a month" }).click();
    await expect(budgetGroup.locator("button", { hasText: "Monthly" })).toHaveClass(/is-active/);
    await expect(budgetGroup.locator("button", { hasText: "Quincenal" })).toBeDisabled();

    // Survives a reload -- proves the server actually persisted the forced
    // budgetFrequency, not just this component's own optimistic state.
    await page.reload();
    await expect(budgetGroup.locator("button", { hasText: "Monthly" })).toHaveClass(/is-active/);
    await expect(budgetGroup.locator("button", { hasText: "Quincenal" })).toBeDisabled();
  });
});
