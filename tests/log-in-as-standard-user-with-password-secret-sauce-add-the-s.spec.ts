import { test, expect } from "@playwright/test";

test("standard_user can complete a Sauce Labs Backpack checkout", async ({ page }) => {
  await page.goto("https://www.saucedemo.com");

  // Log in
  await page.getByRole("textbox", { name: "Username" }).fill("standard_user");
  await page.getByRole("textbox", { name: "Password" }).fill("secret_sauce");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/inventory\.html/);

  // Add the Sauce Labs Backpack to the cart (scoped to its inventory item)
  const backpackItem = page
    .locator('[data-test="inventory-item"]')
    .filter({ hasText: "Sauce Labs Backpack" });
  await backpackItem.getByRole("button", { name: "Add to cart" }).click();
  await expect(backpackItem.getByRole("button", { name: "Remove" })).toBeVisible();

  // Go to the cart and proceed to checkout
  await page.locator('[data-test="shopping-cart-link"]').click();
  await expect(page).toHaveURL(/cart\.html/);
  await expect(page.getByRole("link", { name: "Sauce Labs Backpack" })).toBeVisible();
  await page.getByRole("button", { name: "Checkout" }).click();

  // Fill shipping info
  await expect(page).toHaveURL(/checkout-step-one\.html/);
  await page.getByRole("textbox", { name: "First Name" }).fill("Test");
  await page.getByRole("textbox", { name: "Last Name" }).fill("User");
  await page.getByRole("textbox", { name: "Zip/Postal Code" }).fill("12345");
  await page.getByRole("button", { name: "Continue" }).click();

  // Overview and finish
  await expect(page).toHaveURL(/checkout-step-two\.html/);
  await expect(page.getByText("Total: $32.39")).toBeVisible();
  await page.getByRole("button", { name: "Finish" }).click();

  // Confirmation
  await expect(page).toHaveURL(/checkout-complete\.html/);
  await expect(
    page.getByRole("heading", { name: "Thank you for your order!" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Back Home" })).toBeVisible();
});
