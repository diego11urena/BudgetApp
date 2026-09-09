import { test, expect } from "@playwright/test";
import { signUpAndOnboard, dismissCycleSummary } from "./helpers";

/**
 * Coverage for the pay-frequency/budget-frequency simplification: the old
 * standalone BIWEEKLY pay-frequency value was removed (collapsed into
 * SEMIMONTHLY, labeled "Biweekly" in English / "Quincenal" in Spanish --
 * see periodVocab's own doc comment for why English uses "paycheck"/
 * "biweekly" and Spanish keeps "quincena"/"quincenal"), and Monthly pay +
 * Quincenal/Biweekly budget is no longer a selectable combination -- only
 * Monthly+Monthly, Biweekly+Biweekly, and Biweekly+Monthly are supported.
 * Biweekly+Biweekly and Biweekly+Monthly are already covered by
 * quincena.spec.ts and monthly-budget.spec.ts respectively; this file
 * covers the combination lock itself and the third supported combination,
 * Monthly+Monthly.
 *
 * Both the pay-frequency picker's "twice a month" option and the
 * budget-frequency picker's cadence option now literally say "Biweekly"
 * in English (same underlying word, two different pickers) -- every
 * locator below stays scoped to its own picker's aria-labelled group so
 * the two never collide under Playwright's strict mode.
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

    const payGroup = page.getByRole("group", { name: "How often do you get paid?" });
    const budgetGroup = page.getByRole("group", { name: "How do you want to budget?" });
    const biweeklyBudgetButton = budgetGroup.locator("button", { hasText: "Biweekly" });

    // Default is Biweekly pay -- both budget options selectable, Biweekly
    // budget is the default and not disabled.
    await expect(biweeklyBudgetButton).toBeEnabled();
    await expect(payGroup.locator("button", { hasText: "Once a month" })).toBeVisible();
    await expect(payGroup.locator("button", { hasText: "Biweekly" })).toBeVisible();

    // Switching pay frequency to "Once a month" force-selects Monthly
    // budget and disables Biweekly -- not just visually unclickable, but
    // actually disabled (a real click can't select it).
    await payGroup.locator("button", { hasText: "Once a month" }).click();
    await expect(budgetGroup.locator("button", { hasText: "Monthly" })).toHaveClass(/is-active/);
    await expect(biweeklyBudgetButton).toBeDisabled();
    await expect(page.getByText("Since you're paid once a month, your budget cycle is monthly too.")).toBeVisible();

    // Switching back to Biweekly pay re-enables Biweekly budget (doesn't
    // force it back on its own -- Monthly budget stays selected until the
    // user picks otherwise).
    await payGroup.locator("button", { hasText: "Biweekly" }).click();
    await expect(biweeklyBudgetButton).toBeEnabled();
  });

  test("Monthly pay + Monthly budget: one paycheck belongs to the cycle, closed separately", async ({ page }) => {
    await signUpAndOnboard(page, { payFrequency: "MONTHLY", netQuincenaAmount: "2400" });

    // MONTHLY budget's two-explicit-action UI (same as the Biweekly-pay +
    // Monthly-budget case in monthly-budget.spec.ts) -- proves budgetFrequency
    // really was forced to MONTHLY server-side, not just in the picker.
    await expect(page.locator(".hero-action-link", { hasText: "I just got paid" })).toBeVisible();
    await expect(page.locator(".hero-action-link", { hasText: "Close this month" })).toBeVisible();

    // The one paycheck from onboarding is already this cycle's income --
    // close the month without logging anything further.
    await page.click('button:has-text("Edit")');
    // Scoped to the sheet itself (role="dialog", aria-labelledby its own
    // title) -- an unscoped page.getByText("$2,400.00") also matches the
    // HeroCard's big number and the StatGrid income tile behind it, both
    // showing the same amount.
    const paychecksSheet = page.getByLabel("This month's paychecks");
    await expect(paychecksSheet).toBeVisible();
    await expect(paychecksSheet.getByText("$2,400.00")).toBeVisible();
    await page.click('button:has-text("Close")');

    await page.locator(".hero-action-link", { hasText: "Close this month" }).click();
    await expect(page.getByText("Close this month?")).toBeVisible();
    await page.click('button:has-text("Yes, close this month")');
    await dismissCycleSummary(page);
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

    await expect(budgetGroup.locator("button", { hasText: "Biweekly" })).toHaveClass(/is-active/);

    await payGroup.locator("button", { hasText: "Once a month" }).click();
    await expect(budgetGroup.locator("button", { hasText: "Monthly" })).toHaveClass(/is-active/);
    await expect(budgetGroup.locator("button", { hasText: "Biweekly" })).toBeDisabled();

    // Survives a reload -- proves the server actually persisted the forced
    // budgetFrequency, not just this component's own optimistic state.
    await page.reload();
    await expect(budgetGroup.locator("button", { hasText: "Monthly" })).toHaveClass(/is-active/);
    await expect(budgetGroup.locator("button", { hasText: "Biweekly" })).toBeDisabled();
  });
});
