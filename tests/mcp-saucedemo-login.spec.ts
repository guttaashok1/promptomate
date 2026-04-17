import { test, expect } from "@playwright/test";

test("standard_user can log in and see the products page", async ({ page }) => {
  await page.goto("https://www.saucedemo.com");

  await expect(page).toHaveTitle("Swag Labs");

  await page.getByRole("textbox", { name: "Username" }).fill("standard_user");
  await page.getByRole("textbox", { name: "Password" }).fill("secret_sauce");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/inventory\.html$/);
  await expect(page.getByText("Products", { exact: true })).toBeVisible();

  await expect(page.getByRole("combobox")).toHaveValue("az");

  await expect(page.getByRole("link", { name: "Sauce Labs Backpack" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sauce Labs Bike Light" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sauce Labs Bolt T-Shirt" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sauce Labs Fleece Jacket" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sauce Labs Onesie" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Test.allTheThings() T-Shirt (Red)" }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Open Menu" })).toBeVisible();
});
