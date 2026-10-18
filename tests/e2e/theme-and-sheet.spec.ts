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

async function dragHandle(page: import("@playwright/test").Page, dy: number) {
  await page.waitForTimeout(300); // let the slide-in finish so the handle isn't moving
  const box = (await page.locator(".sheet-handle-area").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 8 });
  await page.mouse.up();
}

test("sheets close when their handle is dragged down, and stay open on a short drag", async ({ page }) => {
  await signUpAndOnboard(page);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Add a transaction" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await dragHandle(page, 30);
  await expect(page.getByRole("dialog")).toBeVisible();
  await dragHandle(page, 120);
  await expect(page.getByRole("dialog")).toBeHidden();

  // Same behavior on a different sheet, via the shared Sheet component.
  await page.goto("/profile");
  await page.click('button:has-text("Delete account")');
  await expect(page.getByRole("dialog")).toBeVisible();
  await dragHandle(page, 120);
  await expect(page.getByRole("dialog")).toBeHidden();
});
