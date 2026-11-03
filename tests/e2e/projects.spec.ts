import { expect, test, type Page } from "@playwright/test";
import { signInNewAccount } from "../support/session";

// Plan slice 5: Projects. Spec 3.2 (P6 to P9), P16 (one row per project, status tabs, search),
// P48 (a failed save keeps what was typed), checks 4, 13 (data part), 58 and 60.

async function newProject(page: Page, fields: { name: string; kind?: string; summary?: string }) {
  await page.goto("/projects/new");
  await page.getByLabel("Name").fill(fields.name);
  if (fields.kind) await page.getByLabel("Kind").fill(fields.kind);
  if (fields.summary) await page.getByLabel("Summary").fill(fields.summary);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { level: 1, name: fields.name })).toBeVisible();
}
const projectRows = (page: Page) => page.getByRole("table", { name: "Projects" }).getByRole("row").filter({ has: page.getByRole("link") });
const alert = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text });

test("a new account sees an empty projects page that says how to start", async ({ page }) => {
  await signInNewAccount(page, "proj-empty");
  await page.goto("/projects");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(page.getByText("No projects yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "New project" })).toHaveAttribute("href", "/projects/new");
});

test("creating a project opens its page and lists it under Active and in the side menu", async ({ page }) => {
  await signInNewAccount(page, "proj-create");
  await newProject(page, { name: "Weekend Hauling", kind: "Business", summary: "Second truck and a driver" });
  await expect(page.getByText("Second truck and a driver")).toBeVisible();
  await expect(page.getByText("Business")).toBeVisible();

  await page.goto("/projects");
  await expect(page.getByRole("navigation", { name: "Status" }).getByRole("link", { name: /Active/ })).toHaveAttribute("aria-current", "page");
  await expect(projectRows(page)).toHaveCount(1);
  await expect(projectRows(page).first()).toContainText("Weekend Hauling");
  await expect(projectRows(page).first()).toContainText("Second truck and a driver");
  await expect(page.getByRole("navigation", { name: "Your projects" }).getByRole("link", { name: "Weekend Hauling" })).toBeVisible();
});

test("a project with no name is refused and the typed text stays", async ({ page }) => {
  await signInNewAccount(page, "proj-noname");
  await page.goto("/projects/new");
  await page.getByLabel("Summary").fill("Notes I do not want to retype");
  await page.getByLabel("Name").fill("   ");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(alert(page, "Give the project a name.")).toBeVisible();
  await expect(page.getByLabel("Summary")).toHaveValue("Notes I do not want to retype");
  await page.goto("/projects");
  await expect(page.getByText("No projects yet.")).toBeVisible();
});

test("a second project with the same name is refused with a plain message", async ({ page }) => {
  await signInNewAccount(page, "proj-dup");
  await newProject(page, { name: "Orbit" });
  await page.goto("/projects/new");
  await page.getByLabel("Name").fill(" orbit ");
  await page.getByLabel("Summary").fill("Kept after the error");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(alert(page, "You already have a project with that name.")).toBeVisible();
  await expect(page.getByLabel("Summary")).toHaveValue("Kept after the error");
});

test("editing a project keeps the change after a reload", async ({ page }) => {
  await signInNewAccount(page, "proj-edit");
  await newProject(page, { name: "Fieldnotes", summary: "Old summary" });
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Name").fill("Fieldnotes 2");
  await page.getByLabel("Summary").fill("Save links while you read");
  await page.getByLabel("Notes").fill("First release in December.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fieldnotes 2" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Fieldnotes 2" })).toBeVisible();
  await expect(page.getByText("Save links while you read")).toBeVisible();
  await expect(page.getByText("First release in December.")).toBeVisible();
});

test("pausing, archiving and reopening move a project between the status tabs (check 13, data part)", async ({ page }) => {
  await signInNewAccount(page, "proj-status");
  await newProject(page, { name: "Sidecar" });
  const menu = page.getByRole("navigation", { name: "Your projects" });

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await page.goto("/projects?status=paused");
  await expect(projectRows(page)).toHaveCount(1);
  await page.goto("/projects");
  await expect(projectRows(page)).toHaveCount(0);

  await page.goto("/projects?status=paused");
  await projectRows(page).first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Sidecar" })).toHaveCount(0);
  await page.goto("/projects?status=archived");
  await expect(projectRows(page)).toHaveCount(1);

  await projectRows(page).first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();
  await page.goto("/projects");
  await expect(projectRows(page)).toHaveCount(1);
  await expect(menu.getByRole("link", { name: "Sidecar" })).toBeVisible();
});

test("deleting asks first; cancel keeps the project and confirm removes it", async ({ page }) => {
  await signInNewAccount(page, "proj-delete");
  await newProject(page, { name: "Paper Plane" });
  await page.getByRole("link", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete Paper Plane?" })).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Paper Plane" })).toBeVisible();

  await page.getByRole("link", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByText("No projects yet.")).toBeVisible();
});

test("account B never sees account A's project, even with its address (check 4)", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await signInNewAccount(a, "proj-iso-a");
  await newProject(a, { name: "Private Plans A" });
  const address = new URL(a.url()).pathname;

  const b = await (await browser.newContext()).newPage();
  await signInNewAccount(b, "proj-iso-b");
  await b.goto("/projects");
  await expect(b.getByText("Private Plans A")).toHaveCount(0);
  await b.goto(address);
  await expect(b.getByRole("heading", { name: "Project not found" })).toBeVisible();
  await expect(b.getByText("Private Plans A")).toHaveCount(0);
  await b.goto(address + "/edit");
  await expect(b.getByRole("heading", { name: "Project not found" })).toBeVisible();
  await b.goto("/projects/not-a-real-id");
  await expect(b.getByRole("heading", { name: "Project not found" })).toBeVisible();
});

test("a project without a repo shows no empty GitHub fields (check 60)", async ({ page }) => {
  await signInNewAccount(page, "proj-norepo");
  await newProject(page, { name: "Little Radio" });
  const main = page.getByRole("main");
  for (const word of [/repo/i, /branch/i, /commit/i, /not linked/i, /github/i]) await expect(main.getByText(word)).toHaveCount(0);
  await page.goto("/projects");
  for (const word of [/repo/i, /branch/i, /commit/i, /not linked/i]) await expect(page.getByRole("main").getByText(word)).toHaveCount(0);
});

test("saving while offline says it was not saved and keeps the typed text (check 58)", async ({ page, context }) => {
  await signInNewAccount(page, "proj-offline");
  await newProject(page, { name: "Tidepool" });
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Summary").fill("Typed while the network was down");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(alert(page, /not saved/i)).toBeVisible();
  await expect(page.getByLabel("Summary")).toHaveValue("Typed while the network was down");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Typed while the network was down")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Tidepool" })).toBeVisible();
});

test("search narrows the list and says when nothing matches", async ({ page }) => {
  await signInNewAccount(page, "proj-search");
  await newProject(page, { name: "Orbit", summary: "Weekly planner" });
  await newProject(page, { name: "Tidepool", summary: "Shared grocery list" });
  await page.goto("/projects");
  await page.getByRole("searchbox", { name: "Find a project" }).fill("grocery");
  await page.getByRole("searchbox", { name: "Find a project" }).press("Enter");
  await expect(projectRows(page)).toHaveCount(1);
  await expect(projectRows(page).first()).toContainText("Tidepool");
  await page.getByRole("searchbox", { name: "Find a project" }).fill("zzz");
  await page.getByRole("searchbox", { name: "Find a project" }).press("Enter");
  await expect(page.getByText(/No active project matches/)).toBeVisible();
});

test("at phone width the projects pages do not scroll sideways", async ({ page }) => {
  await signInNewAccount(page, "proj-phone");
  await newProject(page, { name: "A project with quite a long name for a phone", summary: "And a summary that is long enough to wrap onto a second line on a phone" });
  const projectPage = new URL(page.url()).pathname;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/projects", "/projects/new", projectPage, projectPage + "/edit", projectPage + "/delete"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
});

test("a longest-allowed project name with no spaces still fits a 400px screen (independent check F3)", async ({ page }) => {
  await signInNewAccount(page, "proj-longname");
  const name = "W".repeat(80);
  await newProject(page, { name, summary: "S".repeat(200) });
  const projectPage = new URL(page.url()).pathname;
  await page.setViewportSize({ width: 400, height: 844 });
  for (const theme of ["light", "dark"]) {
    await page.context().addCookies([{ name: "hq-theme", value: theme, url: page.url() }]);
    for (const path of ["/projects", projectPage, projectPage + "/edit", projectPage + "/delete"]) {
      await page.goto(path);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${theme} ${path}`).toBeLessThanOrEqual(400);
    }
  }
});
