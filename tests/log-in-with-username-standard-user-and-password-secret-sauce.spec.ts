import { test, expect } from "@playwright/test";

test("standard_user can log in and see products page", async ({ page }) => {
  await page.goto("https://www.saucedemo.com");

  await page.getByRole("textbox", { name: "Username" }).fill("standard_user");
  await page.getByRole("textbox", { name: "Password" }).fill("secret_sauce");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL("https://www.saucedemo.com/inventory.html");
  await expect(page.getByText("Products", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Menu" })).toBeVisible();
  await expect(page.getByText("Sauce Labs Backpack").first()).toBeVisible();
});
