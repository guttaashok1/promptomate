import { test, expect } from "@playwright/test";
import { expectVisual } from "../src/assertions.js";

test("locked_out_user login is rejected with a visible error banner", async ({ page }) => {
  await page.goto("https://www.saucedemo.com");

  await page.getByRole("textbox", { name: "Username" }).fill("locked_out_user");
  await page.getByRole("textbox", { name: "Password" }).fill("secret_sauce");
  await page.getByRole("button", { name: "Login" }).click();

  // User remains on the login page (not redirected to /inventory.html)
  await expect(page).toHaveURL("https://www.saucedemo.com/");
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();

  // Error message is displayed
  const errorHeading = page.getByRole("heading", {
    name: "Epic sadface: Sorry, this user has been locked out.",
  });
  await expect(errorHeading).toBeVisible();
  await expect(errorHeading).toHaveText(
    "Epic sadface: Sorry, this user has been locked out."
  );

  // Visual check: the error should be styled as a prominent red error banner
  await expectVisual(page, "a red error banner displayed above the Login button stating the user has been locked out");
});
