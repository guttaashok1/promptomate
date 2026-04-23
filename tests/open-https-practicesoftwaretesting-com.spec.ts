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

test("a new user can register successfully", async ({ page }) => {
  await page.goto("https://practicesoftwaretesting.com/");

  // Navigate to Sign in
  await page
    .getByRole("menubar", { name: "Main menu" })
    .getByRole("link", { name: "Sign in" })
    .click();

  await expect(page).toHaveURL(/\/auth\/login/);

  // Go to the registration page
  await page.getByRole("link", { name: /Register your account/i }).click();
  await expect(page).toHaveURL(/\/auth\/register/);

  // Build a unique email per run so the test is repeatable
  const uniqueSuffix = Date.now();
  const email = `tester_${uniqueSuffix}@example.com`;

  // Fill in the registration form
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("User");
  await page.getByLabel("Date of Birth").fill("1990-01-15");
  await page.getByLabel("Street").fill("123 Test Street");
  await page.getByLabel("Postal code").fill("12345");
  await page.getByLabel("City").fill("Testville");
  await page.getByLabel("State").fill("TestState");
  await page.getByLabel("Country").selectOption({ label: "Canada" });
  await page.getByLabel("Phone").fill("5551234567");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Welcome1!");

  // Submit registration
  await page.getByRole("button", { name: /Register/i }).click();

  // On success the app redirects to the login page
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 15_000 });
  await expect(page.getByLabel("Email address")).toBeVisible();
});
