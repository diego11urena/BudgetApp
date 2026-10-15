import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test("changing your password keeps this device signed in", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/profile");
  await page.click('button:has-text("Change password")');
  await page.fill("#current-password", "password123");
  await page.fill("#new-password", "newpassword456");
  await page.fill("#confirm-password", "newpassword456");
  await page.click('.sheet button[type="submit"]');
  await expect(page.getByText("Password updated.")).toBeVisible();

  // sessionVersion was bumped -- this device's session must have been
  // re-issued, not silently invalidated.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator(".hero-value")).toBeVisible();
});
