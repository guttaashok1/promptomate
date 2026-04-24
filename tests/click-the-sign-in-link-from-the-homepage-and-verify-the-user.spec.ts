import { test, expect } from "@playwright/test";

test("Sign in link from homepage reveals username and password fields", async ({ page }) => {
  // Block images and fonts to reduce Chrome memory usage on resource-constrained servers
  await page.route(/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|otf)(\?.*)?$/i, route => route.abort());

  await page.goto("https://github.com", { waitUntil: "domcontentloaded" });

  await page.getByRole("link", { name: "Sign in" }).click();

  await expect(page).toHaveURL("https://github.com/login");
  await expect(page.getByRole("heading", { name: "Sign in to GitHub" })).toBeVisible();

  const username = page.getByRole("textbox", { name: "Username or email address" });
  const password = page.getByRole("textbox", { name: "Password" });

  await expect(username).toBeVisible();
  await expect(password).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});
