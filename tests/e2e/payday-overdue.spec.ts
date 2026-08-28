import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

test.describe("payday-overdue banner", () => {
  test("shows once the quincena's calendar end has passed, and disappears once the cycle is closed", async ({
    page,
  }) => {
    await signUpAndOnboard(page, { netQuincenaAmount: "1000" });

    // A cycle that just started today is nowhere near its calendar end --
    // no banner yet.
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /did you get paid/i })).toHaveCount(0);

    // Push periodStart back far enough (a quincena is at most 16 days,
    // see quincenaLengthDays) that its calendar end has already passed,
    // via the real "Edit pay info" flow -- same technique
    // tests/e2e/history.spec.ts uses, needed because the server's real
    // clock can't be advanced mid-test.
    await page.click("text=Edit");
    const editPayDate = page.getByLabel("Pay date");
    await editPayDate.waitFor();
    await editPayDate.fill(daysAgoISO(20));
    await page.click('.sheet button[type="submit"]');
    await page.waitForSelector(".sheet-backdrop", { state: "detached" });

    await page.goto("/dashboard");
    const banner = page.getByRole("button", { name: /did you get paid/i });
    await expect(banner).toBeVisible();

    // Clicking the banner opens the exact same confirm flow "I just got
    // paid" does -- it's the same component, just a more prominent
    // trigger (see HeroCardActions' variant prop).
    await banner.click();
    await page.waitForSelector('button:has-text("Yes, I got paid")');
    await page.click('button:has-text("Yes, I got paid")');
    await expect(page.getByText("Quincena closed")).toBeVisible();
    await page.click('button:has-text("Continue")');

    // The new cycle starts today -- nowhere near overdue anymore.
    await expect(page.getByRole("button", { name: /did you get paid/i })).toHaveCount(0);
  });
});
