import { expect, test, type Page } from "@playwright/test";
import { signInNewAccount } from "../support/session";

// Plan step 2b: the app frame (side rail on a computer, top bar and bottom tabs on a
// phone), light and dark mode with a switch, and the placeholder views.

const VIEWS = [
  { path: "/", name: "Today" },
  { path: "/inbox", name: "Inbox" },
  { path: "/projects", name: "Projects" },
  { path: "/plans", name: "Plans" },
  { path: "/everything", name: "Everything" },
];
// Views still waiting for their plan step. Projects was built in slice 5, Inbox in slice 6,
// Everything in slice 8.
const PLACEHOLDERS = VIEWS.filter((v) => v.path === "/plans");
const SIGNED_IN_ONLY = VIEWS.slice(1);
const DARK_GROUND = "rgb(16, 19, 18)";
const LIGHT_GROUND = "rgb(255, 255, 255)";

async function watchPolicyViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("desktop: the main menu has five links and marks the current page", async ({ page }) => {
  await signInNewAccount(page, "frame-nav");
  for (const view of VIEWS) {
    await page.goto(view.path);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(VIEWS.map((v) => v.name));
    for (const v of VIEWS) await expect(nav.getByRole("link", { name: v.name })).toHaveAttribute("href", v.path);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: view.name })).toHaveAttribute("aria-current", "page");
  }
});

test("the placeholder pages have a title and say which step brings them", async ({ page }) => {
  await signInNewAccount(page, "frame-placeholders");
  const steps: Record<string, RegExp> = {
    "/plans": /step 12/,
  };
  for (const view of PLACEHOLDERS) {
    await page.goto(view.path);
    await expect(page.getByRole("heading", { level: 1, name: view.name })).toBeVisible();
    await expect(page.getByRole("main")).toContainText(steps[view.path]);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  }
});

test("signed-out visits to the placeholder pages go to sign-in", async ({ page }) => {
  for (const view of SIGNED_IN_ONLY) {
    await page.goto(view.path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

test("phone: bottom tabs show, the side rail is hidden, and nothing scrolls sideways", async ({ page }) => {
  await signInNewAccount(page, "frame-phone");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const tabs = page.getByRole("navigation", { name: "Main" });
  await expect(tabs.getByRole("link")).toHaveText(VIEWS.map((v) => v.name));
  const box = await tabs.boundingBox();
  expect(box!.y + box!.height, "tab bar sits at the bottom edge").toBeGreaterThan(844 - 4);
  // Only one menu is visible at a time, so the rail's menu is not in the page for a reader.
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);

  for (const path of [...VIEWS.map((v) => v.path), "/sign-in"]) {
    if (path === "/sign-in") await page.context().clearCookies();
    await page.goto(path);
    const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(scrollWidth, `${path} scrolls sideways`).toBeLessThanOrEqual(innerWidth);
  }
});

test.describe("dark mode follows the device", () => {
  test.use({ colorScheme: "dark" });
  test("the page background is the dark token", async ({ page }) => {
    await page.goto("/sign-in");
    expect(await background(page)).toBe(DARK_GROUND);
  });
});

test.describe("light device", () => {
  test.use({ colorScheme: "light" });

  test("the theme switch flips the theme and the choice survives a reload", async ({ page }) => {
    await signInNewAccount(page, "frame-theme");
    expect(await background(page)).toBe(LIGHT_GROUND);

    await page.getByRole("button", { name: /theme|dark mode|light mode/i }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background(page)).toBe(DARK_GROUND);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background(page)).toBe(DARK_GROUND);

    await page.getByRole("button", { name: /theme|dark mode|light mode/i }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    expect(await background(page)).toBe(LIGHT_GROUND);
  });
});

test("keyboard: Tab reaches the menu links and the focused link shows an outline", async ({ page }) => {
  await signInNewAccount(page, "frame-keys");
  await page.goto("/inbox");
  const nav = page.getByRole("navigation", { name: "Main" });
  const reached = new Set<string>();
  for (let i = 0; i < 12 && reached.size < VIEWS.length; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return { text: el.textContent?.trim() ?? "", inNav: !!el.closest("nav"), outline: `${s.outlineStyle} ${parseFloat(s.outlineWidth)}` };
    });
    if (info.inNav) {
      reached.add(info.text);
      expect(info.outline, `${info.text} focus outline`).toMatch(/^solid [1-9]/);
    }
  }
  expect([...reached].sort()).toEqual(VIEWS.map((v) => v.name).sort());
  await expect(nav.getByRole("link", { name: "Inbox" })).toBeVisible();
});

test("the frame pages run under the content policy without violations", async ({ page }) => {
  await signInNewAccount(page, "frame-csp");
  for (const view of VIEWS) {
    await watchPolicyViolations(page);
    await page.goto(view.path);
    await page.waitForLoadState("networkidle");
    // Press the theme switch too: it must not need an inline script or style.
    await page.getByRole("button", { name: /theme|dark mode|light mode/i }).first().click();
    expect(await violations(page), `${view.path} violations`).toEqual([]);
  }
  await page.context().clearCookies();
  await watchPolicyViolations(page);
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");
  expect(await violations(page)).toEqual([]);
});
