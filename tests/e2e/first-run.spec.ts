import { expect, test } from "@playwright/test";
import { signInNewAccount } from "../support/session";

// Spec P3 and check 2: a new account starts empty, and a first-run screen gives three
// next steps: add a project, connect GitHub, add a first item.

test("a new account sees the first-run screen with three next steps and nothing else", async ({ page }) => {
  await signInNewAccount(page, "first-run");

  await expect(page.getByText("You have no projects or items yet.")).toBeVisible();
  const steps = page.getByRole("list", { name: "Next steps" }).getByRole("listitem");
  await expect(steps).toHaveText([/Add a project/, /Connect GitHub/, /Add your first item/]);
});

test("signing out ends the session", async ({ page }) => {
  await signInNewAccount(page, "sign-out");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});
