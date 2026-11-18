# Founder HQ: rules for coding agents

Founder HQ is a free public web app for people building several projects with AI coding tools. What it does is in [docs/SPEC.md](docs/SPEC.md). How and in what order it is built is in [docs/PLAN.md](docs/PLAN.md). Read both before changing anything.

## Ground rules

- **The spec is shared and read-only for agents.** If something in it looks wrong or missing, add an open item to the plan and ask Aym.
- **Build in the plan's slices**, one at a time, on the branch `build-public-hq`. Never commit on `main`. Never push or merge without Aym's yes.
- **Nothing in the product is specific to Aym.** No names, home-folder paths, repo names, seeded projects or personal data in code, defaults, placeholders or tests. Use invented sample data.
- **`reference/` is the old personal page, kept only on Aym's Mac.** Git ignores it and it is not in the published repository. It is there only to look at for screens and behavior. It holds personal data. Never import from it, copy its data, or ship it.
- **Ask first** before anything the plan's Approval section lists as needing its own yes: installing tools outside this folder, signing up for services, registering GitHub apps, changing Claude Code or Codex settings, deploying, sending real notifications or emails, buying anything, pushing or merging.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install exactly what the lockfile says. Also turns on the secret-scan commit hook. |
| `npm run dev` | Run the app at http://localhost:3000 |
| `npm run check` | Everything below, in order. Must pass before a slice counts as built. |
| `npm run lint` | ESLint, including the security rules |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (Vitest, `tests/unit/`) |
| `npm run secrets` | Secret scan of every file git could commit |
| `npm run audit` | Shipped packages: no known issues at all. Development tools: none high or critical. |
| `npm run build:canary` | Production build with a fake master key, so the next step can look for it |
| `npm run check:build-secrets` | Fails if the key, or a secret-looking public setting, reaches browser code |
| `npm run test:e2e` | Browser tests (Playwright, `tests/e2e/`) against the production build on port 3100 |
| `npm run supabase:github-fake` | Restart local Supabase with GitHub sign-in pointed at the tests' fake GitHub. The browser tests need this mode. Data is kept. |
| `npm run supabase:github-real` | Restart local Supabase with real GitHub sign-in, to try it with your own GitHub account. Data is kept. |

`npm test` and `npm run test:e2e` need local Supabase running: start OrbStack (or Docker), then `npm run supabase:github-fake` (or `npx supabase start` for unit tests only). The fake GitHub listens on fixed port 54390, an agreed exception to the port-0 rule below, because Supabase must know its address when it starts. Write `.env.local` from `npx supabase status -o env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the publishable key, `SUPABASE_SERVICE_ROLE_KEY` from the secret key). Sign-in emails land in the local mail catcher at http://127.0.0.1:54324.

## Database

- Every change is a new file in `supabase/migrations/`. Never edit a migration that has been committed; add a new one.
- Every table that holds account data turns on row-level security, with policies that only allow `account_id = (select auth.uid())`, and is covered by the two-account isolation tests in `tests/integration/`.
- Tables nobody should reach through the API go in the `private` schema. Functions use `security definer` only when needed, always with `set search_path = ''`.

## Security rules (plan section Security, S1 to S4)

- **No raw HTML.** Never use `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`. Lint refuses them. Text from repos, AI tools and users is always rendered as plain text.
- **The master database key** (`SUPABASE_SERVICE_ROLE_KEY`) is read only in `src/lib/supabase/admin.ts`, and every caller names an account. Supabase clients are created only in `src/lib/supabase/`. Lint enforces both.
- **Never put a secret behind a `NEXT_PUBLIC_` name.** Next.js copies those into browser code. The build check refuses secret-looking public names.
- **Forged requests.** `src/proxy.ts` refuses any data-changing request whose `Origin` or `Sec-Fetch-Site` header points away from HQ. Routes called by non-browser clients (GitHub's webhook, AI tools, the helper) get no cookie access and must check their own signature or token.
- **Headers.** Every page gets a per-request content policy (no inline scripts), and framing by other sites is refused. Pages that need the nonce must render per request (`await connection()`).
- **Logs.** Log only through `logEvent` in `src/lib/log.ts`, with an event name and plain fields: method, path without the query string, status, counts. Never log headers, cookies, request bodies, full URLs, or text from private repos.
- **Secrets** live in environment variables only (`.env.local` locally, never committed; see `.env.example`). Never paste a secret into a command, file, log, test or report. Tests build fake secrets at runtime.

## Adding a package

Add a package only when it is needed, and:

1. State the reason in the commit body.
2. Confirm it is established: the exact name, its maintainers, wide use.
3. Pin an exact version published **at least 14 days ago** (`.npmrc` saves exact versions).
4. Commit the updated `package-lock.json`. Install with `npm ci`.
5. `npm run audit` must still pass.

## Tests

- Write the test first and watch it fail on the missing behavior before writing the code.
- Unit tests go in `tests/unit/`, browser tests in `tests/e2e/`. Browser tests run against a production build, never the dev server.
- Fake websites in tests listen on port 0 (any free port), because other local projects use fixed ports.
- Never weaken a test to make it pass.

## Records

Slice records live in `docs/agents/` (`build.md`, `checks.md`, `status.md`). The builder writes `build.md` and its own `status.md` line, with state `built` and results starting `self-check:`. Only an independent checker (a fresh chat, or Codex) writes `checks.md`.

## Git

Commit as `Ayman Abdalla <166993028+AymAbdalla@users.noreply.github.com>`. Use short Conventional Commits subjects, with a body only to explain why. No AI attribution anywhere: no co-author trailers, no "generated with" lines, no tool names in commits, branches or files.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
