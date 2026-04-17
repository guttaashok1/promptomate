import { test, expect } from "@playwright/test";

test("search for laptops returns results", async ({ page }) => {
  await page.goto("https://www.google.com");

  const searchBox = page.getByRole("combobox", { name: "Search" });
  await expect(searchBox).toBeVisible();
  await searchBox.fill("laptops");
  await searchBox.press("Enter");

  await expect(page).toHaveURL(/[?&]q=laptops/);
  await expect(page).toHaveTitle(/laptops/i);

  const results = page.getByRole("main");
  await expect(results).toBeVisible();
  await expect(results).toContainText(/laptop/i);
});
