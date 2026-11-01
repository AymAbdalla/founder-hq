# Build log

Written only by the builder's main agent, one row per slice. State is `built` or `fixed (round N)`; results start with `self-check:`. Never write `checked` here.

| Slice | Workstream | Branch | Commit | Acceptance checks | Builder results | State | Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | public-product | build-public-hq | 9e5b918 | The app runs locally. Tests, lint and the secret scan pass. A forged request from another website is refused. Security tests S1 to S4. | self-check: npm run check exit 0 (lint, typecheck, Vitest 26 pass, secret scan, audit shipped 0 and dev none high, canary build, build leak scan, Playwright 11 pass); next dev served / with 200 and the content policy; each test group failed when its code was broken in a copy, then restored; commit hook refused a planted fake GitHub token; local Supabase start unavailable (no Docker or OrbStack); S1 cookie settings not testable until slice 2 adds cookies; Dependabot file only takes effect on GitHub | built | 2026-11-01 |
