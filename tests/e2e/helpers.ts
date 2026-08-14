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
  await page.waitForURL(/onboarding\/savings/, { timeout: 60_000, waitUntil: "commit" });

  await page.click('button:has-text("Finish setup")');
  await page.waitForURL(/dashboard/, { timeout: 60_000, waitUntil: "commit" });

  return { email };
}

/** Opens the bottom-nav "+" and picks one of the three quick-add types. */
export async function openQuickAdd(
  page: Page,
  type: "Expense" | "Income" | "Savings",
): Promise<void> {
  await page.locator(".bottom-nav-fab").click();
  await page.click(`button:has-text("Add ${type}")`);
  await page.waitForSelector("#sheet-amount");
}

/**
 * Fills the category field, whichever mode it's currently in — chips (once
 * the user has at least one category) or the free-text/"Other…" input for
 * a brand-new one.
 */
export async function fillCategory(page: Page, name: string): Promise<void> {
  const chip = page.locator(".category-chip", { hasText: new RegExp(`^${name}$`) });
  if (await chip.count()) {
    await chip.click();
    return;
  }
  const otherChip = page.locator('.category-chip:has-text("Other")');
  if (await otherChip.count()) await otherChip.click();
  await page.fill('input[placeholder="Category name"]', name);
}
