import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

// Security rule S1 (docs/PLAN.md, Security): every data-changing request checks it
// came from HQ itself. Test from the plan: a cross-site request to delete an item is refused.
// The items route arrives in slice 6; the check runs before routing, so it applies already.
const ITEM = "/api/items/00000000-0000-4000-8000-000000000001";

test("a delete sent from another website is refused", async ({ request }) => {
  const res = await request.delete(ITEM, {
    headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
  });
  expect(res.status()).toBe(403);
});

test("a write from a sibling subdomain is refused", async ({ request }) => {
  const res = await request.post(ITEM, {
    headers: { origin: "https://evil.localhost:3100", "sec-fetch-site": "same-site" },
    data: { done: true },
  });
  expect(res.status()).toBe(403);
});

test("a write with an opaque origin is refused", async ({ request }) => {
  const res = await request.post(ITEM, { headers: { origin: "null" }, data: {} });
  expect(res.status()).toBe(403);
});

test("the same delete from HQ itself is not refused by the check", async ({ request, baseURL }) => {
  const res = await request.delete(ITEM, {
    headers: { origin: baseURL!, "sec-fetch-site": "same-origin" },
  });
  // 404 until slice 6 adds the route; the point is that the origin check lets it through.
  expect(res.status()).toBe(404);
});

test("reading from another website is not blocked by the write check", async ({ request }) => {
  const res = await request.get("/", { headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" } });
  expect(res.status()).toBe(200);
});

test.describe("from a real browser on another website", () => {
  let attacker: Server;
  let attackerUrl = "";

  test.beforeAll(async () => {
    attacker = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><title>attacker</title><p>nothing to see</p>");
    });
    // Port 0: the system picks any free port, so the test never collides with other servers.
    await new Promise<void>((resolve) => attacker.listen(0, "127.0.0.1", resolve));
    attackerUrl = `http://127.0.0.1:${(attacker.address() as AddressInfo).port}/`;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => attacker.close(resolve));
  });

  test("a forged form-style post from another site is refused", async ({ page, baseURL }) => {
    await page.goto(attackerUrl);
    // The browser adds Origin and Sec-Fetch-Site itself; the attacker cannot remove them.
    const responsePromise = page.waitForResponse((r) => r.url().includes("/api/items/"));
    await page.evaluate(
      (url) => fetch(url, { method: "POST", mode: "no-cors", body: "done=true", credentials: "include" }).catch(() => null),
      `${baseURL}${ITEM}`,
    );
    const response = await responsePromise;
    expect(response.status()).toBe(403);
  });
});
