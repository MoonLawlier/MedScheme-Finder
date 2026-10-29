import { expect, type Page } from "@playwright/test";

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel(/Email \(any test address\)/).fill(email);
  await page.getByRole("button", { name: "Continue in development mode" }).click();
}

export async function completeProfile(page: Page, opts: { name?: string; dob?: string; state?: string; district?: string } = {}) {
  await expect(page.getByRole("heading", { name: "Set up your profile" })).toBeVisible();
  await page.getByLabel(/^Full name/).fill(opts.name ?? "Asha Test");
  await page.getByLabel(/^Date of birth/).fill(opts.dob ?? "1980-05-10");
  await page.getByLabel(/^Contact number/).fill("+919876543210");
  await page.getByLabel(/^House, street and area/).fill("12 Test Lane");
  await page.getByLabel(/^State \/ UT/).selectOption(opts.state ?? "MH");
  await page.getByLabel(/^District/).fill(opts.district ?? "Mumbai City");
  await page.getByLabel(/^PIN code/).fill("400012");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function newUser(page: Page, tag: string, profile?: Parameters<typeof completeProfile>[1]) {
  const email = uniqueEmail(tag);
  await signIn(page, email);
  await completeProfile(page, profile);
  return email;
}

export async function setMode(page: Page, mode: "profile" | "open") {
  const toggle = page.getByRole("radiogroup", { name: "Who are you searching for?" }).first();
  await toggle.getByRole("radio", { name: mode === "profile" ? /profile/i : /someone else/i }).click();
}
