#!/bin/sh
set -eu
# Wait for wrangler to create the local D1 file, then browse it read-only.
for i in $(seq 1 60); do
  DB_FILE=$(find /data/v3/d1 -name '*.sqlite' ! -name 'metadata.sqlite' 2>/dev/null | head -n 1 || true)
  [ -n "${DB_FILE:-}" ] && break
  sleep 1
done
if [ -z "${DB_FILE:-}" ]; then echo "no D1 database under /data/v3/d1" >&2; exit 1; fi
echo "browsing $DB_FILE"
exec sqlite_web --host 0.0.0.0 --port 8081 --read-only --no-browser "$DB_FILE"
