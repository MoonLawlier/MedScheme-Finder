import { expect, test, type Page } from "@playwright/test";
import { newUser } from "./helpers";

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("L: the main journey fits a phone screen", async ({ page }) => {
  await page.goto("/");
  await noHorizontalOverflow(page);
  await newUser(page, "mobile");
  await noHorizontalOverflow(page);

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main mobile" }).getByRole("link", { name: "Scheme history" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/search/leukemia");
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("button", { name: "Show details" }).first().click();
  await noHorizontalOverflow(page);
  await page.goto("/history");
  await noHorizontalOverflow(page);
});
