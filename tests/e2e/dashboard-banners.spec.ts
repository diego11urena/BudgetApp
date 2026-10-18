import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect, type Locator } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/**
 * Seeds a CycleTransaction with no UI path to reach it (a missing
 * category only ever happens via Gmail import -- the manual Add
 * Transaction form always requires one) by running lib/prisma.ts in its
 * own tsx process. See seed-transaction.ts for why this can't just be
 * `import { prisma } from "@/lib/prisma"` directly in this file.
 */
function seedTransaction(payload: {
  email: string;
  name: string;
  amount: number;
  paymentMethod?: "YAPPY";
  description?: string | null;
  recurringExpense?: { name: string; amount: number };
}) {
  execFileSync(
    "npx",
    ["tsx", path.join(__dirname, "seed-transaction.ts"), JSON.stringify(payload)],
    { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" },
  );
}

/** Picks an existing category in the row's native select, or "+ New category…" and types it. */
async function setCategory(row: Locator, name: string) {
  const select = row.getByLabel("Category", { exact: true });
  const existing = await select.locator("option").allTextContents();
  if (existing.includes(name)) {
    await select.selectOption(name);
  } else {
    await select.selectOption({ label: "+ New category…" });
    await row.getByPlaceholder("New category name").fill(name);
  }
}

test.describe("dashboard 'needs attention' banner", () => {
  test("a transaction missing both category and description gets ONE banner, not two, and one combined row finishes both fields at once", async ({
    page,
  }) => {
    const { email } = await signUpAndOnboard(page);

    // Simulates what a real Yappy import looks like on arrival: no
    // learned-merchant category match, no message attached -- the exact
    // repro this banner unification fixes.
    seedTransaction({ email, name: "Juan Perez", amount: 15, paymentMethod: "YAPPY" });

    await page.goto("/dashboard");
    await page.waitForSelector(".dashboard-section");

    // Exactly one banner -- not "needs a category" AND "needs a
    // description" as two separate rows.
    await expect(page.locator(".banner--action")).toHaveCount(1);
    await expect(page.locator(".banner--action")).toContainText("1 transaction needs more info");

    await page.click(".banner--action");
    await page.waitForSelector(".categorize-imports-row");
    // One row, with both a category field and a description field.
    await expect(page.locator(".categorize-imports-row")).toHaveCount(1);
    const row = page.locator(".categorize-imports-row");
    await expect(row).toContainText("Sent to Juan Perez");
    // A native category select; the text field only appears for "+ New category…".
    await expect(row.getByLabel("Category", { exact: true })).toHaveCount(1);
    await expect(row.getByPlaceholder("New category name")).toHaveCount(0);
    await expect(row.locator('input[placeholder="Rent, lunch, gift…"]')).toHaveCount(1);

    await setCategory(row, "Transportation");
    await row.locator('input[placeholder="Rent, lunch, gift…"]').fill("Taxi fare");
    await row.getByRole("button", { name: "Save", exact: true }).click();

    // Both fields saved in one submit -- sheet empties and closes, banner
    // disappears from the dashboard entirely.
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".banner--action")).toHaveCount(0);

    await page.goto("/transactions");
    const savedRow = page.locator(".transaction-row", { hasText: "Juan Perez" });
    await expect(savedRow.locator(".transaction-sub")).toContainText("Transportation");
  });

  test("a transaction missing only a category shows just the category field, not an empty description field", async ({
    page,
  }) => {
    const { email } = await signUpAndOnboard(page);
    seedTransaction({ email, name: "Cafe Unido", amount: 4.5, description: "Coffee" });

    await page.goto("/dashboard");
    await page.click(".banner--action");
    await page.waitForSelector(".categorize-imports-row");
    const row = page.locator(".categorize-imports-row");
    await expect(row).toContainText("Cafe Unido");
    await expect(row).not.toContainText("Sent to");
    await expect(row.getByLabel("Category", { exact: true })).toHaveCount(1);
    await expect(row.locator('input[placeholder="Rent, lunch, gift…"]')).toHaveCount(0);
  });

  test("Done for now saves the one transaction that was categorized, leaves the other, and the sheet stays closed", async ({
    page,
  }) => {
    const { email } = await signUpAndOnboard(page);
    // Newest first in the sheet: Cafe Unido is row 1, Super 99 row 2.
    seedTransaction({ email, name: "Super 99", amount: 30, description: "Groceries" });
    seedTransaction({ email, name: "Cafe Unido", amount: 4.5, description: "Coffee" });

    await page.goto("/dashboard");
    await expect(page.locator(".banner--action")).toContainText("2 transactions need more info");
    await expect(page.getByText("Needs a category")).toHaveCount(2);

    await page.click(".banner--action");
    const rows = page.locator(".categorize-imports-row");
    await expect(rows).toHaveCount(2);
    await setCategory(rows.filter({ hasText: "Cafe Unido" }), "Coffee");
    await page.getByRole("button", { name: "Done for now" }).click();

    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".banner--action")).toContainText("1 transaction needs more info");
    await expect(page.getByText("Needs a category")).toHaveCount(1);
    await page.waitForTimeout(1500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "Cafe Unido" }).locator(".transaction-sub")).toContainText(
      "Coffee",
    );
    await expect(page.locator(".transaction-row", { hasText: "Super 99" }).locator(".transaction-sub")).toContainText(
      "Needs a category",
    );
  });

  test("with the keyboard up and recurring toggled, Save stays visible; Done for now skips a half-filled row but saves the valid one", async ({
    page,
  }) => {
    // Short viewport stands in for a phone with the keyboard open.
    await page.setViewportSize({ width: 390, height: 520 });
    const { email } = await signUpAndOnboard(page);
    seedTransaction({ email, name: "Super 99", amount: 30, description: "Groceries" });
    seedTransaction({
      email,
      name: "Electric Co",
      amount: 40,
      description: "Power bill",
      recurringExpense: { name: "Electricity", amount: 40 },
    });

    await page.goto("/dashboard");
    await page.click(".banner--action");
    const electric = page.locator(".categorize-imports-row").filter({ hasText: "Electric Co" });
    const electricSave = electric.getByRole("button", { name: "Save", exact: true });

    await setCategory(electric, "Utilities");

    // Toggling recurring never moves Save.
    const recurringSwitch = electric.getByLabel("This is a recurring expense");
    const recurringSelect = electric.getByLabel("Which recurring expense?");
    // Position within the row (not the viewport, which scrolls to reach the switch).
    const saveY = () => electricSave.evaluate((el) => (el as HTMLElement).offsetTop);
    const before = await saveY();
    await expect(recurringSelect).toBeDisabled();
    for (const checked of [true, false, true]) {
      await recurringSwitch.setChecked(checked);
      expect(await saveY()).toBe(before);
    }
    await expect(recurringSelect).toBeEnabled();

    // "Other…" is the only path to a text field (keyboard); Save stays in view while typing.
    await recurringSelect.selectOption({ label: "Other…" });
    const recurringName = electric.getByPlaceholder("Recurring expense name");
    await expect(recurringName).toBeFocused();
    await expect(electricSave).toBeInViewport();

    // Half-filled: recurring on but no recurring expense named -> not saved.
    await recurringName.fill("");
    const groceries = page.locator(".categorize-imports-row").filter({ hasText: "Super 99" });
    await setCategory(groceries, "Groceries");
    await page.getByRole("button", { name: "Done for now" }).click();

    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".banner--action")).toContainText("1 transaction needs more info");
    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "Super 99" }).locator(".transaction-sub")).toContainText(
      "Groceries",
    );
    await expect(page.locator(".transaction-row", { hasText: "Electric Co" }).locator(".transaction-sub")).toContainText(
      "Needs a category",
    );

    // Reopen from Review and finish it with a picked recurring expense: Save closes the sheet.
    await page.goto("/dashboard");
    await page.click(".banner--action");
    await setCategory(electric, "Utilities");
    await recurringSwitch.check();
    await recurringSelect.selectOption({ label: "Electricity · $40.00" });
    await electricSave.click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".banner--action")).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
  });
});
