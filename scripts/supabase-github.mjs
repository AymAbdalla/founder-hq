// Restarts local Supabase with GitHub sign-in pointed at real GitHub or at the tests' fake GitHub.
//   node scripts/supabase-github.mjs fake   (what the browser tests need)
//   node scripts/supabase-github.mjs real   (to try "Continue with GitHub" with your own account)
// Data is kept: Supabase's stop keeps the database. Fake mode starts Supabase from a generated
// copy of supabase/config.toml in supabase/.temp (not committed). The copy points GitHub at the
// fake and uses made-up app credentials, so the real ones are never sent to the fake.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const FAKE_GITHUB_PORT = 54390;
const root = resolve(import.meta.dirname, "..");
const fakeDir = join(root, "supabase", ".temp", "github-fake");
const mode = process.argv[2];
if (mode !== "fake" && mode !== "real") {
  console.error("Usage: node scripts/supabase-github.mjs fake|real");
  process.exit(1);
}

function supabase(args, cwd = root) {
  execFileSync("npx", ["supabase", ...args], { cwd, stdio: ["ignore", "ignore", "inherit"] });
}

function writeFakeConfig() {
  const real = readFileSync(join(root, "supabase", "config.toml"), "utf8");
  const github = /\[auth\.external\.github\][\s\S]*?(?=\n\[)/;
  if (!github.test(real)) throw new Error("supabase/config.toml has no [auth.external.github] section");
  const fake = real.replace(
    github,
    [
      "[auth.external.github]",
      "enabled = true",
      'client_id = "fake-github-client"',
      'secret = "fake-github-client-value"',
      `url = "http://host.docker.internal:${FAKE_GITHUB_PORT}"`,
      "email_optional = false",
      "",
    ].join("\n"),
  );
  rmSync(fakeDir, { recursive: true, force: true });
  mkdirSync(join(fakeDir, "supabase"), { recursive: true });
  writeFileSync(join(fakeDir, "supabase", "config.toml"), fake);
  for (const name of ["migrations", "templates", "seed.sql", ".env"]) {
    const target = join(root, "supabase", name);
    // Copied, not linked: Supabase refuses files that resolve outside the folder it starts from.
    if (existsSync(target)) cpSync(target, join(fakeDir, "supabase", name), { recursive: true });
  }
}

// Stop whichever mode is running; both use the same containers and the same saved database.
supabase(["stop"]);
if (mode === "fake") {
  writeFakeConfig();
  supabase(["start", "--workdir", fakeDir]);
} else {
  supabase(["start"]);
}
console.log(`Local Supabase is running with ${mode === "fake" ? "the tests' fake GitHub" : "real GitHub"} sign-in.`);
