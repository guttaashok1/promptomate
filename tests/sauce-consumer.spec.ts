import { test, expect } from "@playwright/test";

test.use({ storageState: ".promptomate/auth/sauce-user.json" });

test("add Sauce Labs Backpack to cart shows badge with 1 item", async ({ page }) => {
  await page.goto("https://www.saucedemo.com/inventory.html");

  await expect(page).toHaveURL(/\/inventory\.html$/);
  await expect(page.getByText("Products", { exact: true })).toBeVisible();

  const backpackCard = page
    .locator(".inventory_item")
    .filter({ has: page.getByText("Sauce Labs Backpack", { exact: true }) });

  const addButton = backpackCard.getByRole("button", { name: "Add to cart" });
  await expect(addButton).toBeVisible();

  // Cart badge should not be present before adding
  await expect(page.locator(".shopping_cart_badge")).toHaveCount(0);

  await addButton.click();

  // After clicking, the button for the Backpack should toggle to "Remove"
  await expect(
    backpackCard.getByRole("button", { name: "Remove" })
  ).toBeVisible();

  // Cart badge should now show "1"
  const cartBadge = page.locator(".shopping_cart_badge");
  await expect(cartBadge).toBeVisible();
  await expect(cartBadge).toHaveText("1");
});
