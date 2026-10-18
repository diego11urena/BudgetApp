import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
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

test.describe("dashboard 'needs attention' banner", () => {
  test("a transaction missing both category and description gets ONE banner, and one Save finishes both fields", async ({
    page,
  }) => {
    const { email } = await signUpAndOnboard(page);
    // What a real Yappy import looks like: no learned category, no message.
    seedTransaction({ email, name: "Juan Perez", amount: 15, paymentMethod: "YAPPY" });

    await page.goto("/dashboard");
    await expect(page.locator(".banner--action")).toHaveCount(1);
    await expect(page.locator(".banner--action")).toContainText("1 transaction needs more info");

    await page.click(".banner--action");
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("Sent to Juan Perez");
    const save = sheet.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeDisabled();

    // The keyboard-opening text field only exists after choosing "Create new".
    await expect(sheet.getByPlaceholder("New category name")).toHaveCount(0);
    await sheet.getByRole("button", { name: "+ Create new" }).click();
    await sheet.getByPlaceholder("New category name").fill("Transportation");
    await expect(save).toBeDisabled(); // description still missing
    await sheet.getByPlaceholder("Rent, lunch, gift…").fill("Taxi fare");
    await save.click();

    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".banner--action")).toHaveCount(0);

    await page.goto("/transactions");
    const savedRow = page.locator(".transaction-row", { hasText: "Juan Perez" });
    await expect(savedRow.locator(".transaction-sub")).toContainText("Transportation");
  });

  test("a transaction missing only a category shows no description field", async ({ page }) => {
    const { email } = await signUpAndOnboard(page);
    seedTransaction({ email, name: "Cafe Unido", amount: 4.5, description: "Coffee" });

    await page.goto("/dashboard");
    await page.click(".banner--action");
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("Cafe Unido");
    await expect(sheet).not.toContainText("Sent to");
    await expect(sheet.getByPlaceholder("Rent, lunch, gift…")).toHaveCount(0);
  });

  test("full flow: chips, recurring, Save advances in place, Done for now doesn't re-trigger, last Save closes and clears everything", async ({
    page,
  }) => {
    const { email } = await signUpAndOnboard(page);
    // The sheet lists newest first, so Cafe Unido (seeded first) comes second.
    seedTransaction({ email, name: "Cafe Unido", amount: 4.5, description: "Coffee" });
    seedTransaction({
      email,
      name: "Electric Co",
      amount: 40,
      description: "Power bill",
      recurringExpense: { name: "Electricity", amount: 40 },
    });

    await page.goto("/dashboard");
    await expect(page.locator(".banner--action")).toContainText("2 transactions need more info");
    await expect(page.getByText("Needs a category")).toHaveCount(2);

    await page.click(".banner--action");
    const sheet = page.getByRole("dialog");
    const save = sheet.getByRole("button", { name: "Save", exact: true });
    await expect(sheet).toContainText("1 of 2");
    await expect(sheet).toContainText("Electric Co");

    // Tapping a chip selects it without focusing any text field (no keyboard).
    await sheet.getByRole("button", { name: "Utilities", exact: true }).click();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
    await expect(save).toBeEnabled();

    // Checking recurring requires picking one before Save re-enables; Save never disappears.
    await sheet.getByLabel("This is a recurring expense").check();
    await expect(save).toBeVisible();
    await expect(save).toBeDisabled();
    await sheet.getByRole("button", { name: /^Electricity/ }).click();
    await expect(save).toBeEnabled();
    await save.click();

    // Advances to the next transaction in the same sheet.
    await expect(sheet).toContainText("2 of 2");
    await expect(sheet).toContainText("Cafe Unido");
    await expect(page.getByText("Needs a category")).toHaveCount(1);
    await expect(page.locator(".banner--action")).toContainText("1 transaction needs more info");

    // Done for now closes it, and it doesn't come back on its own.
    await sheet.getByRole("button", { name: "Done for now" }).click();
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    // Reopening from Review shows only what's left.
    await page.click(".banner--action");
    await expect(sheet).toContainText("Cafe Unido");
    await expect(sheet).not.toContainText("of 2");
    await sheet.getByRole("button", { name: "+ Create new" }).click();
    await sheet.getByPlaceholder("New category name").fill("Coffee");
    await save.click();

    await expect(page.locator(".sheet-backdrop")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(".banner--action")).toHaveCount(0);
    await expect(page.getByText("Needs a category")).toHaveCount(0);
    await page.waitForTimeout(1500);
    await expect(page.locator(".sheet-backdrop")).toHaveCount(0);

    // The recurring link was saved.
    await page.goto("/transactions");
    await expect(page.locator(".transaction-row", { hasText: "Electric Co" }).locator(".transaction-sub")).toContainText(
      "Utilities",
    );
  });
});
