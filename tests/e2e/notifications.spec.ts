import { expect, test } from "@playwright/test";
import { localSql, sqlText } from "../support/db";
import { signInNewAccount } from "../support/session";

// Plan slice 3: installable HQ and the notification path, as far as a test browser can go.
// Checks 29 and 30 (install) and 32 (a real notification on an iPhone) are Aym's manual runs
// on the hosted copy; the device sign-up rules (S6) are in tests/integration.

const SECRET = process.env.HQ_TEST_CRON_SECRET!;

test("HQ can be installed: manifest, icons and the iPhone Home Screen tags", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Founder HQ", short_name: "HQ", start_url: "/", display: "standalone" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  for (const icon of [...manifest.icons.map((i: { src: string }) => i.src), "/icons/apple-touch-icon.png"]) {
    const response = await request.get(icon);
    expect(response.status(), icon).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  await page.goto("/sign-in");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
});

test("the service worker is served fresh and registers under the content policy", async ({ page, request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  await page.goto("/sign-in");
  const csp = (await page.request.get("/sign-in")).headers()["content-security-policy"];
  expect(csp).toContain("worker-src 'self'");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.register("/sw.js", { scope: "/" })).scope);
  expect(scope).toBe("http://localhost:3100/");
});

test("when this browser blocks notifications, the page says so plainly", async ({ page }) => {
  await signInNewAccount(page, "notify-blocked");
  await page.goto("/notifications");
  await expect(page.getByText("Notifications are blocked for HQ in this browser's settings. Allow them there, then reload this page.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on notifications on this device" })).toHaveCount(0);
});

test("the Notifications page offers to turn them on and sends a test through the job", async ({ page }) => {
  // The headless test browser reports notifications as blocked even when allowed, so it is
  // told to report "not asked yet", the state a new phone or computer starts in.
  await page.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "default" }));
  const email = await signInNewAccount(page, "notify-page");
  await page.getByRole("link", { name: "Notifications" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.getByText("Notifications are on for 0 devices.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on notifications on this device" })).toBeVisible();

  await page.getByRole("button", { name: "Send a test notification in 1 minute" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Test scheduled" })).toBeVisible();
  const tests = page.getByRole("region", { name: "Recent tests" });
  await expect(tests.getByRole("listitem")).toHaveText([/Waiting/]);

  // Make it due now, then run the job the way the database's scheduler does.
  localSql(`update public.test_notifications set due_at = now() - interval '1 second'
            where account_id = (select id from auth.users where email = ${sqlText(email)})`);
  const run = await page.request.post("/api/notify", { headers: { authorization: `Bearer ${SECRET}` } });
  expect(run.status()).toBe(200);
  await page.reload();
  await expect(tests.getByRole("listitem")).toHaveText([/Nothing sent: no device has notifications turned on/]);
});

test("only the scheduler, with the secret, can run the notification job", async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: "http://localhost:3100" });
  expect((await api.post("/api/notify")).status()).toBe(401);
  expect((await api.post("/api/notify", { headers: { authorization: "Bearer wrong-secret" } })).status()).toBe(401);
  expect((await api.post("/api/notify", { headers: { authorization: SECRET } })).status()).toBe(401);
  expect((await api.get("/api/notify")).status()).toBe(405);
  expect((await api.post("/api/notify", { headers: { authorization: `Bearer ${SECRET}` } })).status()).toBe(200);
  await api.dispose();
});

test("a three-test limit, then a plain message", async ({ page }) => {
  await signInNewAccount(page, "notify-limit");
  await page.goto("/notifications");
  const send = page.getByRole("button", { name: "Send a test notification in 1 minute" });
  for (let i = 0; i < 3; i++) {
    await send.click();
    await expect(page.getByRole("region", { name: "Recent tests" }).getByRole("listitem")).toHaveCount(i + 1);
  }
  await send.click();
  await expect(page.getByRole("alert").filter({ hasText: "Three tests are already waiting. Wait for them first." })).toBeVisible();
});
