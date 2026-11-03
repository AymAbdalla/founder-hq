import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// Runs against a production build (`npm run build:canary` first), never the dev server,
// so the checks see the same headers and scripts users get.
const PORT = 3100;

// Made-up notification keys and job secret for the test server, made fresh for each run and
// never stored. Set once here so test workers (which load this file again) see the same values.
process.env.HQ_TEST_CRON_SECRET ??= randomBytes(32).toString("hex");
if (!process.env.HQ_TEST_VAPID_PUBLIC || !process.env.HQ_TEST_VAPID_PRIVATE) {
  const keys = webpush.generateVAPIDKeys();
  process.env.HQ_TEST_VAPID_PUBLIC = keys.publicKey;
  process.env.HQ_TEST_VAPID_PRIVATE = keys.privateKey;
}

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    env: {
      ...(process.env as Record<string, string>),
      CRON_SECRET: process.env.HQ_TEST_CRON_SECRET,
      VAPID_PUBLIC_KEY: process.env.HQ_TEST_VAPID_PUBLIC,
      VAPID_PRIVATE_KEY: process.env.HQ_TEST_VAPID_PRIVATE,
      VAPID_SUBJECT: "https://hq.example.test",
    },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
