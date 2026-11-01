// Security rule S2: fail the build check if the master database key could reach a browser.
//
// 1. Browser bundles (.next/static) must not contain the key's value or its name.
//    `npm run build:canary` builds with a fake key value so this scan can look for it.
// 2. No public setting (a NEXT_PUBLIC_ name, which Next.js copies into browser code)
//    may look like a secret, in source files or .env.example.
//
// Exit codes: 0 clean, 1 a leak was found, 2 nothing to scan (never counts as a pass).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const root = option("--root", process.cwd());
const canary = option("--canary", "canary-service-role-key-7f3a9c");
const KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";
const PUBLIC_SECRET_NAME = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)[A-Z0-9_]*/g;
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "reference", "test-results", "playwright-report"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else {
      yield path;
    }
  }
}

const problems = [];

const staticDir = join(root, ".next", "static");
if (!existsSync(staticDir)) {
  console.error(`No build found at ${relative(root, staticDir) || staticDir}. Run \`npm run build:canary\` first.`);
  process.exit(2);
}

for (const file of walkAll(staticDir)) {
  const text = readFileSync(file, "utf8");
  if (text.includes(canary)) problems.push(`${relative(root, file)}: contains the master key's value`);
  if (text.includes(KEY_NAME)) problems.push(`${relative(root, file)}: mentions ${KEY_NAME}`);
}

// App code only: src/ plus config files at the root. Tests are not shipped and name fake secrets on purpose.
const srcDir = join(root, "src");
const rootFiles = readdirSync(root).map((n) => join(root, n)).filter((f) => statSync(f).isFile());
const settingFiles = [...(existsSync(srcDir) ? walk(srcDir) : []), ...rootFiles].filter(
  (f) => SOURCE_FILE.test(f) || f.endsWith(".env.example"),
);
for (const file of settingFiles) {
  for (const match of readFileSync(file, "utf8").matchAll(PUBLIC_SECRET_NAME)) {
    problems.push(`${relative(root, file)}: public setting ${match[0]} looks like a secret`);
  }
}

if (problems.length > 0) {
  console.error("Build secret check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Build secret check passed: ${settingFiles.length} source files and the browser bundles are clean.`);

function* walkAll(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walkAll(path);
    else yield path;
  }
}
