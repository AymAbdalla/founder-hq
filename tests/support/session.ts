import { expect, type Page } from "@playwright/test";
import { codeFrom, latestEmailTo, testEmail } from "./mail";

// Signs a brand-new test account in through the real sign-in page. Returns its email.
export async function signInNewAccount(page: Page, label: string): Promise<string> {
  const email = testEmail(label);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByText(`We sent a code to ${email}`)).toBeVisible();
  await page.getByLabel("6-digit code").fill(codeFrom(await latestEmailTo(email)));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Founder HQ" })).toBeVisible();
  return email;
}
