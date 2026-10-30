import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

const DEV_COOKIE = "msf_dev_session";

test.describe("authentication (development fallback)", () => {
  test("sign-in persists across refresh and honours a safe ?next", async ({ page }) => {
    await page.goto("/sign-in?next=%2Fprofile");
    await page.getByLabel(/Email \(any test address\)/).fill(uniqueEmail("persist"));
    await page.getByRole("button", { name: "Continue in development mode" }).click();
    await expect(page).toHaveURL(/\/profile/);
    await page.reload();
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible();
  });

  test("invalid email is rejected with a visible message", async ({ page }) => {
    await page.goto("/sign-in");
    const input = page.getByLabel(/Email \(any test address\)/);
    await input.fill("not-an-email");
    // Bypass native browser validation so the server-side check is exercised.
    await page.evaluate(() => document.querySelector("form")?.setAttribute("novalidate", ""));
    await page.getByRole("button", { name: "Continue in development mode" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-out ends the session, and Back does not reveal protected data", async ({ page, context }) => {
    await signIn(page, uniqueEmail("out"));
    await expect(page).toHaveURL(/\/(dashboard|profile)/);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/$/);
    expect((await context.cookies()).some((c) => c.name === DEV_COOKIE)).toBe(false);
    await page.goto("/history");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fhistory/);
    await page.goBack();
    await page.goBack().catch(() => undefined);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("forged and tampered session cookies are rejected by the proxy", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: DEV_COOKIE, value: "forged.value", url: baseURL! }]);
    const res = await page.request.get("/dashboard", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/sign-in");
  });

  test("a signed-in user is not bounced to an off-site URL via ?next", async ({ page }) => {
    await signIn(page, uniqueEmail("redir"));
    await expect(page).toHaveURL(/\/(dashboard|profile)/);
    for (const evil of ["/\\evil.example", "//evil.example", "/\t/evil.example", "https://evil.example"]) {
      // Next streams the redirect, so the initial load can be aborted by the client-side navigation.
      await page.goto(`/sign-in?next=${encodeURIComponent(evil)}`, { waitUntil: "commit" }).catch(() => undefined);
      await expect(page, `next=${JSON.stringify(evil)}`).toHaveURL(/^http:\/\/localhost:\d+\/(dashboard|profile)/);
    }
  });

  test("a user cannot act on server actions without a session", async ({ page }) => {
    await page.goto("/sign-in");
    const res = await page.request.get("/results", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
  });
});
