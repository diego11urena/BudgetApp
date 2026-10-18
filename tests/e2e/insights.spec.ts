import { test, expect } from "@playwright/test";
import { fillAmount, seed, signUpAndOnboard } from "./helpers";

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

test.describe("Duplicate charge prompt", () => {
  async function setUp(page: import("@playwright/test").Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({
      email,
      cycleStartDaysAgo: 3,
      transactions: [
        { name: "McDonald's", amount: 5.49, daysAgo: 1, category: "Food", importSource: "GMAIL" },
        { name: "McDonald's", amount: 5.49, daysAgo: 0, category: "Food", importSource: "GMAIL" },
      ],
    });
    await page.goto("/dashboard");
    const insight = page.locator(".insights-row", { hasText: "Is one a duplicate?" });
    await expect(insight).toBeVisible();
    await insight.locator("a").click();
    await page.waitForURL(/\/transactions\?.*prompt=duplicate/);
    await expect(page.locator(".transaction-row.is-highlighted")).toHaveCount(2);
    await expect(page.getByRole("dialog", { name: "Is this a duplicate?" })).toBeVisible();
  }

  test("Yes, remove one: pick a charge, confirm, it's deleted with Undo, and the insight goes away", async ({ page }) => {
    await setUp(page);
    await page.getByRole("button", { name: "Yes, remove one" }).click();
    const pick = page.getByRole("dialog", { name: "Which one should go?" });
    await expect(pick.getByRole("button")).toHaveText([/· \$5\.49/, /· \$5\.49/, "Cancel"]);
    await pick.getByRole("button").first().click();
    await page.getByRole("dialog", { name: "Delete this charge?" }).getByRole("button", { name: "Delete charge" }).click();

    await expect(page.locator(".toast", { hasText: "Deleted" })).toBeVisible();
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(1);

    // Undo brings it back.
    await page.click(".toast-action");
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(2);

    // Delete again and leave it deleted: the card moves on.
    await page.goto("/dashboard");
    await page.locator(".insights-row", { hasText: "Is one a duplicate?" }).locator("a").click();
    await page.getByRole("button", { name: "Yes, remove one" }).click();
    await page.getByRole("dialog", { name: "Which one should go?" }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Delete charge" }).click();
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(1);
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "duplicate" })).toHaveCount(0);
  });

  test("No, both are real: the pair is never flagged again", async ({ page }) => {
    await setUp(page);
    await page.getByRole("button", { name: "No, both are real" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".transaction-row", { hasText: "McDonald's" })).toHaveCount(2);
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "duplicate" })).toHaveCount(0);
  });

  test("Decide later: closes the sheet and keeps the insight", async ({ page }) => {
    await setUp(page);
    await page.getByRole("button", { name: "Decide later" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "Is one a duplicate?" })).toBeVisible();
  });
});

type Page = import("@playwright/test").Page;

/** Day of the month `offset` days from today, Panama time. */
function panamaDay(offset: number): number {
  return Number(new Date(Date.now() + offset * 86_400_000).toLocaleString("en-US", { timeZone: "America/Panama", day: "numeric" }));
}

/** Taps the insight whose text matches, and waits for its prompt sheet. */
async function openInsight(page: Page, text: string | RegExp, dialogName: string) {
  await page.goto("/dashboard");
  const insight = page.locator(".insights-row", { hasText: text });
  await expect(insight).toBeVisible();
  await insight.locator("a").click();
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function expectInsightGone(page: Page, text: string | RegExp) {
  await page.goto("/dashboard");
  await expect(page.locator(".insights-card")).toBeVisible();
  await expect(page.locator(".insights-row", { hasText: text })).toHaveCount(0);
}

test.describe("Needs a category prompt", () => {
  test("opens the Finish these transactions sheet directly", async ({ page }) => {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({ email, transactions: [{ name: "Mystery shop", amount: 12 }] });
    await openInsight(page, "1 transaction needs a category", "Finish these transactions");
  });
});

test.describe("Expected charge missing prompt", () => {
  async function setUp(page: Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({ email, cycleStartDaysAgo: 5, recurring: [{ name: "Spotify", amount: 0.99, dueDay: panamaDay(-2) }] });
    return openInsight(page, "hasn't shown up yet", "Spotify hasn't shown up");
  }

  test("Mark as paid logs the charge and clears the insight", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Mark as paid" }).click();
    await expect(page.locator(".toast", { hasText: "Marked Spotify as paid" })).toBeVisible();
    await expect(page.locator(".recurring-expense-row--paid", { hasText: "Spotify" })).toBeVisible();
    await expectInsightGone(page, "hasn't shown up yet");
  });

  test("Remind me tomorrow hides it for now", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Remind me tomorrow" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectInsightGone(page, "hasn't shown up yet");
  });

  test("Stop tracking this one removes it from Recurring, with Undo", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Stop tracking this one" }).click();
    await expect(page.locator(".toast", { hasText: "Stopped tracking Spotify" })).toBeVisible();
    await expect(page.locator(".recurring-expense-row", { hasText: "Spotify" })).toHaveCount(0);
    await page.click(".toast-action");
    await expect(page.locator(".recurring-expense-row", { hasText: "Spotify" })).toBeVisible();
  });
});

test.describe("Price changed prompt", () => {
  async function setUp(page: Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({
      email,
      recurring: [{ name: "Spotify", amount: 0.99 }],
      transactions: [{ name: "Spotify", amount: 1.19, category: "Spotify", recurring: "Spotify" }],
    });
    return openInsight(page, "Spotify went from $0.99 to $1.19.", "Spotify changed price");
  }

  test("Update recurring amount saves the new price", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Update recurring amount" }).click();
    await expect(page.locator(".recurring-expense-row", { hasText: "Spotify" }).locator(".recurring-expense-row-amount")).toHaveText("$1.19");
    await expectInsightGone(page, "went from");
  });

  test("Keep the old amount leaves it and clears the insight", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Keep the old amount" }).click();
    await expect(page.locator(".recurring-expense-row", { hasText: "Spotify" }).locator(".recurring-expense-row-amount")).toHaveText("$0.99");
    await expectInsightGone(page, "went from");
  });
});

test.describe("Unusually large purchase prompt", () => {
  async function setUp(page: Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({
      email,
      closedCycles: [
        {
          startDaysAgo: 20,
          endDaysAgo: 1,
          income: 1000,
          transactions: [40, 60, 50].map((amount, i) => ({ name: "Cables", amount, daysAgo: 10 + i, category: "Electronics" })),
        },
      ],
      transactions: [{ name: "Best Buy", amount: 480, category: "Electronics" }],
    });
    const dialog = await openInsight(page, "far above your usual Electronics purchase", "Is this a one-time purchase?");
    await expect(page.locator(".transaction-row.is-highlighted", { hasText: "Best Buy" })).toBeVisible();
    return dialog;
  }

  for (const button of ["One-time", "Normal for me"]) {
    test(`${button} clears the insight`, async ({ page }) => {
      const dialog = await setUp(page);
      await dialog.getByRole("button", { name: button }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expectInsightGone(page, "far above");
    });
  }
});

test.describe("New recurring suspected prompt", () => {
  async function setUp(page: Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({
      email,
      closedCycles: [
        { startDaysAgo: 40, endDaysAgo: 1, income: 1000, transactions: [{ name: "Netflix", amount: 12.99, daysAgo: 30, category: "Streaming" }] },
      ],
      transactions: [{ name: "Netflix", amount: 12.99, category: "Streaming" }],
    });
    return openInsight(page, "keeps coming back", "Is this a recurring expense?");
  }

  test("Add to Recurring makes it a recurring expense", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Add to Recurring" }).click();
    await expect(page.locator(".toast", { hasText: "Added Netflix to Recurring" })).toBeVisible();
    await page.goto("/plan");
    await expect(page.locator(".recurring-expense-row", { hasText: "Netflix" })).toBeVisible();
    await expectInsightGone(page, "keeps coming back");
  });

  test("Not recurring is remembered", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Not recurring" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectInsightGone(page, "keeps coming back");
  });
});

test.describe("Category up prompt", () => {
  async function setUp(page: Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    seed({
      email,
      closedCycles: [{ startDaysAgo: 20, endDaysAgo: 1, income: 1000, transactions: [{ name: "Super", amount: 200, daysAgo: 10, category: "Groceries" }] }],
      transactions: [{ name: "Super", amount: 150, category: "Groceries" }],
    });
    return openInsight(page, "Groceries spending is up", "Groceries is above usual");
  }

  test("Dismiss for this cycle clears it", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Dismiss for this cycle" }).click();
    await expectInsightGone(page, "Groceries spending is up");
  });

  test("Not now keeps it", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Not now" }).click();
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "Groceries spending is up" })).toBeVisible();
  });
});

test.describe("Leftover prompt", () => {
  async function setUp(page: Page) {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.fill("#goal-name", "Emergency Fund");
    await fillAmount(page.locator("#goal-lifetime"), "3000");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
    // Near the end of the cycle, $900 spent.
    seed({ email, cycleStartDaysAgo: 13, transactions: [{ name: "Rent", amount: 900, category: "Housing" }] });
    return openInsight(page, "You have $100.00 left. Move it to a goal?", "Move it to a goal?");
  }

  test("Move to goal logs a contribution with the goal picked", async ({ page }) => {
    const dialog = await setUp(page);
    await expect(dialog.getByLabel("Goal")).toHaveValue("Emergency Fund");
    await dialog.getByRole("button", { name: "Move to goal" }).click();
    await expect(page.locator(".toast", { hasText: "Moved $100.00 to Emergency Fund" })).toBeVisible();
    await expect(page.locator(".goal-row", { hasText: "Emergency Fund" }).getByText("$100.00 of $3,000.00")).toBeVisible();
    await expectInsightGone(page, "Move it to a goal?");
  });

  test("Not now keeps it", async ({ page }) => {
    const dialog = await setUp(page);
    await dialog.getByRole("button", { name: "Not now" }).click();
    await page.goto("/dashboard");
    await expect(page.locator(".insights-row", { hasText: "Move it to a goal?" })).toBeVisible();
  });
});

test.describe("Cycle closed under budget prompt", () => {
  test("Move to goal logs the leftover in the closed cycle, not this one", async ({ page }) => {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.fill("#goal-name", "Emergency Fund");
    await fillAmount(page.locator("#goal-lifetime"), "3000");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
    seed({
      email,
      closedCycles: [{ startDaysAgo: 20, endDaysAgo: 1, income: 1000, transactions: [{ name: "Rent", amount: 700, daysAgo: 10, category: "Housing" }] }],
    });

    const insight = page.locator(".insights-row", { hasText: "You finished last cycle with $300.00 left." });
    await page.goto("/dashboard");
    await expect(insight.locator(".insights-dot--positive")).toBeVisible();
    const dialog = await openInsight(page, "You finished last cycle with $300.00 left.", "Move it to a goal?");
    await dialog.getByRole("button", { name: "Move to goal" }).click();
    await expect(page.locator(".toast", { hasText: "Moved $300.00 to Emergency Fund" })).toBeVisible();
    await expect(page.locator(".goal-row", { hasText: "Emergency Fund" }).getByText("$300.00 of $3,000.00")).toBeVisible();

    await expectInsightGone(page, "You finished last cycle");
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");
  });
});
