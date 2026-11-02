import { expect, test } from "@playwright/test";
import { localSql, sqlText } from "../support/db";
import { codeFrom, countEmailsTo, latestEmailTo, testEmail } from "../support/mail";

// Security rule S5 (docs/PLAN.md): rate limits on sign-in attempts and on emails per address.
// Limits: one sign-in email per address per minute, five per hour; five code tries per 15 minutes.

async function askForCode(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
}

test("a second code for the same address within a minute is refused", async ({ page }) => {
  const email = testEmail("limit-minute");
  await askForCode(page, email);
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();
  await latestEmailTo(email);

  await page.getByRole("button", { name: "Send a new code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "once a minute" })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await countEmailsTo(email)).toBe(1);
});

test("a sixth sign-in email to one address within an hour is refused", async ({ page }) => {
  const email = testEmail("limit-hour");
  // Five emails sent to this address 10 to 50 minutes ago.
  localSql(`insert into private.sign_in_events (kind, subject, at)
    select 'email_sent', encode(extensions.digest(${sqlText(email)}, 'sha256'), 'hex'), now() - (n * interval '10 minutes')
    from generate_series(1, 5) as n`);

  await askForCode(page, email);
  await expect(page.getByRole("alert").filter({ hasText: "Try again in an hour" })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await countEmailsTo(email)).toBe(0);
});

test("after five wrong codes, even the right code is refused for a while", async ({ page }) => {
  const email = testEmail("limit-tries");
  await askForCode(page, email);
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();
  const code = codeFrom(await latestEmailTo(email));
  const wrong = code === "000000" ? "111111" : "000000";

  // Wait for each try's server reply before the next, so no try is lost mid-flight.
  const tryCode = async (value: string) => {
    await page.getByLabel("6-digit code").fill(value);
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/sign-in"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
  };

  for (let i = 0; i < 5; i++) {
    await tryCode(wrong);
    await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();
  }
  await tryCode(code);
  await expect(page.getByRole("alert").filter({ hasText: "Too many tries" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});
