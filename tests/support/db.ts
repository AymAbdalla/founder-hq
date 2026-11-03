import { execFileSync } from "node:child_process";

// Runs SQL against the local Supabase database, to set up test situations
// (for example, sign-in emails sent earlier). Local only.
export function localSql(query: string): void {
  execFileSync("npx", ["supabase", "db", "query", "--local", query], { stdio: "pipe" });
}

export function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// Reads rows from the local Supabase database, for checking what a test left behind.
export function sqlRows(query: string): Record<string, unknown>[] {
  const out = execFileSync("npx", ["supabase", "db", "query", "--local", query], { stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out.toString()).rows;
}
