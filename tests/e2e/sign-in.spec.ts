import { expect, test } from "@playwright/test";
import { codeFrom, latestEmailTo, linkFrom, testEmail } from "../support/mail";

// Slice 2 (docs/PLAN.md): sign-in by emailed link and by a 6-digit emailed code.
// Spec P2 (no passwords), P3 (new account starts empty with a first-run screen), check 2.

test("a visitor who is not signed in is sent to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to Founder HQ" })).toBeVisible();
});

test("signing in with the emailed 6-digit code opens the first-run screen", async ({ page }) => {
  const email = testEmail("code");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();

  const code = codeFrom(await latestEmailTo(email));
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Welcome to Founder HQ" })).toBeVisible();
});

test("signing in with the emailed link opens the first-run screen", async ({ page }) => {
  const email = testEmail("link");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();

  const link = linkFrom(await latestEmailTo(email));
  await page.goto(link.toString());
  await page.getByRole("button", { name: "Finish signing in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Welcome to Founder HQ" })).toBeVisible();
});

test("an email scanner opening the link first does not use it up", async ({ page, request }) => {
  const email = testEmail("scanner");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();

  const link = linkFrom(await latestEmailTo(email));
  // Scanners fetch links with a plain GET and no cookies.
  expect((await request.get(link.toString())).status()).toBe(200);

  await page.goto(link.toString());
  await page.getByRole("button", { name: "Finish signing in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Founder HQ" })).toBeVisible();
});

test("a used or broken link says so and offers a new code", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=email");
  await page.getByRole("button", { name: "Finish signing in" }).click();
  // Next.js adds its own empty route-announcer alert, so pick the one with the message.
  await expect(page.getByRole("alert").filter({ hasText: "This link has expired or was already used." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get a new code" })).toHaveAttribute("href", "/sign-in");
});
