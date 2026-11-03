import { expect, test, type Locator, type Page } from "@playwright/test";
import { localSql, sqlText } from "../support/db";
import { signInNewAccount } from "../support/session";

// Plan slice 8: the views. Spec 3.4 (done-work grid), P14 to P20; checks 5, 13 (Everything
// part), 22 to 25, 27, 28 (keyboard part) and 61. VoiceOver (the rest of 28) is a manual run.

test.use({ timezoneId: "Europe/Berlin" });

const addBox = (page: Page) => page.getByRole("form", { name: "Add an item" });
const group = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const row = (scope: Locator, title: string) => scope.getByRole("listitem").filter({ hasText: title });

async function addItem(page: Page, item: { title: string; kind?: string; project?: string; date?: string }) {
  const box = addBox(page);
  await box.getByLabel("New item").fill(item.title);
  if (item.kind) await box.getByLabel("Kind").selectOption({ label: item.kind });
  if (item.project) await box.getByLabel("Project").selectOption({ label: item.project });
  if (item.date) await box.getByLabel("Date").fill(item.date);
  await box.getByRole("button", { name: "Add" }).click();
  await expect(box.getByRole("status")).toContainText(`Added “${item.title}”`);
}

async function newProject(page: Page, name: string) {
  await page.goto("/projects/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname;
}

async function addNotes(page: Page, scope: Locator, title: string, notes: string) {
  await row(scope, title).getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  const form = page.getByRole("form", { name: "Edit item" });
  await form.getByLabel("Notes").fill(notes);
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");
}

const browserDate = (page: Page, daysAhead = 0) =>
  page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString("en-CA");
  }, daysAhead);

const everything = (page: Page) => group(page, "Items");
async function showEverything(page: Page, f: { q?: string; kind?: string; status?: string; project?: string }) {
  const form = page.getByRole("search", { name: "Filter items" });
  await form.getByRole("searchbox", { name: "Search items" }).fill(f.q ?? "");
  await form.getByLabel("Kind").selectOption({ label: f.kind ?? "All kinds" });
  await form.getByLabel("Status").selectOption({ label: f.status ?? "Open and done" });
  await form.getByLabel("Project").selectOption({ label: f.project ?? "All projects" });
  await form.getByRole("button", { name: "Show" }).click();
  await page.waitForURL(/\/everything\?/);
}

test("each view says what to do next on a brand-new account (check 22)", async ({ page }) => {
  await signInNewAccount(page, "views-empty");
  await expect(page.getByText("You have no projects or items yet.")).toBeVisible();
  await page.goto("/inbox");
  await expect(page.getByText("Inbox is empty. Anything you add without a project lands here.")).toBeVisible();
  await page.goto("/projects");
  await expect(page.getByText("No projects yet.")).toBeVisible();
  await page.goto("/everything");
  await expect(page.getByRole("heading", { level: 1, name: "Everything" })).toBeVisible();
  await expect(page.getByText("Nothing here yet. Add items from Today, the Inbox or a project.")).toBeVisible();
});

test("an item due yesterday is overdue in Today; a dateless idea is only in Everything (check 23)", async ({ page }) => {
  await signInNewAccount(page, "views-today");
  await newProject(page, "Weekend Hauling");
  await page.goto("/");
  await addItem(page, { title: "Send the Friday invoices", project: "Weekend Hauling", date: await browserDate(page, -1) });
  await addItem(page, { title: "Offer gift cards", kind: "Idea", project: "Weekend Hauling" });
  await expect(row(group(page, "Overdue"), "Send the Friday invoices")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "Offer gift cards" })).toHaveCount(0);
  await page.goto("/everything");
  await expect(row(everything(page), "Offer gift cards")).toBeVisible();
});

test("assigning an Inbox item to a project moves it there (check 24)", async ({ page }) => {
  await signInNewAccount(page, "views-assign");
  const projectPage = await newProject(page, "Orbit");
  await page.goto("/inbox");
  await addItem(page, { title: "Sketch the onboarding" });
  const item = row(group(page, "To sort"), "Sketch the onboarding");
  await item.getByLabel("Move “Sketch the onboarding” to").selectOption({ label: "Orbit" });
  await item.getByRole("button", { name: "Move “Sketch the onboarding”" }).click();
  await expect(row(group(page, "To sort"), "Sketch the onboarding")).toHaveCount(0);
  await page.goto(projectPage);
  await expect(row(group(page, "To-dos and reminders"), "Sketch the onboarding")).toBeVisible();
});

test("Everything searches notes, and each filter narrows the list (check 25)", async ({ page }) => {
  await signInNewAccount(page, "views-everything");
  const fieldnotes = await newProject(page, "Fieldnotes");
  await addItem(page, { title: "Import old bookmarks" });
  await addItem(page, { title: "Reading streaks", kind: "Idea" });
  await addNotes(page, page.getByRole("main"), "Import old bookmarks", "Check the pinboard export too");
  await page.goto(fieldnotes);
  await addItem(page, { title: "Ship the share sheet", kind: "Feature" });
  await page.getByRole("checkbox", { name: "Done: Ship the share sheet" }).check();
  await expect(row(group(page, "Recently done"), "Ship the share sheet")).toBeVisible();
  await page.goto("/inbox");
  await addItem(page, { title: "Renew the domain" });

  await page.goto("/everything");
  await expect(everything(page).getByRole("listitem")).toHaveCount(4);
  await showEverything(page, { q: "pinboard" });
  await expect(everything(page).getByRole("listitem")).toHaveText([/Import old bookmarks/]);
  await showEverything(page, { kind: "Idea" });
  await expect(everything(page).getByRole("listitem")).toHaveText([/Reading streaks/]);
  await showEverything(page, { status: "Done" });
  await expect(everything(page).getByRole("listitem")).toHaveText([/Ship the share sheet/]);
  await showEverything(page, { project: "Inbox" });
  await expect(everything(page).getByRole("listitem")).toHaveText([/Renew the domain/]);
  await showEverything(page, { q: "zzz-nothing" });
  await expect(page.getByText("No items match these filters.")).toBeVisible();
});

test("an archived project's items are hidden from Today and found in Everything with the archived filter (check 13)", async ({ page }) => {
  await signInNewAccount(page, "views-archived");
  await newProject(page, "Old Shop");
  await addItem(page, { title: "Return the shop keys", date: await browserDate(page) });
  await newProject(page, "New Shop");
  await page.goto("/");
  await expect(row(group(page, "Today"), "Return the shop keys")).toBeVisible();

  await page.getByRole("navigation", { name: "Your projects" }).getByRole("link", { name: "Old Shop" }).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("main").getByText("Return the shop keys")).toHaveCount(0);
  await page.goto("/everything");
  await expect(page.getByRole("main").getByText("Return the shop keys")).toHaveCount(0);
  await showEverything(page, { project: "Archived projects" });
  await expect(everything(page).getByRole("listitem")).toHaveText([/Return the shop keys/]);
});

test("ticking items done fills today's square, the year count and the numbers (check 61)", async ({ page }) => {
  await signInNewAccount(page, "views-grid");
  await newProject(page, "Little Radio");
  const today = await browserDate(page);
  await page.goto("/");
  for (const title of ["Record the intro", "Edit episode one", "Upload the trailer"]) {
    await addItem(page, { title, project: "Little Radio", date: today });
  }
  const grid = page.getByRole("region", { name: "Done work" });
  const square = grid.locator("[data-today]");
  const month = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const monthRow = grid.getByRole("row").filter({ hasText: month });

  await expect(grid).toContainText("0 done in the last year");
  await expect(square).toHaveAttribute("data-l", "0");

  await page.getByRole("checkbox", { name: "Done: Record the intro" }).check();
  await expect(grid).toContainText("1 done in the last year");
  await expect(square).toHaveAttribute("data-l", "1");
  const numbers = grid.locator("details");
  const openNumbers = async () => {
    if (!(await numbers.evaluate((d) => (d as HTMLDetailsElement).open))) await grid.getByText("Show as numbers").click();
  };
  await openNumbers();
  await expect(monthRow.getByRole("cell").nth(1)).toHaveText("1");

  await page.getByRole("checkbox", { name: "Done: Edit episode one" }).check();
  await page.getByRole("checkbox", { name: "Done: Upload the trailer" }).check();
  await expect(grid).toContainText("3 done in the last year");
  await expect(square).toHaveAttribute("data-l", "2");
  await expect(grid.getByRole("img")).toHaveAttribute("aria-label", /3 done in the last year\. Today: 3\./);
  await openNumbers();
  await expect(monthRow.getByRole("cell").nth(1)).toHaveText("3");

  // The text version names each day and its count, not only the month (spec P20; check S8-F2).
  const dayLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  await expect(monthRow).toContainText(`${dayLabel}: 3`);
  await expect(grid.getByText("Days not listed had nothing done.")).toBeVisible();
});

test("a project's grid covers the whole year, and its 7-day strip names each day (check S8-F1, S8-F2)", async ({ page }) => {
  const email = await signInNewAccount(page, "views-project-year");
  const projectPage = await newProject(page, "Little Radio");
  const owner = `(select id from auth.users where email = ${sqlText(email)})`;
  // Done 200 days ago: older than 26 weeks, inside the year.
  localSql(`insert into public.items (account_id, project_id, title, done_at)
    values (${owner}, (select id from public.projects where account_id = ${owner}), 'Pilot episode', now() - interval '200 days')`);
  await addItem(page, { title: "Record the intro" });
  await page.getByRole("checkbox", { name: "Done: Record the intro" }).check();
  await expect(row(group(page, "Recently done"), "Record the intro")).toBeVisible();
  await page.goto(projectPage);
  await expect(page.getByRole("region", { name: "Done work" })).toContainText("2 done in the last year");

  const today = await browserDate(page);
  const dayLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  await page.goto("/projects");
  const strip = page.getByRole("table", { name: "Projects" }).getByRole("img", { name: /Last 7 days/ });
  await expect(strip).toHaveAttribute("aria-label", new RegExp(`${dayLabel}: 1`));
  await expect(strip).toHaveAttribute("aria-label", /(\w{3} \d{1,2}: \d+[,.] ?){7}/);
});

test("project rows show the next step, open items, latest done and the last 7 days", async ({ page }) => {
  await signInNewAccount(page, "views-rows");
  await newProject(page, "Weekend Hauling");
  await addItem(page, { title: "Have an idea", kind: "Idea" });
  await addItem(page, { title: "Book the dump run", date: await browserDate(page, 2) });
  await addItem(page, { title: "Wash the truck" });
  await page.getByRole("checkbox", { name: "Done: Wash the truck" }).check();
  await expect(row(group(page, "Recently done"), "Wash the truck")).toBeVisible();

  await page.goto("/projects");
  const projectRow = page.getByRole("table", { name: "Projects" }).getByRole("row").filter({ hasText: "Weekend Hauling" });
  await expect(projectRow.getByRole("cell").nth(1)).toHaveText("Book the dump run");
  await expect(projectRow.getByRole("cell").nth(2)).toHaveText("2");
  await expect(projectRow.getByRole("cell").nth(3)).toContainText("Wash the truck");
  await expect(projectRow.getByRole("img", { name: /Last 7 days: done items on 1 of 7 days/ })).toBeVisible();
});

test("account B's searches never return account A's projects or items (check 5)", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await signInNewAccount(a, "views-iso-a");
  await newProject(a, "Secret Garden A");
  await addItem(a, { title: "Private chore of A" });

  const b = await (await browser.newContext()).newPage();
  await signInNewAccount(b, "views-iso-b");
  await newProject(b, "Visible B");
  await b.goto("/everything?q=Private+chore");
  await expect(b.getByText("Private chore of A")).toHaveCount(0);
  await b.goto("/everything?q=Secret");
  await expect(b.getByText(/Secret Garden A/)).toHaveCount(0);
  await b.goto("/projects?q=Secret");
  await expect(b.getByText("Secret Garden A")).toHaveCount(0);
});

test("adding and ticking an item works with the keyboard alone (check 28, keyboard part)", async ({ page }) => {
  await signInNewAccount(page, "views-keys");
  await newProject(page, "Orbit");
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 10; i++) {
    if (await addBox(page).getByLabel("New item").evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(addBox(page).getByLabel("New item")).toBeFocused();
  await page.keyboard.type("Plan the launch week");
  await page.keyboard.press("Enter");
  await expect(addBox(page).getByRole("status")).toContainText("Added “Plan the launch week”");
  await expect(addBox(page).getByLabel("New item")).toBeFocused();

  const box = page.getByRole("checkbox", { name: "Done: Plan the launch week" });
  for (let i = 0; i < 25; i++) {
    if (await box.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(box).toBeFocused();
  await page.keyboard.press("Space");
  await expect(row(group(page, "Done today"), "Plan the launch week")).toBeVisible();
});

test("at 400px no view scrolls sideways, in light and dark mode (check 27)", async ({ page }) => {
  await signInNewAccount(page, "views-phone");
  await newProject(page, "A project with a long name for a small screen");
  await addItem(page, { title: "Something to do today", date: await browserDate(page) });
  await page.getByRole("checkbox", { name: "Done: Something to do today" }).check();
  await page.setViewportSize({ width: 400, height: 844 });
  for (const theme of ["light", "dark"]) {
    await page.context().addCookies([{ name: "hq-theme", value: theme, url: "http://localhost:3100" }]);
    for (const path of ["/", "/inbox", "/projects", "/everything", "/everything?status=done"]) {
      await page.goto(path);
      if (path === "/") await page.getByText("Show as numbers").click();
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${theme} ${path}`).toBeLessThanOrEqual(400);
    }
  }
});
