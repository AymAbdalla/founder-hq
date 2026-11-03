import { expect, test } from "@playwright/test";
import { FAKE_GITHUB_ORIGIN } from "../support/fake-github";

// Slice 2 (docs/PLAN.md): sign-in with GitHub. Spec P2.
// These tests stop at the redirect that would go to GitHub. Local Supabase runs in fake-GitHub
// mode for tests (`npm run supabase:github-fake`), so that redirect points at the fake.
// github-sign-in-complete.spec.ts follows a sign-in all the way back to HQ.

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const FAILED = "GitHub sign-in didn't finish. Try again, or sign in with an emailed code.";

test("Continue with GitHub sends you to GitHub, set up to come back to HQ", async ({ page, context }) => {
  await page.goto("/sign-in");
  const link = page.getByRole("link", { name: "Continue with GitHub" });
  await expect(link).toHaveAttribute("href", "/auth/github");

  // Follow each hop by hand and stop before GitHub. (A browser click would load GitHub's
  // real page: Playwright cannot stub a page that is reached through a redirect.)
  // page.request shares the browser's cookies.
  const hq = await page.request.get("/auth/github", { maxRedirects: 0 });
  expect(hq.status()).toBe(307);

  // HQ asked Supabase to start a GitHub sign-in that returns to HQ's own callback,
  // with a one-time proof (PKCE) so a stolen return link is useless on its own.
  const start = new URL(hq.headers()["location"]);
  expect(start.origin + start.pathname).toBe(`${SUPABASE}/auth/v1/authorize`);
  expect(start.searchParams.get("provider")).toBe("github");
  expect(start.searchParams.get("redirect_to")).toBe("http://localhost:3100/auth/callback");
  expect(start.searchParams.get("code_challenge")).toBeTruthy();
  expect(start.searchParams.get("code_challenge_method")?.toLowerCase()).toBe("s256");

  // The one-time proof waits in a cookie that page scripts cannot read.
  const verifier = (await context.cookies("http://localhost:3100")).find((c) => c.name.endsWith("-code-verifier"));
  expect(verifier, "a code-verifier cookie").toBeDefined();
  expect(verifier!.httpOnly).toBe(true);

  // Supabase sends the browser on to GitHub's sign-in page (here the tests' fake) with HQ's GitHub app.
  const supabase = await page.request.get(start.toString(), { maxRedirects: 0 });
  expect(supabase.status()).toBe(302);
  const github = new URL(supabase.headers()["location"]);
  expect(github.origin, "local Supabase must be in fake-GitHub mode: npm run supabase:github-fake").toBe(FAKE_GITHUB_ORIGIN);
  expect(github.pathname).toBe("/login/oauth/authorize");
  expect(github.searchParams.get("client_id")).toBeTruthy();
  expect(github.searchParams.get("redirect_uri")).toBe(`${SUPABASE}/auth/v1/callback`);
});

for (const [label, query] of [
  ["with nothing", ""],
  ["after the person said no on GitHub", "?error=access_denied&error_description=Call%20555-0100%20to%20fix%20your%20account"],
  ["with a made-up code", "?code=not-a-real-code"],
  ["with a link that tries to send you elsewhere", "?code=not-a-real-code&next=https%3A%2F%2Fexample.com%2F"],
] as const) {
  test(`returning from GitHub ${label} leaves you signed out on HQ's sign-in page`, async ({ page, context }) => {
    await page.goto(`/auth/callback${query}`);

    await expect(page).toHaveURL(/^http:\/\/localhost:3100\/sign-in\?error=github$/);
    await expect(page.getByRole("alert").filter({ hasText: FAILED })).toBeVisible();
    // Text from the address bar is never shown, so nobody can plant a message on HQ's page.
    await expect(page.getByText("555-0100")).toHaveCount(0);
    const auth = (await context.cookies()).filter((c) => c.name.includes("auth-token") && !c.name.endsWith("-code-verifier"));
    expect(auth).toHaveLength(0);
  });
}
