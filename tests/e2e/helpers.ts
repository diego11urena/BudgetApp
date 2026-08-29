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
 * Fills CategoryNameInput's category field — a chip for an existing
 * category with an exact name match, or typing directly into its always-
 * visible text input for a brand-new one (no separate "Other…" chip to
 * click first; CategoryNameInput's combobox accepts free text as-is).
 *
 * The free-text path leaves the "+ Create new" suggestion dropdown open
 * (it only closes on an explicit selection or Escape) — dismiss it with
 * Escape before returning so it doesn't visually cover whatever's
 * immediately below the category field (QuickAddSheet's Merchant/name
 * field sits right underneath it).
 */
export async function fillCategory(page: Page, name: string): Promise<void> {
  const chip = page.locator(".category-chip", { hasText: new RegExp(`^${name}$`) });
  if (await chip.count()) {
    await chip.click();
    return;
  }
  const input = page.locator('input[placeholder="Category name"]');
  await input.fill(name);
  await input.press("Escape");
}
