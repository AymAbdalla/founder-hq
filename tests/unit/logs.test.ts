import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logEvent } from "@/lib/log";
import { proxy } from "@/proxy";

// Security rule S4 (docs/PLAN.md): logs never contain keys or request bodies.
// Test from the plan: a test request containing a fake key leaves no trace of it in the logs.
// Fake secrets are built at runtime so the secret scanner does not flag this file.
const FAKE_KEY = ["sb", "secret", "Zq8rT2vX9mK4pL7nB3cW6yH1"].join("_");
const FAKE_JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "c2lnbmF0dXJlc2lnbmF0dXJlc2ln"].join(".");

let output: string[] = [];
beforeEach(() => {
  output = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      output.push(args.map(String).join(" "));
    });
  }
});
afterEach(() => vi.restoreAllMocks());

describe("request logs", () => {
  it("record a refused forged request without any trace of the key it carried", async () => {
    const request = new NextRequest(`https://hq.example/api/items/1?token=${FAKE_KEY}`, {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        authorization: `Bearer ${FAKE_KEY}`,
        cookie: `session=${FAKE_KEY}`,
      },
      body: JSON.stringify({ apiKey: FAKE_KEY }),
    });

    const response = await proxy(request);

    expect(response.status).toBe(403);
    const logs = output.join("\n");
    expect(logs).toContain("request_refused");
    expect(logs).toContain("/api/items/1");
    expect(logs).not.toContain(FAKE_KEY);
  });
});

describe("logEvent", () => {
  it("redacts fields whose names suggest secrets", () => {
    logEvent("test", { apiKey: "hunter2-value", authorization: "x-value", status: 200 });
    const logs = output.join("\n");
    expect(logs).not.toContain("hunter2-value");
    expect(logs).not.toContain("x-value");
    expect(logs).toContain('"status":200');
  });

  it("redacts secret-looking values under innocent names", () => {
    logEvent("test", { note: `failed with ${FAKE_KEY}`, detail: `token ${FAKE_JWT}`, header: `Bearer ${FAKE_KEY}` });
    const logs = output.join("\n");
    expect(logs).not.toContain(FAKE_KEY);
    expect(logs).not.toContain(FAKE_JWT);
    expect(logs).toContain("failed with");
  });

  it("keeps ordinary values readable", () => {
    logEvent("project_saved", { path: "/api/projects", method: "POST", count: 3 });
    expect(output.join("\n")).toBe('{"event":"project_saved","path":"/api/projects","method":"POST","count":3}');
  });
});
