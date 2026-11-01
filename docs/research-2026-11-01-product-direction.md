# Research: turning HQ into a product (Nov 1, 2026)

Four research tracks, each re-checked by a separate fact-checker. "Unconfirmed" means no primary source was read. Treat the market conclusions as a starting point to test with real users, not as proof.

## 1. Website, Mac app or phone app

| Option | What users get | Cost and effort | Main catch |
| --- | --- | --- | --- |
| Website that installs like an app (PWA) | Works on Mac, iPhone, Android, Windows from one codebase. Can be added to the Home Screen or Dock. | Cheapest and fastest. No Apple fee, no review, fixes ship the same day. | On iPhone, reminders can only notify after the user adds it to the Home Screen. |
| Native Mac + iPhone apps (Swift) | Best feel, reliable notifications, can read local folders on the Mac. | $99 a year Apple Developer Program, App Review, two apps to build, Apple-only. | Slowest way to learn whether anyone wants it. |
| Wrapped web app (Capacitor, Tauri, Electron) | The website packaged as an App Store or desktop app. | Middle path, reuses the web code. | Apple can reject a "website in a wrapper" that adds no native features (Guideline 4.2, unconfirmed against current text). |

Facts checked:
- iPhone web push works from iOS 16.4, only for sites added to the Home Screen, and permission must be asked after a tap. https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Mac web push works in a normal browser tab (Safari 16 on macOS 13 and later). https://webkit.org/blog/12824/news-from-wwdc-webkit-features-in-safari-16-0/
- Apple Developer Program is $99 a year. https://developer.apple.com/programs/whats-included/
- App Store Small Business Program: 15% commission under $1M a year. https://developer.apple.com/app-store/small-business-program/
- EU behaviour of Home Screen web apps in late 2026: unconfirmed.

## 2. Where project facts come from

- **Manual entry** needs nothing connected. Ideas, to-dos, reminders and features are mostly typed by people anyway.
- **GitHub.** GitHub recommends a "GitHub App" (a connection the user installs on chosen repos, read-only) over the older OAuth App. It can send an update on every push. Rate limit: 5,000 requests an hour per installation. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
  - GitHub only sees pushed work. Uncommitted files, local-only branches and worktrees, which HQ shows today, are invisible to it.
  - Running it means hosting a server that holds a private key and webhook secrets and stores facts about people's private repos.
  - Cheaper first step: a user-made read-only token (fine-grained personal access token) limited to chosen repos.
- **Local folders.** A website cannot read them on Safari, iPhone or Firefox. Only Chrome-family browsers have the folder picker. https://caniuse.com/native-filesystem-api
  - Local facts need a Mac app or a small helper program (or git hook) on the user's machine that sends counts and names, not code, to the service.
- **Markdown plan files** (PLAN.md, TODO.md, AGENTS.md) are cheap to read. Writing back to files that a person and an AI agent also edit risks overwritten work, so start read-only.

## 3. Who else does this

- General to-do and project apps are crowded and cheap: Todoist (free, Pro $60 a year), TickTick, Things 3, Notion (Plus $10 a month), Trello, Linear, GitHub Projects.
- One place for many side projects with repo activity is served mostly by free hobby or open-source tools. No strong paid product was found.
- Tools that manage AI coding agents (Vibe Kanban, Task Master, Backlog.md, Spec Kit) are single-repo or run agents on one task. They do not hold a person's ideas, reminders and projects across repos.
- Warning signs on paying demand: Height shut down in Sept 2025. Bloop, the company behind Vibe Kanban, shut down in April 2026, citing no business model with mostly free users.
- Biggest risk: Claude Code, Codex or GitHub adding a cross-project view themselves.

## 4. The AI-agent angle

- MCP (Model Context Protocol) is the standard way for AI tools like Claude Code and Codex to call another app ("list tasks", "add idea"). Linear, Notion, Todoist and GitHub already offer MCP servers. https://linear.app/docs/mcp
- A local MCP server runs on the user's machine and is small. A hosted one other people can use needs sign-in (OAuth) and hosting. https://modelcontextprotocol.io/specification/latest/basic/authorization
- Possible position, not yet tested: the home base for people building many projects with AI agents. Status comes from the repos (plan-file checkboxes, git activity), and both the person and their agents read and write the same items.

## What this means for the current page

The current page is a private claude.ai artifact. It cannot be a product for other people. A product needs its own user accounts, a database that keeps each user's data separate, hosting, a public address, and, for GitHub, a server that receives updates.
