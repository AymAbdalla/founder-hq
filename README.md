# Founder HQ

A free web app for people building several projects with AI coding tools: projects, to-dos, reminders, ideas and features in one place, with repo activity filled in from GitHub and a helper on your computer, and a connection your AI coding tools can read and add to.

Status: early build. Slices 1 and 2 of 19 (foundation, security baseline, sign-in).

- What it does: [docs/SPEC.md](docs/SPEC.md)
- How it is built: [docs/PLAN.md](docs/PLAN.md)
- Rules for coding agents: [AGENTS.md](AGENTS.md)
- The earlier personal page, kept for reference only: [reference/](reference/)

## Run it

Needs Node 20.9 or newer.

```
npm ci
npm run dev
```

Then open http://localhost:3000. `npm run check` runs every test and check.

Sign-in and the tests need local Supabase: start OrbStack (or Docker), then `npm run supabase:github-fake`, and write `.env.local` as [AGENTS.md](AGENTS.md) describes. Sign-in emails land in the local mail catcher at http://127.0.0.1:54324.

### GitHub sign-in on your computer

Register your own GitHub OAuth app for local use at https://github.com/settings/applications/new:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://127.0.0.1:54321/auth/v1/callback`

Generate a client secret, then put both values in `supabase/.env` (git ignores it) and restart Supabase:

```
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

The live site uses a separate GitHub app, because each app has one callback address.

GitHub sign-in has two local modes. The browser tests need **fake** mode, where a small fake GitHub (started by the tests) stands in for github.com, so a whole sign-in can be tested, including how a matching email joins an account. To try "Continue with GitHub" with your own account, switch to **real** mode, and switch back before running the tests. Both keep your local data.

```
npm run supabase:github-real
```

```
npm run supabase:github-fake
```
