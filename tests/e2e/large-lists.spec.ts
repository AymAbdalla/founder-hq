import { expect, test } from "@playwright/test";
import { localSql, sqlText } from "../support/db";
import { signInNewAccount } from "../support/session";

// Independent check F4: the database hands back at most 1,000 rows per request, so lists
// must fetch every page. Rows are inserted directly into the local test database for one
// fresh fictional account; every view must still show all 1,001.

const owner = (email: string) => `(select id from auth.users where email = ${sqlText(email)})`;

test("1,001 items, waiting links and projects all show; none are silently left out", async ({ page }) => {
  test.setTimeout(90_000);
  const email = await signInNewAccount(page, "big-lists");
  localSql(`insert into public.projects (account_id, name) values (${owner(email)}, 'Big Project')`);
  localSql(
    `insert into public.items (account_id, project_id, title)
     select ${owner(email)}, (select id from public.projects where name = 'Big Project' and account_id = ${owner(email)}), 'Record ' || lpad(g::text, 4, '0')
     from generate_series(1, 1001) g`,
  );
  localSql(`insert into public.items (account_id, title) values (${owner(email)}, 'Waits on everything')`);
  localSql(
    `insert into public.item_waits (account_id, item_id, waits_on_id)
     select ${owner(email)}, w.id, r.id from public.items w, public.items r
     where w.account_id = ${owner(email)} and w.title = 'Waits on everything' and r.account_id = ${owner(email)} and r.title like 'Record %'`,
  );
  localSql(`insert into public.projects (account_id, name) select ${owner(email)}, 'Extra ' || lpad(g::text, 4, '0') from generate_series(1, 1000) g`);

  await page.goto("/projects");
  await expect(page.getByRole("navigation", { name: "Status" }).getByRole("link", { name: /Active/ })).toContainText("1001");
  await page.getByRole("searchbox", { name: "Find a project" }).fill("Extra 1000");
  await page.getByRole("searchbox", { name: "Find a project" }).press("Enter");
  await expect(page.getByRole("table", { name: "Projects" }).getByRole("link", { name: "Extra 1000" })).toBeVisible();

  await page.goto("/projects");
  await page.getByRole("table", { name: "Projects" }).getByRole("link", { name: "Big Project" }).click();
  const todos = page.getByRole("region", { name: "To-dos and reminders" });
  await expect(todos.getByRole("heading")).toContainText("1001");
  await expect(todos.getByRole("listitem")).toHaveCount(1001);
  await expect(todos.getByRole("link", { name: "Record 1001" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("region", { name: "No date" }).getByRole("listitem")).toHaveCount(1001);

  await page.goto("/inbox");
  await page.getByRole("link", { name: "Waits on everything" }).click();
  await expect(page.getByRole("region", { name: "Waiting on" }).getByRole("listitem")).toHaveCount(1001);
});
