#!/usr/bin/env bash
# Serve the exact production Worker config locally (static assets + API + local D1) and probe it.
# Catches what the docker stack can't: run_worker_first, html_handling, 404-page, _headers, Secure cookies.
# Needs apps/web/out (npm run build:web).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8788}"
TMP="$(mktemp -d)"
trap 'kill "${PID:-0}" 2>/dev/null || true; rm -rf "$TMP"' EXIT

[ -f apps/web/out/index.html ] || { echo "build the site first: npm run build:web"; exit 1; }

D1_DATABASE_ID=00000000-0000-0000-0000-000000000000 SITE_URL=https://lophochanhphuc.example node scripts/prod-config.mjs >/dev/null

cat > "$TMP/.env" <<VARS
TEACHER_INVITE_CODE=smoke-invite-code
VARS

cd apps/api
npx wrangler d1 migrations apply lop-hoc-hanh-phuc --local -c wrangler.production.jsonc --persist-to "$TMP/d1" >/dev/null
npx wrangler dev -c wrangler.production.jsonc --local --port "$PORT" --persist-to "$TMP/d1" --env-file "$TMP/.env" \
  --show-interactive-dev-session=false > "$TMP/dev.log" 2>&1 &
PID=$!
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 1; done

BASE="http://127.0.0.1:$PORT"
fails=0
check() { if eval "$2"; then echo "✔ $1"; else echo "✘ $1"; fails=$((fails + 1)); fi; }
status() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
json() { curl -s -H 'content-type: application/json' "$@"; }

check "home is served from assets" '[ "$(status $BASE/)" = 200 ] && curl -s $BASE/ | grep -q "<title>Lớp Học Hạnh Phúc</title>"'
check "home carries the _headers CSP" 'curl -sI $BASE/ | grep -qi "content-security-policy: default-src .self."'
check "home carries HSTS" 'curl -sI $BASE/ | grep -qi "strict-transport-security: max-age=31536000; includeSubDomains"'
check "pages can't be framed" 'curl -sI $BASE/ | grep -qi "x-frame-options: DENY"'
check "/giao-vien redirects to /giao-vien/" '[ "$(status $BASE/giao-vien)" = 307 ] || [ "$(status $BASE/giao-vien)" = 308 ]'
for p in dang-nhap doi-mat-khau giao-vien giao-vien/dang-ky giao-vien/lop giao-vien/lop/in-tai-khoan hoc-sinh; do
  check "/$p/ is pre-rendered" "[ \"\$(status $BASE/$p/)\" = 200 ]"
done
check "unknown paths get the 404 page" '[ "$(status $BASE/khong-co/)" = 404 ] && curl -s $BASE/khong-co/ | grep -q "Trang này không có trong vở rồi."'
check "the app icons and manifest are served" \
  '[ "$(status $BASE/apple-touch-icon.png)" = 200 ] && [ "$(status $BASE/icon.svg)" = 200 ] && [ "$(status $BASE/manifest.webmanifest)" = 200 ]'
check "API runs in production mode" 'curl -s $BASE/api/health | grep -q "\"environment\":\"production\""'
check "unknown API routes are JSON 404s" '[ "$(status $BASE/api/nope)" = 404 ]'
check "teacher routes need a session" '[ "$(status $BASE/api/t/classes)" = 401 ]'
wrong_invite() {
  [ "$(status -X POST -H 'content-type: application/json' \
    -d '{"inviteCode":"wrong","username":"cosmoke","displayName":"Cô Smoke","password":"smoke-password"}' "$BASE/api/auth/teacher/register")" = 403 ]
}
check "a wrong invite code is refused" wrong_invite
register() {
  curl -s -D "$TMP/reg.headers" -o /dev/null -H 'content-type: application/json' \
    -d '{"inviteCode":"smoke-invite-code","username":"cosmoke","displayName":"Cô Smoke","password":"smoke-password"}' "$BASE/api/auth/teacher/register"
  grep -qi "^set-cookie: lhhp_sid=.*; HttpOnly; Secure; SameSite=Lax" "$TMP/reg.headers"
}
check "registering sets an HttpOnly, Secure, SameSite=Lax session cookie" register
flood() {
  for _ in $(seq 1 30); do status -X POST -H 'content-type: application/json' -d '{"username":"x","password":"y"}' "$BASE/api/auth/student/login" >/dev/null; done
  [ "$(status -X POST -H 'content-type: application/json' -d '{"username":"x","password":"y"}' "$BASE/api/auth/student/login")" = 429 ]
}
check "sign-in attempts are capped at 30 a minute per IP" flood
check "no errors in the Worker log" '! grep -E "\"level\":\"error\"|✘ \[ERROR\]" "$TMP/dev.log"'

if [ "$fails" -gt 0 ]; then echo "--- wrangler dev log"; tail -40 "$TMP/dev.log"; exit 1; fi
