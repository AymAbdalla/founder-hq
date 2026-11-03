import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInNewAccount } from "../support/session";

// Plan slice 6: items and the add box. Spec 3.3 (P10 to P12, "Waiting on"), P8 (deleting a
// project with items), P7 (archived projects leave the pickers), P48 (a failed save keeps
// the typed text). Checks 13 (picker part), 14, 16 to 20, 58 and 59.

// A zone far from UTC, so "today" must come from the browser's time zone, not the server's.
test.use({ timezoneId: "Pacific/Auckland" });

type NewItem = { title: string; kind?: string; project?: string; date?: string; time?: string };

const addBox = (page: Page) => page.getByRole("form", { name: "Add an item" });

async function addItem(page: Page, item: NewItem) {
  const box = addBox(page);
  await box.getByLabel("New item").fill(item.title);
  if (item.kind) await box.getByLabel("Kind").selectOption({ label: item.kind });
  if (item.project) await box.getByLabel("Project").selectOption({ label: item.project });
  if (item.date) await box.getByLabel("Date").fill(item.date);
  if (item.time) await box.getByLabel("Time").fill(item.time);
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

// The browser's own calendar date, independent of HQ's code.
const browserDate = (page: Page, daysAhead = 0) =>
  page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString("en-CA");
  }, daysAhead);

const group = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const row = (scope: Locator, title: string) => scope.getByRole("listitem").filter({ hasText: title });
const tick = (page: Page, title: string) => page.getByRole("checkbox", { name: `Done: ${title}` });
const alert = (scope: Page | Locator, text: string | RegExp) => scope.getByRole("alert").filter({ hasText: text });

// Opens an item from a list and waits for its page, so the next step acts on the item page.
async function openItem(page: Page, scope: Locator, title: string) {
  await row(scope, title).getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
}

test("a to-do with project, date and time shows under its project and in Today (check 16)", async ({ page }) => {
  await signInNewAccount(page, "items-add");
  const projectPage = await newProject(page, "Weekend Hauling");
  const today = await browserDate(page);
  const tomorrow = await browserDate(page, 1);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await addItem(page, { title: "Call the dump about rates", project: "Weekend Hauling", date: today, time: "14:00" });
  await addItem(page, { title: "Price a second trailer", project: "Weekend Hauling", date: tomorrow });

  await expect(row(group(page, "Today"), "Call the dump about rates")).toContainText("Weekend Hauling");
  await expect(row(group(page, "Today"), "Call the dump about rates")).toContainText("14:00");
  await expect(row(group(page, "Today"), "Price a second trailer")).toHaveCount(0);
  await expect(row(group(page, "Next 7 days"), "Price a second trailer")).toBeVisible();

  await page.goto(projectPage);
  const todos = group(page, "To-dos and reminders");
  await expect(row(todos, "Call the dump about rates")).toBeVisible();
  await expect(row(todos, "Price a second trailer")).toBeVisible();
});

test("the add box on a project page files the item under that project", async ({ page }) => {
  await signInNewAccount(page, "items-projectbox");
  await newProject(page, "Little Radio");
  await expect(addBox(page).getByLabel("Project")).toHaveValue(/[0-9a-f-]{36}/);
  await addItem(page, { title: "Record the intro", kind: "Idea" });
  await expect(row(group(page, "Ideas"), "Record the intro")).toBeVisible();
  await addItem(page, { title: "Episode list page", kind: "Feature" });
  await expect(row(group(page, "Features"), "Episode list page")).toBeVisible();
});

test("“New project…” in the add box creates the project and files the item in it (check 17)", async ({ page }) => {
  await signInNewAccount(page, "items-newproject");
  await newProject(page, "Orbit");
  await page.goto("/");
  const box = addBox(page);
  await box.getByLabel("New item").fill("Book a stall for Saturday");
  await box.getByLabel("Project").selectOption({ label: "New project…" });
  await box.getByLabel("New project name").fill("Garage Sale");
  await box.getByRole("button", { name: "Add" }).click();
  await expect(box.getByRole("status")).toContainText("Added “Book a stall for Saturday”");

  const menu = page.getByRole("navigation", { name: "Your projects" });
  await menu.getByRole("link", { name: "Garage Sale" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Garage Sale" })).toBeVisible();
  await expect(row(group(page, "To-dos and reminders"), "Book a stall for Saturday")).toBeVisible();
});

test("a reminder with no date and an item with no title are refused, and nothing is saved (check 18)", async ({ page }) => {
  await signInNewAccount(page, "items-refused");
  await newProject(page, "Tidepool");
  await page.goto("/inbox");
  const box = addBox(page);

  await box.getByLabel("New item").fill("Renew the van insurance");
  await box.getByLabel("Kind").selectOption({ label: "Reminder" });
  await box.getByRole("button", { name: "Add" }).click();
  await expect(alert(box, "A reminder needs a date.")).toBeVisible();
  await expect(box.getByLabel("New item")).toHaveValue("Renew the van insurance");

  await box.getByLabel("New item").fill("   ");
  await box.getByLabel("Kind").selectOption({ label: "To-do" });
  await box.getByRole("button", { name: "Add" }).click();
  await expect(alert(box, "Give the item a title.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Renew the van insurance")).toHaveCount(0);
  await expect(page.getByText(/Inbox is empty/)).toBeVisible();
});

test("tick, reopen, edit and move an item; each change survives a reload (check 19)", async ({ page }) => {
  await signInNewAccount(page, "items-change");
  const projectPage = await newProject(page, "Fieldnotes");
  await addItem(page, { title: "Write the import script" });
  const todos = group(page, "To-dos and reminders");

  await tick(page, "Write the import script").check();
  await expect(row(group(page, "Recently done"), "Write the import script")).toBeVisible();
  await page.reload();
  await expect(tick(page, "Write the import script")).toBeChecked();
  await expect(row(todos, "Write the import script")).toHaveCount(0);

  await tick(page, "Write the import script").uncheck();
  await expect(row(todos, "Write the import script")).toBeVisible();
  await page.reload();
  await expect(tick(page, "Write the import script")).not.toBeChecked();

  await openItem(page, todos, "Write the import script");
  await expect(page.getByRole("heading", { level: 1, name: "Write the import script" })).toBeVisible();
  const form = page.getByRole("form", { name: "Edit item" });
  await form.getByLabel("Title").fill("Write the import script for v2");
  await form.getByLabel("Notes").fill("Handle the old export format too.");
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Write the import script for v2" })).toBeVisible();
  await page.reload();
  await expect(form.getByLabel("Notes")).toHaveValue("Handle the old export format too.");

  await form.getByLabel("Project").selectOption({ label: "No project (Inbox)" });
  await form.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Inbox");
  await page.goto("/inbox");
  await expect(row(group(page, "To sort"), "Write the import script for v2")).toBeVisible();
  await page.goto(projectPage);
  await expect(page.getByText("Write the import script for v2")).toHaveCount(0);
});

test("deleting an item asks first; cancel keeps it and confirm removes it (check 20)", async ({ page }) => {
  await signInNewAccount(page, "items-delete");
  const projectPage = await newProject(page, "Paper Plane");
  await addItem(page, { title: "Fold the test batch" });
  await openItem(page, group(page, "To-dos and reminders"), "Fold the test batch");

  await page.getByRole("link", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Delete “Fold the test batch”?" })).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Fold the test batch" })).toBeVisible();

  await page.getByRole("link", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page).toHaveURL(new RegExp(`${projectPage}$`));
  await expect(page.getByText("Fold the test batch")).toHaveCount(0);
});

test("an item waiting on another stays out of Today until that one is done (check 59)", async ({ page }) => {
  await signInNewAccount(page, "items-waiting");
  await newProject(page, "Weekend Hauling");
  const today = await browserDate(page);
  await page.goto("/");
  await addItem(page, { title: "Load the truck", project: "Weekend Hauling", date: today });
  await addItem(page, { title: "Pick up the keys", project: "Weekend Hauling", date: today });

  await openItem(page, group(page, "Today"), "Load the truck");
  const waits = page.getByRole("region", { name: "Waiting on" });
  await expect(waits).toContainText("Not waiting on anything.");
  await waits.getByLabel("Item to wait on").selectOption({ label: "Pick up the keys" });
  await waits.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Waiting on: Pick up the keys")).toBeVisible();

  await page.goto("/");
  await expect(row(group(page, "Today"), "Load the truck")).toHaveCount(0);
  await expect(row(group(page, "Today"), "Pick up the keys")).toBeVisible();

  await page.getByRole("navigation", { name: "Your projects" }).getByRole("link", { name: "Weekend Hauling" }).click();
  await expect(row(group(page, "To-dos and reminders"), "Load the truck")).toContainText("Waiting on: Pick up the keys");

  await page.goto("/");
  await tick(page, "Pick up the keys").check();
  await expect(row(group(page, "Today"), "Load the truck")).toBeVisible();
  await page.reload();
  await expect(row(group(page, "Today"), "Load the truck")).toBeVisible();
  await expect(row(group(page, "Today"), "Load the truck")).not.toContainText("Waiting on");
});

test("two items can't wait on each other", async ({ page }) => {
  await signInNewAccount(page, "items-cycle");
  await newProject(page, "Orbit");
  await addItem(page, { title: "Design the logo" });
  await addItem(page, { title: "Print the stickers" });
  const todos = group(page, "To-dos and reminders");

  await openItem(page, todos, "Print the stickers");
  await page.getByRole("region", { name: "Waiting on" }).getByLabel("Item to wait on").selectOption({ label: "Design the logo" });
  await page.getByRole("region", { name: "Waiting on" }).getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Waiting on: Design the logo")).toBeVisible();

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Orbit" }).click();
  await openItem(page, todos, "Design the logo");
  await page.getByRole("region", { name: "Waiting on" }).getByLabel("Item to wait on").selectOption({ label: "Print the stickers" });
  await page.getByRole("region", { name: "Waiting on" }).getByRole("button", { name: "Add" }).click();
  await expect(alert(page, "That would make these items wait on each other.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Waiting on" })).toContainText("Not waiting on anything.");
});

test("deleting a project asks what happens to its items; moving them sends them to the Inbox (check 14)", async ({ page }) => {
  await signInNewAccount(page, "items-projdelete");
  await newProject(page, "Paper Plane");
  await addItem(page, { title: "Buy heavier paper" });
  await addItem(page, { title: "Test the long fold", kind: "Idea" });

  await page.getByRole("link", { name: "Delete" }).click();
  await expect(page.getByRole("group", { name: /its 2 items/ })).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(row(group(page, "To-dos and reminders"), "Buy heavier paper")).toBeVisible();

  await page.getByRole("link", { name: "Delete" }).click();
  await expect(page.getByLabel("Move them to the Inbox")).toBeChecked();
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/inbox");
  await expect(row(group(page, "To sort"), "Buy heavier paper")).toBeVisible();
  await expect(row(group(page, "To sort"), "Test the long fold")).toBeVisible();
});

test("deleting a project with “delete them too” removes its items", async ({ page }) => {
  await signInNewAccount(page, "items-projdelete-all");
  await newProject(page, "Sidecar");
  await addItem(page, { title: "Sketch the case" });
  await page.getByRole("link", { name: "Delete" }).click();
  await page.getByLabel("Delete them too").check();
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/inbox");
  await expect(page.getByText("Sketch the case")).toHaveCount(0);
});

test("archived projects leave the add box's project picker (check 13, picker part)", async ({ page }) => {
  await signInNewAccount(page, "items-archived");
  await newProject(page, "Old Shop");
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await newProject(page, "New Shop");
  await page.goto("/");
  const options = addBox(page).getByLabel("Project").locator("option");
  await expect(options).toContainText(["New Shop"]);
  await expect(options.filter({ hasText: "Old Shop" })).toHaveCount(0);
});

test("adding while offline says it was not saved and keeps the typed text (check 58)", async ({ page, context }) => {
  await signInNewAccount(page, "items-offline");
  await newProject(page, "Tidepool");
  await page.goto("/inbox");
  const box = addBox(page);
  await box.getByLabel("New item").fill("Typed while the network was down");
  await context.setOffline(true);
  await box.getByRole("button", { name: "Add" }).click();
  await expect(alert(box, /not saved/i)).toBeVisible();
  await expect(box.getByLabel("New item")).toHaveValue("Typed while the network was down");
  await context.setOffline(false);
  await box.getByRole("button", { name: "Add" }).click();
  await expect(row(group(page, "To sort"), "Typed while the network was down")).toBeVisible();
});

test("account B never sees account A's items, even with the address", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await signInNewAccount(a, "items-iso-a");
  await a.goto("/inbox");
  await addItem(a, { title: "Private note from A" });
  await openItem(a, group(a, "To sort"), "Private note from A");
  const address = new URL(a.url()).pathname;

  const b = await (await browser.newContext()).newPage();
  await signInNewAccount(b, "items-iso-b");
  for (const path of ["/", "/inbox"]) {
    await b.goto(path);
    await expect(b.getByText("Private note from A")).toHaveCount(0);
  }
  for (const path of [address, address + "/delete", "/items/not-a-real-id"]) {
    await b.goto(path);
    await expect(b.getByRole("heading", { name: "Item not found" })).toBeVisible();
    await expect(b.getByText("Private note from A")).toHaveCount(0);
  }
});

test("at phone width the item pages do not scroll sideways", async ({ page }) => {
  await signInNewAccount(page, "items-phone");
  const projectPage = await newProject(page, "A project with quite a long name for a phone");
  await addItem(page, { title: "An item title that is long enough to need wrapping on a small phone screen" });
  await openItem(page, group(page, "To-dos and reminders"), "An item title that is long enough to need wrapping on a small phone screen");
  const itemPage = new URL(page.url()).pathname;
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/inbox", projectPage, projectPage + "/delete", itemPage, itemPage + "/delete"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
});

test("after an add, the add box starts fresh, so the next item doesn't land in the last project", async ({ page }) => {
  await signInNewAccount(page, "items-fresh");
  await newProject(page, "Orbit");
  await page.goto("/");
  const box = addBox(page);
  await addItem(page, { title: "Draft the launch post", project: "Orbit" });
  await expect(box.getByRole("status")).toHaveText("Added “Draft the launch post” to Orbit.");
  await expect(box.getByLabel("Project")).toHaveValue("");
  await addItem(page, { title: "Call the accountant" });
  await expect(box.getByRole("status")).toHaveText("Added “Call the accountant” to the Inbox.");
  await page.goto("/inbox");
  await expect(row(group(page, "To sort"), "Call the accountant")).toBeVisible();
});

test("a longest-allowed item title and project name with no spaces fit a 400px screen (independent check F3)", async ({ page }) => {
  await signInNewAccount(page, "items-longtitle");
  const projectPage = await newProject(page, "W".repeat(80));
  const title = "T".repeat(200);
  await addItem(page, { title });
  await openItem(page, group(page, "To-dos and reminders"), title);
  const itemPage = new URL(page.url()).pathname;
  await page.goto("/");
  await addItem(page, { title: "Inbox item", date: await browserDate(page) });
  await page.setViewportSize({ width: 400, height: 844 });
  for (const path of ["/", "/inbox", projectPage, projectPage + "/delete", itemPage, itemPage + "/delete"]) {
    await page.goto(path);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, path).toBeLessThanOrEqual(400);
  }
});
