import { readFileSync } from "node:fs";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Runs the project's real lint config over small code samples.
// S2: only src/lib/supabase/admin.ts may read the master key or make the master client.
// S3: no raw HTML anywhere, so text from repos and AI tools can never run as code.
const eslint = new ESLint({ cwd: process.cwd() });

async function lint(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.severity === 2).map((m) => `${m.ruleId}: ${m.message}`);
}

describe("S2: the master database key stays in one module", () => {
  it("bans creating a Supabase client in a route", async () => {
    const errors = await lint("src/app/api/x/route.ts", `import { createClient } from "@supabase/supabase-js";\nexport const c = createClient;\n`);
    expect(errors.join("\n")).toMatch(/no-restricted-imports/);
  });

  it("bans reading the key in a route", async () => {
    const errors = await lint("src/app/api/x/route.ts", "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n");
    expect(errors.join("\n")).toMatch(/master database key/);
  });

  it("bans reading the key with bracket syntax", async () => {
    const errors = await lint("src/app/api/x/route.ts", 'export const k = process.env["SUPABASE_SERVICE_ROLE_KEY"];\n');
    expect(errors.join("\n")).toMatch(/master database key/);
  });

  it("bans reading the key in other Supabase client files", async () => {
    const errors = await lint("src/lib/supabase/browser.ts", "export const k = process.env.SUPABASE_SERVICE_ROLE_KEY;\n");
    expect(errors.join("\n")).toMatch(/master database key/);
  });

  it("allows the admin module itself", async () => {
    const path = "src/lib/supabase/admin.ts";
    expect(await lint(path, readFileSync(path, "utf8"))).toEqual([]);
  });
});

describe("S3: no raw HTML", () => {
  it.each([
    ["dangerouslySetInnerHTML", "export const A = (p: { t: string }) => <div dangerouslySetInnerHTML={{ __html: p.t }} />;\n", /react\/no-danger/],
    ["innerHTML", "export function f(el: HTMLElement, t: string) { el.innerHTML = t; }\n", /Raw HTML is banned/],
    ["outerHTML", "export function f(el: HTMLElement, t: string) { el.outerHTML = t; }\n", /Raw HTML is banned/],
    ["insertAdjacentHTML", 'export function f(el: HTMLElement, t: string) { el.insertAdjacentHTML("beforeend", t); }\n', /Raw HTML is banned/],
    ["document.write", "export function f(t: string) { document.write(t); }\n", /document\.write is banned/],
  ])("bans %s", async (_name, code, rule) => {
    expect((await lint("src/app/sample.tsx", code)).join("\n")).toMatch(rule);
  });

  it("still allows setting plain text", async () => {
    expect(await lint("src/app/sample.tsx", "export function f(el: HTMLElement, t: string) { el.textContent = t; }\n")).toEqual([]);
  });
});
