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
}) {
  execFileSync(
    "npx",
    ["tsx", path.join(__dirname, "seed-transaction.ts"), JSON.stringify(payload)],
    { cwd: path.join(__dirname, "..", ".."), stdio: "inherit" },
  );
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
    await expect(page.locator(".banner--action")).toHaveText("1 transaction needs more info");

    await page.click(".banner--action");
    await page.waitForSelector(".categorize-imports-row");
    // One row, with both a category field and a description field.
    await expect(page.locator(".categorize-imports-row")).toHaveCount(1);
    const row = page.locator(".categorize-imports-row");
    await expect(row).toContainText("Sent to Juan Perez");
    // CategoryNameInput's single always-visible input -- no separate
    // "new category" field to reveal, it accepts free text directly.
    await expect(row.locator('input[placeholder="Choose or enter a category"]')).toHaveCount(1);
    await expect(row.locator('input[placeholder="Rent, lunch, gift…"]')).toHaveCount(1);

    await row.locator('input[placeholder="Choose or enter a category"]').fill("Transportation");
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
    await expect(row.locator('input[placeholder="Choose or enter a category"]')).toHaveCount(1);
    await expect(row.locator('input[placeholder="Rent, lunch, gift…"]')).toHaveCount(0);
  });
});
