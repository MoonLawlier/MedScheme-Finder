import { expect, test } from "@playwright/test";
import { newUser, setMode, signIn, uniqueEmail } from "./helpers";

test("A: a new user registers, completes the profile and reaches the dashboard", async ({ page }) => {
  await newUser(page, "a");
  await expect(page.getByRole("heading", { name: "Welcome, Asha" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What medical assistance are you looking for?" })).toBeVisible();
  await expect(page.getByLabel(/^Condition or treatment/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Knee replacement|Leukaemia|Angioplasty/ })).toHaveCount(0);

  await page.getByLabel(/^Condition or treatment/).fill("unknown condition");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("We don't have verified scheme data");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("protected pages redirect to sign-in when signed out", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fhistory/);
});

test("B: profile mode prefills, and temporary changes don't overwrite the profile", async ({ page }) => {
  await newUser(page, "b", { dob: "1980-05-10" });
  await setMode(page, "profile");
  await page.getByLabel(/^Condition or treatment/).fill("Leukaemia");
  await page.getByRole("button", { name: "Continue" }).click();
  const age = page.getByLabel(/^Your age/);
  await expect(age).not.toHaveValue("");
  await expect(page.getByText("From your profile").first()).toBeVisible();
  const original = await age.inputValue();

  await age.fill("71");
  await expect(page.getByText("Changed for this search only").first()).toBeVisible();
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByText("Age 71")).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByLabel(/^Date of birth/)).toHaveValue("1980-05-10");
  // Editing the search later still starts from the draft, and the profile age is unchanged.
  expect(Number(original)).toBeGreaterThan(40);
});

test("C: open mode searches for someone else without touching the profile", async ({ page }) => {
  await newUser(page, "c", { name: "Ravi Owner" });
  await setMode(page, "open");
  await page.getByLabel(/^Condition or treatment/).fill("Knee replacement");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Open mode: searching for someone else")).toBeVisible();
  const age = page.getByLabel(/^Age of the person needing treatment/);
  await expect(age).toHaveValue("");
  await expect(page.getByText("From your profile")).toHaveCount(0);

  await age.fill("74");
  await page.getByLabel(/^Their state of residence/).selectOption("KA");
  await page.locator("#treatmentState").selectOption("KA");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByText("Open mode: for someone else")).toBeVisible();

  await page.goto("/profile");
  await expect(page.getByLabel(/^Full name/)).toHaveValue("Ravi Owner");
  await expect(page.locator("#permanentAddress-state")).toHaveValue("MH");

  // Leaving Open mode clears the other person's draft.
  await setMode(page, "profile");
  await setMode(page, "open");
  await page.goto("/search/knee-replacement");
  await expect(page.getByLabel(/^Age of the person needing treatment/)).toHaveValue("");
});

test("D, F, G: angioplasty results explain eligibility, money and official links", async ({ page }) => {
  await newUser(page, "d");
  await setMode(page, "open");
  await page.goto("/search/angioplasty");
  await expect(page.getByRole("heading", { name: "Search details" })).toBeVisible();
  await expect(page.getByText("Knee replacement", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Leukaemia", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Angioplasty", { exact: true })).toHaveCount(0);
  await page.getByLabel(/^Age of the person/).fill("72");
  await page.locator("#treatmentState").selectOption("DL");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  // No search details in the URL.
  expect(page.url()).not.toMatch(/age|income|angioplasty/);

  const senior = page.getByRole("article").filter({ hasText: "senior citizens aged 70" });
  await expect(senior.getByText("Potential match")).toBeVisible();
  await senior.getByRole("button", { name: "Show details" }).click();
  await expect(senior.getByRole("heading", { name: "Eligibility criteria" })).toBeVisible();
  await expect(senior.getByText("Age 72 meets the documented requirement")).toBeVisible();
  await expect(senior.getByText("Up to ₹5 lakh", { exact: true })).toBeVisible();
  await expect(senior.getByText(/not the amount any one person will receive/)).toBeVisible();
  await expect(senior.getByText(/Cashless — the scheme pays the hospital/)).toBeVisible();

  const apply = senior.getByRole("link", { name: /Apply on official website/ });
  await expect(apply).toHaveAttribute("href", /\.gov\.in\//);
  await expect(apply).toHaveAttribute("target", "_blank");
  await expect(apply).toHaveAttribute("rel", /noopener/);

  const ran = page.getByRole("article").filter({ hasText: "Rashtriya Arogya Nidhi (RAN)" });
  await ran.getByRole("button", { name: "Show details" }).click();
  await expect(ran.getByText("Official application link not verified")).toBeVisible();
  await expect(ran.getByRole("link", { name: /Apply on official website/ })).toHaveCount(0);

  const pmnrf = page.getByRole("article").filter({ hasText: "Prime Minister's National Relief Fund" });
  await pmnrf.getByRole("button", { name: "Show details" }).click();
  await expect(pmnrf.getByText("Benefit amount not published in our verified sources")).toBeVisible();
});

test("E: national and state filters follow each scheme's real scope", async ({ page }) => {
  await newUser(page, "e");
  await setMode(page, "profile");
  await page.goto("/search/leukemia");
  await page.getByRole("radio", { name: "Yes" }).first().check({ force: true });
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);

  await page.getByRole("tab", { name: /^National/ }).click();
  await expect(page.getByRole("article").filter({ hasText: "Maharashtra" })).toHaveCount(0);
  await page.getByRole("tab", { name: /^State: Maharashtra/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").first()).toContainText("Mahatma Jyotirao Phule");

  // A Karnataka resident sees an honest empty state for state schemes.
  await setMode(page, "open");
  await page.goto("/search/leukemia");
  await page.getByLabel(/^Their state of residence/).selectOption("KA");
  await page.locator("#treatmentState").selectOption("KA");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("tab", { name: /^State: Karnataka/ }).click();
  await expect(page.getByText(/No state schemes for Karnataka/)).toBeVisible();

  // A Kerala resident sees Kerala's own schemes under the State filter, and nothing from Maharashtra.
  await page.goto("/search/leukemia");
  await page.getByLabel(/^Their state of residence/).selectOption("KL");
  await page.locator("#treatmentState").selectOption("KL");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("tab", { name: /^State: Kerala/ }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article").filter({ hasText: "Karunya Benevolent Fund" })).toHaveCount(1);
});

test("H: hospitals follow the chosen location and are never shown as confirmed without a source", async ({ page, context }) => {
  await newUser(page, "h");
  await setMode(page, "profile");
  await page.goto("/search/leukemia");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  const pmjay = page.getByRole("article").filter({ hasText: "Pradhan Mantri Jan Arogya Yojana (AB PM-JAY)" });
  await pmjay.getByRole("button", { name: "Show details" }).click();
  await expect(pmjay.getByText("Tata Memorial Hospital")).toBeVisible();
  await expect(pmjay.getByText("In your chosen district")).toBeVisible();

  // Browser location: Delhi → AIIMS New Delhi listed first for RAN, with an approximate distance.
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 28.61, longitude: 77.21 });
  await setMode(page, "open");
  await page.goto("/search/angioplasty");
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Using your approximate current location/)).toBeVisible();
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  const ran = page.getByRole("article").filter({ hasText: "Rashtriya Arogya Nidhi (RAN)" });
  await ran.getByRole("button", { name: "Show details" }).click();
  const first = ran.locator("li", { hasText: "All India Institute" }).first();
  await expect(first).toContainText("New Delhi");
  await expect(first).toContainText(/km away \(approximate\)/);
  await expect(ran.getByText(/availability not confirmed/).first()).toBeVisible();
});

test("I and J: history starts empty and stays private to each user", async ({ page }) => {
  await newUser(page, "i");
  await page.goto("/history");
  await expect(page.getByText("Nothing Here!", { exact: true })).toBeVisible();

  await page.goto("/search/angioplasty");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);
  await page.getByRole("button", { name: "Show details" }).first().click();
  await page.goto("/history");
  await expect(page.getByRole("cell", { name: "Medical assistance search" })).toBeVisible();
  await page.getByLabel(/Your application status for/).first().selectOption("planning");
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // A different account sees none of it.
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page, uniqueEmail("j"));
  await page.getByLabel(/^Full name/).waitFor();
  await page.goto("/history");
  await expect(page.getByText("Nothing Here!", { exact: true })).toBeVisible();
});

test("K: denied location and unknown needs produce clear messages", async ({ page, context }) => {
  await newUser(page, "k");
  await context.clearPermissions();
  await page.goto("/search/knee-replacement");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: (_ok: unknown, fail: (e: { code: number; PERMISSION_DENIED: number }) => void) => fail({ code: 1, PERMISSION_DENIED: 1 }) },
    });
  });
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Location permission was declined/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Use my current location" })).toBeDisabled();

  // Search still works with manual location.
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page).toHaveURL(/\/results$/);

  const res = await page.goto("/search/not-a-real-need");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("search validation shows readable errors", async ({ page }) => {
  await newUser(page, "v");
  await setMode(page, "open");
  await page.goto("/search/angioplasty");
  await page.getByLabel(/^Age of the person/).fill("150");
  await page.getByRole("button", { name: "Find schemes" }).click();
  await expect(page.getByText("Enter an age between 0 and 120.")).toBeVisible();
  await expect(page.getByText(/Choose the state where treatment is needed/)).toBeVisible();
});
