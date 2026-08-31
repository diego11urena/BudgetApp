import { test, expect } from "@playwright/test";
import { signUpAndOnboard, fillAmount } from "./helpers";

test.describe("savings goals", () => {
  test("creating a goal and contributing to it updates saved-so-far and Safe to spend", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Emergency Fund");
    await fillAmount(page.locator("#goal-lifetime"), "3000");
    await page.click('button:has-text("Save goal")');

    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
    const goalRow = page.locator(".goal-row", { hasText: "Emergency Fund" });
    await expect(goalRow).toBeVisible();
    await expect(goalRow.getByText("$0.00 of $3,000.00")).toBeVisible();

    await goalRow.locator('button:has-text("Contribute")').click();
    const contributeAmount = page.getByLabel("Amount (USD)");
    await contributeAmount.waitFor();
    await fillAmount(contributeAmount, "150.00");
    // Scoped to the open sheet specifically -- the goal row's own
    // "Contribute" trigger button is text-identical to the sheet's submit
    // button and would otherwise make this locator ambiguous.
    await page.locator(".sheet").getByRole("button", { name: "Contribute", exact: true }).click();
    // A cold Turbopack compile of the server action on its first hit can
    // run well past the default 5s assertion timeout locally under `next
    // dev` (CI runs against a production build specifically to avoid
    // this) -- wait for the sheet to actually close before asserting on
    // what it should have updated.
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$150.00 of $3,000.00")).toBeVisible();

    // A savings contribution reduces Safe to spend, same as an
    // expense would (it's money leaving this quincena's spendable
    // balance), even though it isn't spent.
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$850.00");
  });

  test("creating a goal with an opening balance sets saved-so-far without logging a transaction", async ({
    page,
  }) => {
    await signUpAndOnboard(page);

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Vacation");
    await fillAmount(page.locator("#goal-lifetime"), "2000");
    await page.click("text=Do you already have money saved toward this goal?");
    await fillAmount(page.locator("#goal-already-saved"), "450");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    const goalRow = page.locator(".goal-row", { hasText: "Vacation" });
    await expect(goalRow.getByText("$450.00 of $2,000.00")).toBeVisible();

    // An opening balance is a starting point, not a transaction -- it must
    // not appear in the transaction list or affect this cycle's Available
    // to spend (that's real spendable money, unrelated to savings entered
    // before the user started tracking them in this app). Scoped to
    // .transaction-name specifically -- the goal's own name also appears as
    // a plain <option> in the page's "Filter by category" <select>, which
    // a bare getByText would also match even with zero real transactions.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-name", { hasText: "Vacation" })).toHaveCount(0);
  });

  test("editing a goal's saved amount upward can be recorded as a real transaction", async ({ page }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Emergency Fund");
    await fillAmount(page.locator("#goal-lifetime"), "3000");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    const goalRow = page.locator(".goal-row", { hasText: "Emergency Fund" });
    await goalRow.getByRole("button", { name: "Edit" }).click();
    const editGoalSaved = page.getByLabel("Amount saved so far");
    await editGoalSaved.waitFor();
    await fillAmount(editGoalSaved, "200");
    await page.locator(".sheet").getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("You're increasing the amount saved toward this goal by $200.00")).toBeVisible();
    await page.click("text=Yes, record as transaction");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$200.00 of $3,000.00")).toBeVisible();

    // Recording as a transaction means it shows up like any other logged
    // contribution, and reduces Safe to spend the same way Contribute
    // does. Scoped to .transaction-name -- a bare getByText also matches
    // the goal's <option> in the category filter <select>, making the
    // locator ambiguous.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-name", { hasText: "Emergency Fund" })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$800.00");
  });

  test("editing a goal's saved amount upward without a transaction leaves Safe to spend and transaction history untouched", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Pro Futuro");
    await fillAmount(page.locator("#goal-lifetime"), "3000");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    const goalRow = page.locator(".goal-row", { hasText: "Pro Futuro" });
    await goalRow.getByRole("button", { name: "Edit" }).click();
    const editGoalSaved = page.getByLabel("Amount saved so far");
    await editGoalSaved.waitFor();
    await fillAmount(editGoalSaved, "300");
    await page.locator(".sheet").getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("You're increasing the amount saved toward this goal by $300.00")).toBeVisible();
    await page.click("text=No, just update the goal");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$300.00 of $3,000.00")).toBeVisible();

    await page.goto("/transactions");
    await expect(page.locator(".transaction-name", { hasText: "Pro Futuro" })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");
  });

  test("editing a goal's saved amount downward can be recorded as a real withdrawal transaction", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Rainy Day");
    await fillAmount(page.locator("#goal-lifetime"), "1000");
    await page.click("text=Do you already have money saved toward this goal?");
    await fillAmount(page.locator("#goal-already-saved"), "500");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    const goalRow = page.locator(".goal-row", { hasText: "Rainy Day" });
    await goalRow.getByRole("button", { name: "Edit" }).click();
    const editGoalSaved = page.getByLabel("Amount saved so far");
    await editGoalSaved.waitFor();
    await fillAmount(editGoalSaved, "300");
    await page.locator(".sheet").getByRole("button", { name: "Save", exact: true }).click();

    await expect(
      page.getByText("You're decreasing the amount saved toward this goal by $200.00"),
    ).toBeVisible();
    await page.click("text=Yes, record as withdrawal");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$300.00 of $1,000.00")).toBeVisible();

    // A withdrawal shows up like any other transaction, but reads "+" (not
    // "-") -- money is moving back to spendable balance, the opposite
    // direction of a contribution.
    await page.goto("/transactions");
    const withdrawalRow = page.locator(".transaction-row", { hasText: "Rainy Day withdrawal" });
    await expect(withdrawalRow).toBeVisible();
    await expect(withdrawalRow.locator(".transaction-amount")).toHaveText("+$200.00");

    // Safe to spend gains the withdrawn amount back -- the opening
    // balance never touched it (see the sibling test above), so this
    // isolates the withdrawal's own effect.
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$1,200.00");

    // Editing the withdrawal via the normal tap-a-row flow: the Amount
    // field shows a plain positive number (never the raw negative stored
    // value), and re-saving a different amount keeps it a withdrawal --
    // the sign is reapplied server-side from the row's own existing sign,
    // not from anything this form submits.
    await withdrawalRow.click();
    const editAmount = page.getByLabel("Amount (USD)");
    await editAmount.waitFor();
    await expect(editAmount).toHaveValue("200.00");
    await fillAmount(editAmount, "250.00");
    await page.click('button:has-text("Save changes")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });

    await expect(withdrawalRow.locator(".transaction-amount")).toHaveText("+$250.00");
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$1,250.00");

    // Deleting it removes its effect entirely (savedSoFar/Safe to spend
    // are always derived live, never a stored running total -- see
    // lib/goals.ts's computeSavedSoFar), and Undo brings it back exactly,
    // sign included -- clicked immediately, before any navigation away
    // that would lose the toast holding it.
    await page.goto("/transactions");
    await withdrawalRow.click();
    await page.waitForSelector(".sheet-delete");
    await page.click(".sheet-delete");
    await expect(page.locator(".transaction-row", { hasText: "Rainy Day withdrawal" })).toHaveCount(0);

    await page.locator(".toast-action").click();
    await expect(withdrawalRow).toBeVisible();
    await expect(withdrawalRow.locator(".transaction-amount")).toHaveText("+$250.00");
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$1,250.00");
  });

  test("editing a goal's saved amount downward without recording a withdrawal leaves Safe to spend and transaction history untouched", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    await page.goto("/plan");
    await page.click('button:has-text("+ Add goal")');
    await page.waitForSelector("#goal-name");
    await page.fill("#goal-name", "Sunny Day");
    await fillAmount(page.locator("#goal-lifetime"), "1000");
    await page.click("text=Do you already have money saved toward this goal?");
    await fillAmount(page.locator("#goal-already-saved"), "500");
    await page.click('button:has-text("Save goal")');
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    const goalRow = page.locator(".goal-row", { hasText: "Sunny Day" });
    await goalRow.getByRole("button", { name: "Edit" }).click();
    const editGoalSaved = page.getByLabel("Amount saved so far");
    await editGoalSaved.waitFor();
    await fillAmount(editGoalSaved, "300");
    await page.locator(".sheet").getByRole("button", { name: "Save", exact: true }).click();

    await expect(
      page.getByText("You're decreasing the amount saved toward this goal by $200.00"),
    ).toBeVisible();
    await page.click("text=No, just update the goal");
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 30_000 });

    await expect(goalRow.getByText("$300.00 of $1,000.00")).toBeVisible();

    await page.goto("/transactions");
    await expect(page.locator(".transaction-name", { hasText: "Sunny Day" })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.locator(".hero-value")).toHaveText("$1,000.00");
  });

  test("renaming a goal to an existing goal's name is rejected, not silently merged", async ({ page }) => {
    await signUpAndOnboard(page);

    await page.goto("/plan");
    for (const name of ["First Goal", "Second Goal"]) {
      await page.click('button:has-text("+ Add goal")');
      await page.waitForSelector("#goal-name");
      await page.fill("#goal-name", name);
      await fillAmount(page.locator("#goal-lifetime"), "1000");
      await page.click('button:has-text("Save goal")');
      await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
    }

    const secondRow = page.locator(".goal-row", { hasText: "Second Goal" });
    await secondRow.getByRole("button", { name: "Edit" }).click();
    const editGoalName = page.getByLabel("Goal name");
    await editGoalName.waitFor();
    await editGoalName.fill("");
    await editGoalName.fill("First Goal");
    await page.locator(".sheet").getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText('A goal named "First Goal" already exists')).toBeVisible();
    // Rejected in place -- the sheet stays open, nothing was merged/lost.
    await expect(page.locator(".sheet-backdrop")).toHaveCount(1);
  });
});
