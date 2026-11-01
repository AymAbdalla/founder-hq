import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

// Security rule S1 (docs/PLAN.md, Security): strict content policy without inline
// scripts, no framing by other sites, HTTPS only.

test("home page loads and shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Founder HQ" })).toBeVisible();
});

test("pages send a strict content policy with a per-request nonce and no inline scripts", async ({ request }) => {
  const first = (await request.get("/")).headers()["content-security-policy"];
  const second = (await request.get("/")).headers()["content-security-policy"];

  expect(first, "Content-Security-Policy header").toBeTruthy();
  const scriptSrc = first.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"));
  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).not.toContain("'unsafe-eval'");
  expect(first).toContain("frame-ancestors 'none'");
  expect(first).toContain("object-src 'none'");
  // A nonce is only safe if it changes every request.
  expect(second).not.toEqual(first);
});

test("pages refuse framing and require HTTPS", async ({ request }) => {
  const headers = (await request.get("/")).headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the app runs under its content policy without violations", async ({ page }) => {
  // Collect the browser's own policy-violation events, raised for every blocked script or style.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener("securitypolicyviolation", (e) => seen.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const violations = await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
  expect(violations).toEqual([]);
});

test.describe("framing by another site", () => {
  // A real second website: a tiny server on another port is a different origin to the browser.
  let attacker: Server;
  let attackerUrl = "";

  test.beforeAll(async () => {
    attacker = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><title>attacker</title><iframe id="hq" src="http://localhost:3100/" width="600" height="400"></iframe>`);
    });
    // Port 0: the system picks any free port, so the test never collides with other servers.
    await new Promise<void>((resolve) => attacker.listen(0, "127.0.0.1", resolve));
    attackerUrl = `http://127.0.0.1:${(attacker.address() as AddressInfo).port}/`;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => attacker.close(resolve));
  });

  test("another site cannot show HQ inside a frame", async ({ page }) => {
    await page.goto(attackerUrl);
    await page.waitForTimeout(1500);
    const frame = page.frames().find((f) => f !== page.mainFrame());
    const text = frame ? await frame.evaluate(() => document.body?.innerText ?? "").catch(() => "") : "";
    expect(frame, "the attacker page has a frame").toBeTruthy();
    expect(text).not.toContain("Founder HQ");
  });
});
