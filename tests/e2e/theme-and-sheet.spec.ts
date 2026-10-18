import { test, expect } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

const htmlTheme = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.getAttribute("data-theme"));

test("System theme follows the OS, including after the save re-renders the page", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/profile");

  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect.poll(() => htmlTheme(page)).toBe("light");

  await page.getByRole("button", { name: "System", exact: true }).click();
  await expect(page.getByRole("button", { name: "System", exact: true })).toBeEnabled();
  await expect.poll(() => htmlTheme(page)).toBe("dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => htmlTheme(page)).toBe("light");

  await page.reload();
  await expect.poll(() => htmlTheme(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => htmlTheme(page)).toBe("dark");
});

test("the page behind the add-transaction sheet can't scroll", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/dashboard");
  const rootOverflow = () => page.evaluate(() => getComputedStyle(document.documentElement).overflowY);

  await page.getByRole("button", { name: "Add a transaction" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(rootOverflow).toBe("hidden");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(rootOverflow).not.toBe("hidden");
});
