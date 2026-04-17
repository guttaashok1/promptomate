import { test, expect } from "@playwright/test";

test("standard_user can log in and reach the products page", async ({ page }) => {
  await page.goto("https://www.saucedemo.com");

  await page.getByRole("textbox", { name: "Username" }).fill("standard_user");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(process.env.SAUCE_PASSWORD ?? "");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/inventory\.html$/);
  await expect(page.getByText("Products", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("az");
  await expect(
    page.getByRole("link", { name: "Sauce Labs Backpack" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to cart" }).first(),
  ).toBeVisible();
});
