import type { Page } from "@playwright/test";

/**
 * Signs up a brand-new user (unique email so parallel test runs never
 * collide) and clicks through onboarding with minimal input, landing on
 * Dashboard. Every spec in this suite starts from here rather than sharing
 * a seeded fixture user — an assertion failing in one test can never be
 * caused by state a different test left behind.
 *
 * waitUntil: "commit" throughout (not the default "load") — Turbopack's
 * first-time compile of a route can take several seconds locally, well
 * past when the navigation itself has already committed and the page is
 * interactive; waiting for full "load" flakes on exactly that gap.
 */
export async function signUpAndOnboard(
  page: Page,
  opts: { netQuincenaAmount?: string } = {},
): Promise<{ email: string }> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto("/signup");
  await page.fill('input[name="name"]', "E2E Tester");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/onboarding\/income/, { timeout: 60_000, waitUntil: "commit" });

  await page.fill('input[name="netQuincenaAmount"]', opts.netQuincenaAmount ?? "1000");
  await page.click('button[type="submit"]');
  await page.waitForURL(/onboarding\/expenses/, { timeout: 60_000, waitUntil: "commit" });

  await page.click('button:has-text("Continue")');
  await page.waitForURL(/dashboard/, { timeout: 60_000, waitUntil: "commit" });

  return { email };
}

/** Opens the bottom-nav "+" and picks one of the three quick-add types. */
export async function openQuickAdd(
  page: Page,
  type: "Expense" | "Income" | "Savings",
): Promise<void> {
  await page.locator(".bottom-nav-fab").click();
  await page.getByLabel("Amount (USD)").waitFor();
  // The FAB always opens straight into EXPENSE -- switch via the sheet's
  // own segmented type toggle for the other two.
  if (type !== "Expense") {
    const label = type === "Income" ? "Extra income" : "Savings";
    await page.locator(".type-toggle-btn", { hasText: label }).click();
  }
}

/**
 * Expands QuickAddSheet's "More details" disclosure (date, the bill
 * toggle, note) -- collapsed by default on create (amount, merchant,
 * category, and payment method alone cover most entries), already
 * expanded when editing an existing transaction. Safe to call either
 * way: a no-op if the fields are already visible.
 */
export async function openMoreDetails(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: "More details" });
  if (await toggle.count()) {
    await toggle.click();
  }
}

/**
 * Fills QuickAddSheet's category field — selects an existing category by
 * its exact name from the native <select>, or picks "+ New category…"
 * (revealing a free-text input) and types a brand-new one. An exact-string
 * check against the dropdown's own option labels, not a fuzzy one: typing
 * a different casing of a category that already exists (e.g. "rent" when
 * "Rent" is already a real option) deliberately falls through to the
 * free-text path too, since that's exactly how a categories.spec.ts test
 * exercises the server's own case-insensitive dedup on submit.
 */
export async function fillCategory(page: Page, name: string): Promise<void> {
  const select = page.getByLabel("Category");
  const optionLabels = await select.locator("option").allTextContents();
  if (optionLabels.includes(name)) {
    await select.selectOption({ label: name });
    return;
  }
  await select.selectOption({ label: "+ New category…" });
  await page.fill('input[placeholder="New category name"]', name);
}
