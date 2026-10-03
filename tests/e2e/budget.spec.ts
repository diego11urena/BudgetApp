import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { signUpAndOnboard, openQuickAdd, openMoreDetails, fillCategory, fillAmount, dismissCycleSummary } from "./helpers";

/**
 * Seeds a CycleTransaction with no UI path to reach it -- a missing
 * category only ever happens via Gmail import, the manual Add Transaction
 * form always requires one (see resolveRecurringExpenseName's own doc comment) -- by
 * running lib/prisma.ts in its own tsx process. Same pattern (and same
 * reason it can't just be a direct import) as dashboard-banners.spec.ts's
 * own copy of this helper.
 */
function seedTransaction(payload: { email: string; name: string; amount: number }) {
  execFileSync(
    "npx",
    ["tsx", path.join(__dirname, "seed-transaction.ts"), JSON.stringify(payload)],
    { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" },
  );
}

/** Clicks a sheet's submit button by its exact visible text, scoped to whichever sheet is currently open — same convention as categories.spec.ts. */
async function clickSheetButton(page: Page, text: string) {
  await page.locator(".sheet").getByRole("button", { name: text, exact: true }).click();
}

/** Ongoing by default (no dueDay passed) -- matches EditableRecurringExpense's own default. Pass dueDay to create a Scheduled one instead (checks "Has a set date" and fills the day). */
async function createRecurringExpense(
  page: Page,
  opts: { name: string; amount: string; category: string; dueDay?: string },
) {
  await page.click('button:has-text("+ New")');
  const nameField = page.getByLabel("Name");
  await nameField.waitFor();
  await nameField.fill(opts.name);
  await fillAmount(page.getByLabel("Amount (USD)"), opts.amount);
  await page.getByLabel("Category").fill(opts.category);
  if (opts.dueDay) {
    await page.getByLabel("Has a set date").check();
    await page.getByLabel("Due day (1–31)").fill(opts.dueDay);
  }
  await clickSheetButton(page, "Save");
  await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
}

test.describe("Plan screen (Recurring)", () => {
  test("has a page <h1> of 'Plan', with Recurring and Goals as its two sections", async ({ page }) => {
    await signUpAndOnboard(page);
    await page.goto("/plan");
    await page.waitForSelector(".dashboard-section");

    await expect(page.locator("h1.page-title")).toHaveText("Plan");
    await expect(page.locator(".dashboard-section h2", { hasText: "Recurring" })).toBeVisible();
    await expect(page.locator(".dashboard-section h2", { hasText: "Savings goals" })).toBeVisible();
  });

  test("creating a category through its first recurring expense, then adding a second under the same category, lists both flat with a category label, no folder to expand", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");

    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });
    // Flat by default -- no category-folder wrapper, no expand needed.
    // createRecurringExpense doesn't set a due day (Ongoing default, no
    // due-day field shown), so the meta line is just the category name.
    await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
    await expect(page.locator(".recurring-expense-row-meta")).toHaveText("Subscriptions");

    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2);
    // Alphabetical, not creation order -- both are Ongoing (no due day to
    // rank by), and Ongoing items sort by name (see RecurringSection's own
    // doc comment).
    await expect(page.locator(".recurring-expense-row-name")).toContainText(["Netflix", "Spotify"]);
  });

  test("recording a payment marks a Scheduled recurring expense Paid, and hides Record", async ({ page }) => {
    // Scheduled (a dueDay set), not Ongoing -- Record staying available
    // after settling is Ongoing-specific behavior (there's no target to
    // "finish"), asserted separately; a Scheduled item's own Record really
    // does disappear once paid, which is what this test checks.
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions", dueDay: "1" });

    await expect(page.locator(".recurring-expense-row--paid")).toHaveCount(0);
    await expect(page.locator('button:has-text("Record")')).toBeVisible();

    await page.click('button:has-text("Record")');
    await page.getByLabel("Amount (USD)").waitFor();
    await clickSheetButton(page, "Record payment");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
    await expect(page.locator('button:has-text("Record")')).toHaveCount(0);
  });

  test("recording a payment on an Ongoing expense marks it Logged, but keeps Record available", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    // No dueDay -- Ongoing, an estimated amount with no target to "finish".
    await createRecurringExpense(page, { name: "Panapass", amount: "20.00", category: "Transport" });

    await page.click('button:has-text("Record")');
    await page.getByLabel("Amount (USD)").waitFor();
    await clickSheetButton(page, "Record payment");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    // Logged (settled indicator shows), but Record stays -- a second toll
    // payment mid-cycle is still a real thing to log.
    await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
    await expect(page.locator('button:has-text("Record")')).toBeVisible();
  });

  test("editing a recurring expense's amount is reflected on its own row", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions", dueDay: "1" });

    await page.click(".recurring-expense-row-main");
    const editNameField = page.getByLabel("Name");
    await editNameField.waitFor();
    await expect(editNameField).toHaveValue("Spotify");
    await fillAmount(page.getByLabel("Amount (USD)"), "12.99");
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".recurring-expense-row-amount")).toHaveText("$12.99");
  });

  test("deleting a recurring expense removes it from the flat list, with Undo", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });

    const netflixRow = page.locator(".recurring-expense-row", { hasText: "Netflix" });
    await netflixRow.locator(".recurring-expense-row-main").click();
    await page.getByLabel("Name").waitFor();
    await page.click('button:has-text("Delete")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
    await expect(page.locator(".toast", { hasText: "Deleted" })).toBeVisible();

    await page.click(".toast-action");
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2, { timeout: 15_000 });
  });

  test("unchecking 'Repeats' creates a one-time expense with no due-day field, and it doesn't carry into a new cycle", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");

    await page.click('button:has-text("+ New")');
    await page.getByLabel("Name").fill("Car registration");
    await fillAmount(page.getByLabel("Amount (USD)"), "60.00");
    await page.getByLabel("Category").fill("Car");
    // "Repeats" and "Has a set date" are independent (see
    // EditableRecurringExpense's own doc comment) -- unchecking Repeats
    // alone doesn't touch the due-day field, which is gated by "Has a set
    // date" (unchecked by default) instead.
    await page.getByLabel("Repeats").uncheck();
    await expect(page.getByLabel("Due day (1–31)")).toHaveCount(0);
    await clickSheetButton(page, "Save");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".recurring-expense-row", { hasText: "Car registration" })).toBeVisible();

    await page.goto("/dashboard");
    await page.waitForSelector(".dashboard-section");
    await page.click('button:has-text("I just got paid")');
    await page.getByLabel("When did you get paid?").waitFor();
    await page.click('button:has-text("Yes, I got paid")');
    await dismissCycleSummary(page);

    await page.goto("/plan");
    await page.waitForSelector(".dashboard-section");
    await expect(page.locator(".recurring-expense-row", { hasText: "Car registration" })).toHaveCount(0);
  });

  test("closing a quincena carries a recurring expense forward and freezes a historical snapshot on History", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Subscriptions" });

    await page.goto("/dashboard");
    await page.waitForSelector(".dashboard-section");
    await page.click('button:has-text("I just got paid")');
    await page.getByLabel("When did you get paid?").waitFor();
    await page.click('button:has-text("Yes, I got paid")');
    await dismissCycleSummary(page);

    // The new active cycle carried the recurring expense forward.
    await page.goto("/plan");
    await page.waitForSelector(".recurring-expense-row");
    await expect(page.locator(".recurring-expense-row", { hasText: "Spotify" })).toBeVisible();

    // The closed cycle's History page shows the same historical snapshot,
    // read-only -- History's own per-category breakdown is unchanged (it's
    // not the live Plan screen, so it kept its category-grouped view).
    await page.goto("/history");
    await page.click(".history-list .line-item >> nth=0");
    await page.waitForSelector(".hero-card");
    await expect(page.getByRole("heading", { name: "Recurring", exact: true })).toBeVisible();
    await expect(page.locator(".category-progress-row")).toHaveCount(1);

    await page.click(".category-progress-row-summary");
    await expect(page.locator(".recurring-expense-row-name")).toHaveText("Spotify");
    await expect(page.locator("button:has-text('Record payment')")).toHaveCount(0);

    // Read-only: tapping the child row doesn't open an edit sheet.
    await page.click(".recurring-expense-row-main");
    await page.waitForTimeout(500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
  });
});

test.describe("the 'This is a recurring expense' toggle on a transaction", () => {
  test("toggling on a manual expense creates (or links to) a recurring expense, same-named repeats dedupe, and toggling off unlinks without deleting it", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await test.step("logging an expense with the toggle on creates a new recurring expense showing this transaction's amount as paid", async () => {
      await openQuickAdd(page, "Expense");
      await fillAmount(page.getByLabel("Amount (USD)"), "20.00");
      await fillCategory(page, "Transportation");
      await openMoreDetails(page);
      await page.getByLabel("This is a recurring expense").check();
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      await page.goto("/plan");
      await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
      // Name defaulted to the category ("Transportation") -- untouched, per Feature 1's fallback.
      await expect(page.locator(".recurring-expense-row-name")).toContainText("Transportation");
      await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
    });

    await test.step("a second same-named expense logged with the toggle on links to the SAME recurring expense (summed actual), not a second row", async () => {
      await openQuickAdd(page, "Expense");
      await fillAmount(page.getByLabel("Amount (USD)"), "15.00");
      await fillCategory(page, "Transportation");
      // Name defaults to the category ("Transportation") on both -- an
      // exact, same-name repeat, exactly the dedup case the toggle guards.
      await openMoreDetails(page);
      await page.getByLabel("This is a recurring expense").check();
      await page.click('button:has-text("Log it")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      // Still one row (dedup worked, not a second row) and still paid --
      // Plan's simplified row no longer surfaces the actual-vs-target
      // dollar text itself (that detail lives in the edit sheet now), so
      // the sum itself isn't independently visible here.
      await page.goto("/plan");
      await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
      await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
    });

    await test.step("toggling it off on edit unlinks the payment but leaves the recurring expense itself intact", async () => {
      await page.goto("/transactions");
      // Both transactions share the same name/category ("Transportation") --
      // disambiguate by amount so this always unlinks the $15 one, leaving
      // the $20 one linked (actual == target == $20, a clean "paid" to
      // assert against below).
      await page.locator(".transaction-row", { hasText: "-$15.00" }).click();
      await page.getByLabel("Amount (USD)").waitFor();
      await expect(page.getByLabel("This is a recurring expense")).toBeChecked();
      await page.getByLabel("This is a recurring expense").uncheck();
      await page.click('button:has-text("Save changes")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

      await page.goto("/plan");
      await page.waitForSelector(".recurring-expense-row");
      // Still exists -- just missing that one payment now ($20 left of $35),
      // still exactly at target so still shows as paid.
      await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
      await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
    });
  });

  test("an uncategorized transaction that shares a word with a recurring expense's name still gets suggested (the Claude/Anthropic fix)", async ({
    page,
  }) => {
    const { email } = await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Claude", amount: "20.00", category: "Software" });

    // Simulates a first-time Gmail import: no learned-merchant category yet
    // (see findLearnedCategoryId), and a merchant name that only shares the
    // word "claude" with the recurring expense's own name. Before this fix such a
    // transaction was structurally invisible to matching -- the candidate
    // query excluded anything with no category at all, regardless of name.
    seedTransaction({ email, name: "Anthropic Claude", amount: 20 });

    await page.goto("/plan");
    await expect(page.locator(".recurring-expense-suggestion")).toBeVisible();
    await expect(page.locator(".recurring-expense-suggestion")).toContainText("Anthropic Claude");
    await page.locator(".recurring-expense-suggestion-actions").getByRole("button", { name: "Confirm" }).click();

    // Confirming clears the suggestion and marks the recurring expense paid -- if the
    // confirm action still hard-rejected a null-category transaction (the
    // other half of this bug), the suggestion would still be sitting there
    // after the refresh below.
    await expect(page.locator(".recurring-expense-suggestion")).toHaveCount(0);
    await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
    await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
  });

  test("the 'Which recurring expense?' picker links a differently-named transaction to an existing recurring expense instead of creating a duplicate", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Claude", amount: "20.00", category: "Software" });

    await openQuickAdd(page, "Expense");
    await fillAmount(page.getByLabel("Amount (USD)"), "20.00");
    await page.getByLabel("Merchant / name").fill("Anthropic");
    await fillCategory(page, "Software");
    await openMoreDetails(page);
    await page.getByLabel("This is a recurring expense").check();

    // The exact-name path would create a NEW recurring expense named "Anthropic" here --
    // that's the bug. Search and pick the existing "Claude" recurring expense instead.
    // Scoped to the dropdown itself -- the unscoped role/name alone also
    // matches the "Claude" recurring expense's own row on /plan, still in the DOM behind
    // this sheet.
    await page.getByLabel("Which recurring expense?").fill("cla");
    await page.locator(".recurring-picker-dropdown").getByRole("button", { name: /Claude/ }).click();
    await expect(page.getByLabel("Which recurring expense?")).toHaveValue("Claude");

    await page.click('button:has-text("Log it")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/plan");
    // Still exactly one recurring expense -- no "Anthropic" duplicate -- and it's paid.
    await expect(page.locator(".recurring-expense-row")).toHaveCount(1);
    await expect(page.locator(".recurring-expense-row-name")).toContainText("Claude");
    await expect(page.locator(".recurring-expense-row--paid")).toBeVisible();
  });

  test("the toggle never appears for Income or Savings", async ({ page }) => {
    await signUpAndOnboard(page);

    await openQuickAdd(page, "Income");
    await openMoreDetails(page);
    await expect(page.getByLabel("This is a recurring expense")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await openQuickAdd(page, "Savings");
    await openMoreDetails(page);
    await expect(page.getByLabel("This is a recurring expense")).toHaveCount(0);
  });
});

test.describe("merging categories moves their recurring expenses", () => {
  test("merging two EXPENSE categories combines their recurring expenses under the target", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    await createRecurringExpense(page, { name: "Spotify", amount: "9.99", category: "Streaming" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });

    await page.goto("/profile/categories");
    const streamingRow = page.locator(".category-row", { hasText: "Streaming" });
    await streamingRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    const mergeTarget = page.getByLabel("Merge into");
    await mergeTarget.waitFor();
    await mergeTarget.selectOption({ label: "Subscriptions" });
    await page.click('button:has-text("Continue")');
    await expect(page.getByText("Merge Streaming into Subscriptions?")).toBeVisible();
    await page.locator(".sheet").getByRole("button", { name: "Merge categories", exact: true }).click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/plan");
    await page.waitForSelector(".recurring-expense-row");
    // Both recurring expenses present, now both labeled under the surviving category.
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2);
    await expect(page.locator(".recurring-expense-row-meta", { hasText: "Subscriptions" })).toHaveCount(2);
  });

  test("merging categories that both have a same-named recurring expense consolidates it instead of duplicating", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });
    await page.goto("/plan");
    // Both categories have a "Netflix" line -- a realistic collision.
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Streaming" });
    await createRecurringExpense(page, { name: "Netflix", amount: "15.99", category: "Subscriptions" });
    await createRecurringExpense(page, { name: "Hulu", amount: "7.99", category: "Streaming" });

    await page.goto("/profile/categories");
    const streamingRow = page.locator(".category-row", { hasText: "Streaming" });
    await streamingRow.locator(".category-row-kebab").click();
    await page.click('button:has-text("Merge into…")');
    const mergeTarget = page.getByLabel("Merge into");
    await mergeTarget.waitFor();
    await mergeTarget.selectOption({ label: "Subscriptions" });
    await page.click('button:has-text("Continue")');
    await page.locator(".sheet").getByRole("button", { name: "Merge categories", exact: true }).click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/plan");
    await page.waitForSelector(".recurring-expense-row");
    // Netflix consolidated into one row (not duplicated), Hulu moved over
    // alongside it -- three rows total would mean the merge failed to dedupe.
    await expect(page.locator(".recurring-expense-row")).toHaveCount(2);
    await expect(page.locator(".recurring-expense-row-name", { hasText: /^Netflix/ })).toHaveCount(1);
    await expect(page.locator(".recurring-expense-row-name", { hasText: /^Hulu/ })).toHaveCount(1);
    // Both sides had a current-cycle snapshot for "Netflix", so they sum
    // (same "sum instead of drop" rule the rest of this merge uses) rather
    // than one silently overwriting the other: $15.99 + $15.99, and $7.99.
    // "~" on both -- neither was given a due day, so both are Ongoing
    // (an estimated amount, not an exact target -- see RecurringExpenseRow's
    // own doc comment). Hulu before Netflix: Ongoing items sort
    // alphabetically (see RecurringSection).
    await expect(page.locator(".recurring-expense-row-amount")).toHaveText(["~$7.99", "~$31.98"]);
  });
});
