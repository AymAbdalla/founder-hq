import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Security rule S2 (docs/PLAN.md): a build check fails if the master key appears in
// browser code or in any public setting.
const SCRIPT = join(process.cwd(), "scripts/check-build-secrets.mjs");
const CANARY = "canary-service-role-key-7f3a9c";

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "hq-build-check-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

function run(root: string): { code: number; output: string } {
  try {
    const output = execFileSync("node", [SCRIPT, "--root", root, "--canary", CANARY], { encoding: "utf8", stdio: "pipe" });
    return { code: 0, output };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, output: err.stdout + err.stderr };
  }
}

describe("build secret check", () => {
  it("passes a clean build", () => {
    const root = project({ ".next/static/chunks/app.js": "console.log('hi')", "src/app/page.tsx": "export {}" });
    expect(run(root).code).toBe(0);
  });

  it("fails when the master key's value is in browser code", () => {
    const root = project({ ".next/static/chunks/app.js": `const k="${CANARY}"`, "src/app/page.tsx": "export {}" });
    const result = run(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain(".next/static/chunks/app.js");
  });

  it("fails when browser code mentions the master key's name", () => {
    const root = project({ ".next/static/chunks/app.js": "process.env.SUPABASE_SERVICE_ROLE_KEY", "src/app/page.tsx": "export {}" });
    expect(run(root).code).toBe(1);
  });

  it("fails when a public setting carries a secret-looking name", () => {
    const root = project({
      ".next/static/chunks/app.js": "ok",
      "src/lib/x.ts": "const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;",
    });
    const result = run(root);
    expect(result.code).toBe(1);
    expect(result.output).toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("fails when .env.example declares a public secret", () => {
    const root = project({ ".next/static/chunks/app.js": "ok", ".env.example": "NEXT_PUBLIC_GITHUB_SECRET=\n" });
    expect(run(root).code).toBe(1);
  });

  it("refuses to pass when there is no build to scan", () => {
    const root = project({ "src/app/page.tsx": "export {}" });
    expect(run(root).code).toBe(2);
  });
});
