import { expect, test } from "@playwright/test";
import { signInNewAccount } from "../support/session";

// Security rule S1: cookies set so other sites cannot use them. HQ also hides them from
// page scripts, since every sign-in call runs on the server.

test("sign-in cookies are hidden from scripts, same-site only, and HTTPS only", async ({ page, context }) => {
  await signInNewAccount(page, "cookies");

  const auth = (await context.cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  expect(auth.length, "at least one sign-in cookie").toBeGreaterThan(0);
  for (const cookie of auth) {
    expect(cookie.httpOnly, `${cookie.name} httpOnly`).toBe(true);
    expect(cookie.sameSite, `${cookie.name} sameSite`).toBe("Lax");
    expect(cookie.secure, `${cookie.name} secure`).toBe(true);
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain("auth-token");
});
