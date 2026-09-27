#!/usr/bin/env bash
# Moves the app onto the teacher's own domain. Run by Claude when she says she has bought one:
#
#   bash setup/domain.sh lophoccohanh.online
#
# First run: adds the domain to her Cloudflare account and prints the two nameservers she types at the registrar
# (Namecheap → Domain List → Manage → Nameservers → Custom DNS), then exits 3 while Cloudflare waits for them.
# Run it again later (minutes to a few hours): once the zone is Active it deletes the registrar's parked records, turns
# on Always Use HTTPS, sets CUSTOM_DOMAIN and SITE_URL, pushes and watches the deploy. The workers.dev address keeps
# working. Uses the token setup/setup.sh stored in ~/.lop-hoc/cloudflare-token.
set -euo pipefail

DOMAIN="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | sed 's#^https\?://##; s#/.*##; s#^www\.##')"
[[ "$DOMAIN" =~ ^[a-z0-9-]+(\.[a-z0-9-]+)+$ ]] || { echo "usage: bash setup/domain.sh <domain, e.g. lophoccohanh.online>" >&2; exit 2; }

STATE_DIR="$HOME/.lop-hoc"
CF_API="https://api.cloudflare.com/client/v4"
CF_TOKEN="$(cat "$STATE_DIR/cloudflare-token" 2>/dev/null)" || { echo "No Cloudflare token: run setup/setup.sh first." >&2; exit 1; }
cd "$(dirname "$0")/.."
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

cf() {
  if [ -n "${3:-}" ]; then
    curl -sS -X "$1" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data "$3" "$CF_API$2"
  else
    curl -sS -X "$1" -H "Authorization: Bearer $CF_TOKEN" "$CF_API$2"
  fi
}
ok() { [ "$(jq -r .success <<<"$1")" = "true" ] || { echo "Cloudflare refused: $(jq -c .errors <<<"$1")" >&2; exit 1; }; }

# 1. The zone.
zone="$(cf GET "/zones?name=$DOMAIN")"; ok "$zone"
if [ "$(jq '.result | length' <<<"$zone")" = 0 ]; then
  account="$(cf GET /accounts | jq -r '.result[0].id')"
  zone="$(cf POST /zones "$(jq -nc --arg n "$DOMAIN" --arg a "$account" '{name: $n, account: {id: $a}, type: "full"}')")"; ok "$zone"
  zone="$(jq '{result: [.result]}' <<<"$zone")"
fi
ZONE_ID="$(jq -r '.result[0].id' <<<"$zone")"
STATUS="$(jq -r '.result[0].status' <<<"$zone")"

if [ "$STATUS" != "active" ]; then
  cf PUT "/zones/$ZONE_ID/activation_check" >/dev/null || true
  echo "PENDING: $DOMAIN is waiting for its nameservers. At the registrar, replace the nameservers with exactly:"
  jq -r '.result[0].name_servers[] | "  " + .' <<<"$zone"
  echo "Then run this again. Cloudflare usually sees the change within an hour (sometimes up to a day)."
  exit 3
fi
echo "Zone $DOMAIN is active."

# 2. Before the Worker takes the name: the registrar's parking records at the apex and www would block it.
current="$(gh variable list -R "$REPO" --json name,value -q '.[] | select(.name == "CUSTOM_DOMAIN") | .value')"
if [ "$current" != "$DOMAIN" ]; then
  cf GET "/zones/$ZONE_ID/dns_records?per_page=100" |
    jq -r --arg d "$DOMAIN" '.result[] | select((.name == $d or .name == "www." + $d) and (.type == "A" or .type == "AAAA" or .type == "CNAME")) | .id + " " + .type + " " + .name + " " + .content' |
    while read -r id type name content; do
      echo "Deleting parked record $type $name → $content"
      ok "$(cf DELETE "/zones/$ZONE_ID/dns_records/$id")"
    done
fi
ok "$(cf PATCH "/zones/$ZONE_ID/settings/always_use_https" '{"value":"on"}')"

# 3. Point the app at it and deploy.
gh variable set CUSTOM_DOMAIN -R "$REPO" --body "$DOMAIN" >/dev/null
gh variable set SITE_URL -R "$REPO" --body "https://$DOMAIN" >/dev/null
sed -i "s#^| Live site | .*#| Live site | https://$DOMAIN (also on its workers.dev address) |#" TEACHER.md
jq --arg d "WebFetch(domain:$DOMAIN)" '.permissions.allow |= (if index($d) then . else . + [$d] end)' .claude/settings.json >.claude/settings.json.new
mv .claude/settings.json.new .claude/settings.json
git add TEACHER.md .claude/settings.json
git diff --cached --quiet || git commit -q -m "chore: serve the app on $DOMAIN"
git push -q origin master

since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
gh workflow run ci.yml -R "$REPO" --ref master >/dev/null
run_id=""
for _ in $(seq 1 30); do
  run_id="$(gh run list -R "$REPO" -w ci.yml -e workflow_dispatch -L 5 --json databaseId,createdAt \
    -q "[.[] | select(.createdAt >= \"$since\")][0].databaseId // empty")"
  [ -n "$run_id" ] && break
  sleep 4
done
[ -n "$run_id" ] || { echo "CI did not start" >&2; exit 1; }
echo "Deploying: https://github.com/$REPO/actions/runs/$run_id"
gh run watch "$run_id" -R "$REPO" --exit-status --interval 20 >/dev/null
for _ in $(seq 1 30); do curl -sf "https://$DOMAIN/api/health" | grep -q '"environment":"production"' && break; sleep 10; done
curl -sf "https://$DOMAIN/api/health" | grep -q '"environment":"production"' || { echo "Deployed, but https://$DOMAIN is not answering yet" >&2; exit 1; }
echo "LIVE: https://$DOMAIN"
