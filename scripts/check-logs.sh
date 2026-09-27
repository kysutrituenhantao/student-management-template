#!/usr/bin/env bash
# Fails if the running stack logged anything that looks like a real problem.
# Expected noise (wrong passwords and invite codes the tests try on purpose) is allowed.
set -uo pipefail

since="${1:-}"
args=(--no-color)
[ -n "$since" ] && args+=(--since "$since")

fail=0
report() { echo "✘ $1"; echo "$2" | head -20 | sed 's/^/    /'; fail=1; }

api=$(docker compose logs "${args[@]}" api 2>&1)
errors=$(echo "$api" | grep -E '"level":"error"|\[ERROR\]|Uncaught|unhandled' || true)
[ -n "$errors" ] && report "api logged errors" "$errors"

warns=$(echo "$api" | grep -E '"level":"warn"' | grep -vE 'login_failed|login_locked|invite_code_rejected' || true)
[ -n "$warns" ] && report "api logged unexpected warnings" "$warns"

edge5xx=$(docker compose logs "${args[@]}" edge 2>&1 | grep -E '"status":5[0-9]{2}' || true)
[ -n "$edge5xx" ] && report "edge served 5xx responses" "$edge5xx"

web=$(docker compose logs "${args[@]}" web 2>&1 | grep -E '\[(error|crit|alert|emerg)\]' || true)
[ -n "$web" ] && report "web (nginx) logged errors" "$web"

db=$(docker compose logs "${args[@]}" db 2>&1 | grep -iE 'panic|traceback|fatal' || true)
[ -n "$db" ] && report "db logged failures" "$db"

requests=$(echo "$api" | grep -c '"msg":"request"' || true)
if [ "$fail" -eq 0 ]; then
  echo "✔ logs clean ($requests API requests checked)"
fi
exit "$fail"
