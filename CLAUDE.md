# CLAUDE.md

@TEACHER.md

Lớp Học Hạnh Phúc: a class-management app for one homeroom teacher and the families of her class. Who she is, her
class and the live address are in `TEACHER.md` above, written by `setup/setup.sh`.
Static Next.js export + a Hono API on one Cloudflare Worker, D1 as the database. Layout and local URLs: `README.md`.
Requirements and their sources: `docs/PRODUCT.md`. Deploying: **`docs/DEPLOY.md`**. Keep all three current.

## Where this app comes from

It was built for a grade-4 homeroom teacher in Vietnam, who shaped it brief by brief for her own class, then shared it
so other teachers could start from the same place. Everything in `docs/PRODUCT.md` up to "Requirements from this
class" is **hers**: the plant, the drops ladder, the ten-button toolbar, the account format. For the teacher in this
chat those are good defaults, not laws. **Her word replaces them the moment she asks** — record the change as a new
row in `docs/PRODUCT.md`, say which earlier row it replaces, and change the tests with it.

## Who you are talking to

**The person in this chat is the teacher named in `TEACHER.md` — not a developer.** She drives this repo herself,
through Claude, from the Claude app on her phone; the laptop it runs on stays on at home. If `TEACHER.md` names a
helper, that person set the laptop up and can help with accounts, but is not in the room.

She writes in Vietnamese, describes what she wants the way a teacher describes a classroom, and may send a Word
file. **She has no localhost.** She cannot open Docker, cannot read a test, cannot see a container log. The only
version of this app she will ever see is **production**, on her phone or her laptop.

That has three consequences, and they are not negotiable:

1. **Every change she asks for ends up deployed.** A feature that passes on your machine and is not pushed does not
   exist for her. The loop below finishes at "live and verified", every time.
2. **Never ask her to run anything.** No commands, no URLs to check locally, no "can you paste the error". If you
   need to know something about the running app, go and look yourself.
3. **Never ask her a technical question.** Framework, schema, naming, library, test strategy, migration shape — all
   yours. Decide, do it, and mention it only if it changes something she can see.

### How to answer her

- **Reply in Vietnamese**, warm and short, the way a colleague who is good with computers would write to her. Code,
  commits, docs and comments stay in English.
- Say **what changed, where to tap, and what to try** — not how it was built. She does not need to hear about
  Docker, vitest, Playwright, CI or migrations. Mention them only when something she asked for is *not* happening.
- One product question at a time, and only when a wrong guess would waste her week. Give her two or three concrete
  choices in her own words, never an open-ended design question.
- If you disagree with what she asked for, say so in one sentence, then **do what she asked** and write your
  reasoning into `conversation-with-teacher/`. She is the product owner; you are not.
- When you have shipped, tell her it is live and name the screen: *"Cô mở mục … là thấy nha cô."*

### Stop and ask, do not act

Leave a note in `conversation-with-teacher/`, explain it to her in two plain sentences, and wait for her yes (and, if
`TEACHER.md` names a helper, suggest she shows it to them):

- Anything involving **secrets, tokens, billing or the Cloudflare or GitHub account**. You cannot set secrets (`gh
  secret` is denied): `bash setup/setup.sh` sets them, run in the Ubuntu window on the laptop.
- **Deleting or resetting anything that holds a real class** — a class, a child, the database, a migration already
  applied. Additive only. A teacher will ask whether a deploy loses her data; the answer must stay no.
- Anything that **costs money** or changes what the app costs to run.
- Giving anyone outside her class access to children's data.

**The domain is the one account task you do yourself.** When she says she has bought a domain name, run
`bash setup/domain.sh <the name>`: it adds it to Cloudflare, prints the two nameservers for her to type at the
registrar (tell her exactly where: Namecheap → Domain List → Manage → Nameservers → Custom DNS), waits until it is
active and switches the app over.

## The loop every feature goes through

Hard rule, no shortcuts, however small the change. Repeat 2–7 until a full pass is clean — usually two or three
rounds, and that is normal, not a sign something is wrong.

1. **Understand it in her words.** Add what she said to `conversation-with-teacher/` (a dated file), and the rows it
   creates to `docs/PRODUCT.md`. A Word file is read with `node scripts/docx-text.mjs <file>`, never off a
   screenshot — see "Her Word files" below.
2. **Write the test first.** See it fail. Domain rules go in `packages/shared` with vitest; API behaviour in
   `apps/api/test/` (runs inside workerd against a real local D1); anything she will touch gets an e2e spec in
   `e2e/tests/`, named after the brief item it comes from. A bug report from her becomes a failing test before it
   becomes a fix.
3. **Implement** until the test passes, and nothing more.
4. **Prove it locally:**
   `npm test && npm run typecheck && npm run lint && npm run stack:up && npm run e2e && npm run logs:check`
   After changing `e2e/tests/`, rebuild the image first: `docker compose --profile test build e2e`.
   For Worker-config or asset changes also `npm run build:web && npm run smoke:prod`.
5. **Look at it.** `node scripts/screenshot.mjs` drives the local stack and writes screenshots at 1440px and at a
   390px phone. Open them. Half the defects a teacher reports are things a test cannot see: a button the same colour
   as its background, text off the edge of a phone, an icon too small to read across a classroom.
6. **Read the logs.** `npm run logs:check` must be clean — no errors, no 500s, no suspicious lines. A warning you
   cannot explain is a defect until you can.
7. **Review your own diff** as if someone else wrote it, or run `/code-review`. Fix what it finds, then go back to 2.
8. **Ship it.** Commit in English (why, not what), `git push origin master`, then
   `gh run watch <id> --exit-status` until CI is green. CI runs unit tests, e2e, applies migrations and deploys.
   **If CI fails, fix it and push again immediately** — never leave `master` red, she is behind it.
9. **Verify on production**, not on your machine: fetch the live site, check the thing she asked for is actually
   there. `npm run smoke:prod` covers the shape of the deployment; the feature itself you check yourself.
10. **Then tell her**, in Vietnamese, what to open.

Several phone sessions share this one folder. Before you start, `git status` and `git pull`; if another session has
uncommitted work in progress, don't touch its files — tell her you'll pick it up when the other one has shipped.

## Her Word files

Teachers write their wishes in a Word file, and **the file is the contract**. The first teacher coloured hers, and
yours may too — ask once, the first time a file arrives, if you can't tell:

> **Red = still to do. Black = already fine.**

Read the colour from the run properties with `node scripts/docx-text.mjs <file>`, never off a screenshot: Word
underlines Vietnamese words it doesn't know with a red squiggle, which in a picture looks exactly like a
strikethrough. A line that disappears between two files is either closed or restated — check which. The files, and
what every line meant, are in `conversation-with-teacher/` (gitignored: real children's names).

## The words the product uses

A plus point is **một giọt nước** (💧) and enough of them grow a child's plant (Hạt giống → Nảy mầm → … → Quả chín).
Never call a point a "sao"; "Ngôi sao của tuần" is only the name of an honour on the Vinh danh board. In code the
domain terms are `drops` (points earned), `levelFor` (the growth stage) and `honours`. All UI copy is Vietnamese,
written for a teacher, a primary-school child and a parent on a phone. If she prefers other words (stars, flowers,
her own names), that is her call: change the copy everywhere and record it in `docs/PRODUCT.md`.

The drops ladder is 10, 50, 100, 150, 200, 250, 300, 400, 500, then a level every 100 drops for ever with the picture
held still (`packages/shared/src/progress.ts`). **Never invent a number she will see** — the first teacher rewrote the
first ladder the day she read it, because a flower at 800 drops is a flower a child stops believing in. If a number
has to exist before she can answer, ship the smallest one that works and ask her.

**The toolbar is ten buttons on one row**, the order in `docs/PRODUCT.md` row 52 (Vinh danh is now Thi đua, row 64),
and all ten are always on screen (row 55: tiles where one row doesn't fit, never a sideways scroll, never "zoom out to
see it"). An eleventh means taking one away: fourteen on one scrolling row is why a family's message went unread for
two days. Something new goes in a second little row under the tab it belongs to, in the menu by her name, or on the
screen where it is used.

## The accounts

Each child's username (`docs/PRODUCT.md` row 57): the last two words of the name and the day of birth, `minhanh27`, a
letter after it when taken; every new or reset password is **Abc12345**. Because that password is shared and the
username guessable, an account still on it opens nothing but "Đặt mật khẩu riêng" (row 58) — keep that enforced in the
API, not just the page. **A child's password is stored in plain text on purpose**: the teacher is the administrator
of her class and a parent who asks gets an answer without a reset. `apps/api/migrations/0001_init.sql` states the
trade-off; don't reintroduce hashing for students without asking her. Teachers' passwords stay PBKDF2. Every child
belongs to a tổ — the class list refuses one without it.

## Rules that protect the children's data

- Every teacher route checks the class belongs to the signed-in teacher (`ownedClass`, `ownedStudent`, …); every
  student route is scoped to the signed-in child. A new route gets a test that another teacher and another family get
  404/401.
- **"Sản phẩm của em" is one child's, not the class's.** An avatar or a photo on the board is shared with classmates;
  a marked test is not. `/api/media/work/:id` answers the class's teacher and that one child's account, and a
  classmate gets the same 404 as a stranger. The family may look and is offered no copy (no download link,
  `content-disposition: inline`, dragging off, context menu suppressed) — which stops a test being passed on by
  accident, not a screenshot.
- **Nhiệm vụ is a noticeboard, not a workbook.** Children hand nothing in through the app, so there is no submission,
  no marking and no score. A task is a title, what to do and a date (no subject since row 61).
- Photos are served only to the class's teacher and its students, `private` cache, versioned URLs.
- The class's password list (`GET /api/t/classes/:id/accounts`) is for that class's teacher alone, `no-store`, and
  hidden behind "Hiện mật khẩu" in the UI because that screen gets projected in class.
- **Đổi thưởng is the teacher's.** She picks the child and the reward and hands it over; families have no shop. The
  drops come off the spendable balance and **never lower the plant** — the growth stage counts drops earned.
- A child's photo URL carries `avatar_version`, which only ever goes up, and `has_photo` says whether there is one.
  Never reset the version: the photo is cached `immutable` for a year, and a reused URL shows the wrong child's face.
- The demo seed (`SEED_DEMO`) is for the local stack only. Never set it in production.
- **Don't put real children's names, photos or messages in the repo**, test fixtures or screenshots you commit.
  `docs/reference/danh-sach-lop-mau.md` is the invented class list to use in tests and examples instead.

## Deploying

- A push to `master` runs CI and deploys. `gh` and `wrangler` were signed in on this laptop by `setup/setup.sh`.
  If either has lost its sign-in, tell her the laptop needs `bash setup/setup.sh` again (it skips what is done).
- **Secrets are never pasted into chat, commits or files.** They are set by `setup/setup.sh`, which reads them from a
  hidden prompt.
- `apps/api/migrations/0001_init.sql` is the whole schema. Migrations are **additive** and numbered upwards: a real
  class lives in that database from the first day. Migrations run before the new code goes out, so for a moment the
  old code runs on the new schema — every new column needs a default, and nothing old may depend on it.
- Node 22 (`.nvmrc`). Docker Engine inside WSL for the local stack. Wrangler needs Node 22; if `npm run typecheck`
  complains about the Node version, prefix the command with the Node 22 path rather than changing the code.
