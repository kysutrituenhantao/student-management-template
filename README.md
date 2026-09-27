# Lớp Học Hạnh Phúc

> **A teacher starting her own copy?** Read **[setup/HUONG-DAN-CAI-DAT.md](setup/HUONG-DAN-CAI-DAT.md)** (Vietnamese):
> two lines to paste, four sign-ins, and the app is live with Claude on her phone. What the scripts do:
> [docs/DEPLOY.md](docs/DEPLOY.md#first-deploy-one-time).

A class-management app for a grade-4 homeroom teacher in Vietnam, and for the families of her class. Every plus point
is a drop of water that grows the child's plant; the teacher gives them from a sticker for each child, takes the
register, pins the month's board, sets Toán and Tiếng Việt tasks, reviews them in red pen, crowns the week's star and
sees reports by week, month, semester and year. Each family signs in with the account the teacher printed for their
child: they read the class board and comment on it, and see the child's drops, attendance, tasks, marks, honours and
the teacher's remarks, redeem rewards and message the teacher.

It is a static Next.js export plus a Hono API on one
Cloudflare Worker, D1 (SQLite) as the database, a Docker stack that mirrors production, and a push-to-deploy pipeline.
Everything runs on free tiers.

```
Browser ──> Cloudflare ──┬── static assets   (Next.js export: 10 pages, all client-rendered)
                         └── /api/*  Worker  (Hono) ──> D1 (teachers, classes, students, sessions, points,
                                                            tasks, rewards, badges, messages, photos,
                                                            board posts, attendance, honours)
```

What the product does, and where each requirement came from: **[docs/PRODUCT.md](docs/PRODUCT.md)**.
The teacher's guide, in Vietnamese: **[docs/HUONG-DAN-SU-DUNG.md](docs/HUONG-DAN-SU-DUNG.md)**.
Deploying, the domain, backups, rolling back: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Run it locally

Needs Docker Desktop and Node 22 (`nvm use`).

```bash
npm install            # once, for editors and unit tests
npm run stack:up       # build and start everything, wait until healthy
```

| URL | What |
| --- | --- |
| http://localhost:8080 | The app, as production serves it (edge → web + api) |
| http://localhost:8081 | Read-only SQL browser over the local D1 database |
| http://localhost:8787 | The API directly |

A fresh database gets a sample class (`SEED_DEMO=1` in `docker-compose.yml`, never in production). The demo's accounts
are the same on every fresh stack, and the api container's log prints the first few:

| Who | Sign in at | Username | Password |
| --- | --- | --- | --- |
| Teacher | http://localhost:8080/giao-vien/ | `codemo` | `demo-lop-hoc` |
| Any of the 28 students | http://localhost:8080/dang-nhap/ | `anh.ntes`, `nam.jrvc`, `dan.x5hc`… | `dvhfaf`, `uxsun2`, `jrxxrx` |
| New teacher account | http://localhost:8080/giao-vien/dang-ky/ | your choice | invite code `lop-hoc-hanh-phuc-local` |

The stack mirrors production tier by tier:

| Service | Plays | Runs |
| --- | --- | --- |
| `edge` | Cloudflare's routing | Caddy: `/api/*` → api, everything else → web |
| `web` | Workers static assets | nginx serving the static export, with the same `_headers` (CSP, HSTS) |
| `api` | The Worker | `wrangler dev` on workerd, the real Workers runtime. Applies migrations on start |
| `db` | D1 | The D1 SQLite file on a volume, plus a read-only browser |

`npm run stack:down` stops it; `npm run stack:reset` also wipes the database (the sample class comes back next start).
For hot-reload design work: `docker compose --profile dev up web-dev` → http://localhost:3000.

## Tests

| Command | What it proves |
| --- | --- |
| `npm test` | 300 unit and integration tests. The API suite runs inside workerd against a real local D1 |
| `npm run e2e` | 69 Playwright specs against the running stack: class setup, bulk import, scoring from the list and the sticker, the class board and its comments, the register, the honour roll and its podium, the class profile book, the tổ race and editing a tổ's members, the work she sets as a family reads it, messages, handing a reward over, password reset and per-child passwords, reports, layout on phones down to 360px. `adjustments.spec.ts` holds one test per item of her third brief |
| `npm run logs:check` | No errors, 5xx, or unexpected warnings in any container's logs |
| `npm run smoke:prod` | Serves the exact production Worker config (assets + API + D1) and probes it: 21 checks |
| `npm run typecheck`, `npm run lint` | Types and lint across the workspaces |

The full loop: `npm test && npm run typecheck && npm run lint && npm run stack:up && npm run e2e && npm run logs:check`.

## Layout

```
apps/web          Next.js 15 static export: teacher area, family area, sign-in (vitest + Testing Library)
apps/api          Cloudflare Worker: Hono routes, D1 migration, demo seed, vitest on workerd
packages/shared   Domain logic shared by both: usernames from Vietnamese names, class-list parsing,
                  Vietnam-time periods, growth stages and badges, zod schemas, API types
e2e/              Playwright suite, run in docker
docker/           Caddy, nginx, D1 browser, API entrypoint
scripts/          prod-config, prod-smoke, check-logs, write-secrets,
                  docx-text (read her Word files with their colours), screenshot (look at the
                  app at 1440px and 390px)
setup/            The teacher's install: windows.ps1, setup.sh, domain.sh, HUONG-DAN-CAI-DAT.md
docs/             PRODUCT.md, DEPLOY.md, the Vietnamese guide, the reference prompt from the video
```

## Deploy

Pushing to `master` deploys once CI passes: tests, build, e2e, D1 migrations, then the Worker, the pages and the
invite code go out as one version, followed by a live smoke test.

| | |
| --- | --- |
| Live, repo | In `TEACHER.md`, written by `setup/setup.sh` |

Everything about deploying, the domain, accounts, backups, rolling back and limits: **[docs/DEPLOY.md](docs/DEPLOY.md)**.
