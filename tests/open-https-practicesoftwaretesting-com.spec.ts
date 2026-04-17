import { test, expect } from "@playwright/test";

test("home page loads with navigation and products", async ({ page }) => {
  await page.goto("https://practicesoftwaretesting.com/");

  await expect(page).toHaveURL("https://practicesoftwaretesting.com/");
  await expect(page).toHaveTitle("Practice Software Testing - Toolshop - v5.0");

  // Header / branding
  await expect(
    page.getByRole("link", { name: "Practice Software Testing - Toolshop" })
  ).toBeVisible();

  // Main menu items
  const mainMenu = page.getByRole("menubar", { name: "Main menu" });
  await expect(mainMenu.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(mainMenu.getByRole("button", { name: "Categories" })).toBeVisible();
  await expect(mainMenu.getByRole("link", { name: "Contact" })).toBeVisible();
  await expect(mainMenu.getByRole("link", { name: "Sign in" })).toBeVisible();

  // Sidebar filter sections
  await expect(page.getByRole("heading", { name: "Sort" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price Range" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();

  // At least one product card is rendered
  await expect(
    page.getByRole("heading", { name: "Combination Pliers" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pliers", exact: true })).toBeVisible();
});
