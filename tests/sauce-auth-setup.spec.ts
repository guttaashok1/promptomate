// Auth setup fixture for "sauce-user".
// This spec performs the login flow once and persists the authenticated
// browser storage state to .promptomate/auth/sauce-user.json so that other
// tests can reuse the session without repeating the login UI steps.
import { test, expect } from "@playwright/test";
import { mkdir } from "fs/promises";

test("log in as standard_user and save storage state", async ({ page }) => {
  // Ensure the auth directory exists on all environments (Render, local, CI)
  await mkdir(".promptomate/auth", { recursive: true });

  await page.goto("https://www.saucedemo.com");

  await expect(page).toHaveTitle("Swag Labs");

  await page.getByRole("textbox", { name: "Username" }).fill("standard_user");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(process.env.SAUCE_PASSWORD ?? "");
  await page.getByRole("button", { name: "Login" }).click();

  // Verify successful login: redirected to the inventory page.
  await expect(page).toHaveURL("https://www.saucedemo.com/inventory.html");
  await expect(
    page.getByRole("contentinfo").getByText("© 2026 Sauce Labs. All Rights Reserved."),
  ).toBeVisible();

  // Persist the authenticated session for downstream tests.
  await page.context().storageState({ path: ".promptomate/auth/sauce-user.json" });
});
