#!/bin/sh
# migrate: apply D1 migrations to the local D1 at /data, and on a fresh database load the sample class (SEED_DEMO=1).
# serve:   migrate, then run the Worker with wrangler dev.
set -eu
cd /app/apps/api

# Local secrets and overrides (wrangler reads .dev.vars on top of wrangler.jsonc vars).
cat > .dev.vars <<VARS
ENVIRONMENT=${ENVIRONMENT:-development}
LOG_LEVEL=${LOG_LEVEL:-info}
SITE_URL=${SITE_URL:-http://localhost:8080}
TEACHER_INVITE_CODE=${TEACHER_INVITE_CODE}
VARS

d1() { npx wrangler d1 "$@" --local --persist-to /data; }

migrate() {
  d1 migrations apply lop-hoc-hanh-phuc
  if [ "${SEED_DEMO:-0}" = "1" ]; then
    teachers=$(d1 execute lop-hoc-hanh-phuc --command "SELECT COUNT(*) AS n FROM teachers" --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].results[0].n))')
    if [ "$teachers" = "0" ]; then
      npx tsx scripts/seed-demo.ts --out /tmp/demo.sql
      d1 execute lop-hoc-hanh-phuc --file /tmp/demo.sql > /tmp/seed.log
      echo "seeded the sample class (teacher codemo / demo-lop-hoc)"
    else
      echo "database already has $teachers teacher(s): no sample data added"
    fi
  fi
}

case "${1:-serve}" in
  migrate)
    migrate
    ;;
  serve)
    # Same order as a deploy: migrations, then the Worker.
    migrate
    exec npx wrangler dev --ip 0.0.0.0 --port 8787 --persist-to /data --show-interactive-dev-session=false
    ;;
  *)
    exec "$@"
    ;;
esac
