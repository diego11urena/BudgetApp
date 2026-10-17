import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

test("login requires accepting the Terms before continuing with Google", async ({ page }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.context().addCookies([{ name: "balboa-locale", value: "en", url: baseURL }]);
  await page.goto("/login");

  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(button).toBeEnabled();
});

test("deleting your account signs you out and removes access", async ({ page }) => {
  await signUpAndOnboard(page);

  await page.goto("/profile");
  await page.click('button:has-text("Delete account")');
  await page.click('button:has-text("Yes, delete my account")');
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000, waitUntil: "commit" });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
