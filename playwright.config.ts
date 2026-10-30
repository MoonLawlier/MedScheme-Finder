import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the development fallback (no Supabase), so
 * they need no external credentials. Set PLAYWRIGHT_CHROMIUM_PATH to use a
 * locally installed Chromium instead of Playwright's downloaded browser.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: executablePath
      ? { executablePath, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      ALLOW_DEV_FALLBACK: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
