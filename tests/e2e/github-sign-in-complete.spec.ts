import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { FAKE_GITHUB_ORIGIN, approveOnFakeGitHub, type FakeGitHubUser } from "../support/fake-github";
import { sqlRows, sqlText } from "../support/db";
import { testEmail } from "../support/mail";
import { signInNewAccount } from "../support/session";

// Slice 2 and security rule S5, spec P2; independent check finding F2. A GitHub sign-in
// followed all the way back to HQ, against the fake GitHub (needs `npm run supabase:github-fake`).
// P2: a verified GitHub email that matches an existing account joins it; an unverified one
// never does. This test found that local Supabase treated every email as verified while email
// confirmation was off; supabase/config.toml now keeps it on.

// Random ids, so test runs side by side never invent the same GitHub person.
const githubUser = (email: string, verified: boolean): FakeGitHubUser => {
  const id = randomInt(1, 2_000_000_000);
  return { id, login: `tester${id}`, email, verified };
};

// Walks the sign-in like a browser would, hop by hop, with the fake standing in for GitHub's
// page where the person says yes. Ends by opening the address Supabase sends back to HQ.
async function signInWithGitHub(page: Page, user: FakeGitHubUser) {
  await page.goto("/sign-in");
  const hq = await page.request.get("/auth/github", { maxRedirects: 0 });
  const supabase = await page.request.get(hq.headers()["location"], { maxRedirects: 0 });
  const github = new URL(supabase.headers()["location"]);
  if (github.origin !== FAKE_GITHUB_ORIGIN) {
    throw new Error("Local Supabase is using real GitHub. Run `npm run supabase:github-fake`, then try again.");
  }
  const back = new URL(github.searchParams.get("redirect_uri")!);
  back.searchParams.set("code", await approveOnFakeGitHub(user));
  back.searchParams.set("state", github.searchParams.get("state")!);
  const returned = await page.request.get(back.toString(), { maxRedirects: 0 });
  const toHq = returned.headers()["location"];
  expect(toHq, "Supabase sends the person back to HQ's own callback").toMatch(/^http:\/\/localhost:3100\/auth\/callback\?/);
  await page.goto(toHq);
}

const accountsWithEmail = (email: string) =>
  sqlRows(`select u.id, array_agg(i.provider order by i.provider) as providers
           from auth.users u join auth.identities i on i.user_id = u.id
           where lower(u.email) = lower(${sqlText(email)}) group by u.id`);
const ownerOfGitHub = (user: FakeGitHubUser) =>
  sqlRows(`select user_id from auth.identities where provider = 'github' and provider_id = ${sqlText(String(user.id))}`);

test("a first GitHub sign-in comes back to HQ signed in, on the first-run screen", async ({ page, context }) => {
  const email = testEmail("gh-new");
  await signInWithGitHub(page, githubUser(email, true));
  await expect(page).toHaveURL("http://localhost:3100/");
  await expect(page.getByRole("heading", { name: "Welcome to Founder HQ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeAttached();
  const session = (await context.cookies()).filter((c) => c.name.includes("auth-token") && !c.name.endsWith("-code-verifier"));
  expect(session.length).toBeGreaterThan(0);
  expect(accountsWithEmail(email)).toEqual([expect.objectContaining({ providers: ["github"] })]);
});

test("a GitHub account with a verified matching email joins the existing account", async ({ browser }) => {
  const emailPage = await (await browser.newContext()).newPage();
  const email = await signInNewAccount(emailPage, "gh-join");
  await emailPage.goto("/projects/new");
  await emailPage.getByLabel("Name").fill("Joined Proof");
  await emailPage.getByRole("button", { name: "Create project" }).click();
  await expect(emailPage.getByRole("heading", { level: 1, name: "Joined Proof" })).toBeVisible();

  const githubPage = await (await browser.newContext()).newPage();
  const user = githubUser(email, true);
  await signInWithGitHub(githubPage, user);
  await expect(githubPage.getByRole("navigation", { name: "Your projects" }).getByRole("link", { name: "Joined Proof" })).toBeVisible();

  const accounts = accountsWithEmail(email);
  expect(accounts).toEqual([expect.objectContaining({ providers: ["email", "github"] })]);
  expect(ownerOfGitHub(user)).toEqual([{ user_id: accounts[0].id }]);
});

test("a GitHub account whose matching email is not verified never joins the existing account", async ({ browser }) => {
  const emailPage = await (await browser.newContext()).newPage();
  const email = await signInNewAccount(emailPage, "gh-unverified");
  await emailPage.goto("/projects/new");
  await emailPage.getByLabel("Name").fill("Mine Only");
  await emailPage.getByRole("button", { name: "Create project" }).click();
  await expect(emailPage.getByRole("heading", { level: 1, name: "Mine Only" })).toBeVisible();
  const before = accountsWithEmail(email);
  expect(before).toEqual([expect.objectContaining({ providers: ["email"] })]);

  const githubPage = await (await browser.newContext()).newPage();
  const user = githubUser(email, false);
  await signInWithGitHub(githubPage, user);

  // Spec P2: it gets a separate account, which Supabase will not sign in until the email is
  // verified on GitHub, so the person sees why. It never joins the existing account.
  // (The browser keeps Supabase's "#…" part on the address; HQ never reads or shows it.)
  await expect(githubPage).toHaveURL(/^http:\/\/localhost:3100\/sign-in\?error=github-email(#.*)?$/);
  const unverified = "GitHub says that email address isn't verified yet. Verify it on GitHub, then try again, or sign in with an emailed code.";
  await expect(githubPage.getByRole("alert").filter({ hasText: unverified })).toHaveText(unverified);
  await githubPage.goto("/");
  await expect(githubPage).toHaveURL(/\/sign-in$/);
  await expect(githubPage.getByText("Mine Only")).toHaveCount(0);
  expect(accountsWithEmail(email)).toEqual([expect.objectContaining({ id: before[0].id, providers: ["email"] })]);
  // Supabase keeps the GitHub login on a separate account with no email, which cannot sign in
  // until the email is verified on GitHub.
  const owner = ownerOfGitHub(user);
  expect(owner).toHaveLength(1);
  expect(owner[0].user_id).not.toBe(before[0].id);
  expect(sqlRows(`select email is null as no_email, email_confirmed_at is null as unconfirmed from auth.users where id = ${sqlText(String(owner[0].user_id))}`)).toEqual([
    { no_email: true, unconfirmed: true },
  ]);
});
