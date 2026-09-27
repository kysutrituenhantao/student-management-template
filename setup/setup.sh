#!/usr/bin/env bash
# One-time install of a teacher's own copy of Lớp Học Hạnh Phúc, on WSL Ubuntu (or any Ubuntu/Debian).
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/<template>/master/setup/setup.sh)   # nothing downloaded yet
#   bash setup/setup.sh                                                                     # from a copy or a clone
#
# Safe to run again: every step checks whether it is already done, so after a failure the teacher just reruns it.
# Talks to the teacher in Vietnamese; docs/DEPLOY.md ("First deploy") describes each step in English.
# Flags: --new-invite-code  rotate TEACHER_INVITE_CODE.
# shellcheck disable=SC2024  # installer output goes to her own log: only the command needs sudo, not the file
set -Eeuo pipefail

TEMPLATE_REPO="${LOPHOC_TEMPLATE:-haophuongwedding/student-management-template}"
APP_DIR="${LOPHOC_DIR:-$HOME/lop-hoc}"
STATE_DIR="$HOME/.lop-hoc"
REPO_NAME="${LOPHOC_REPO_NAME:-lop-hoc-hanh-phuc}"
WORKER="lop-hoc-hanh-phuc" # apps/api/wrangler.jsonc "name" and the D1 database_name
CF_API="https://api.cloudflare.com/client/v4"
NEW_INVITE=0
for arg in "$@"; do
  case "$arg" in
    --new-invite-code) NEW_INVITE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

# ---------- talking to the teacher ----------

bold=$'\e[1m'; green=$'\e[32m'; yellow=$'\e[33m'; red=$'\e[31m'; off=$'\e[0m'
step() { printf '\n%s━━ %s ━━%s\n' "$bold$green" "$*" "$off"; }
say() { printf '%s\n' "$*"; }
warn() { printf '%s%s%s\n' "$yellow" "$*" "$off"; }
die() {
  printf '\n%s%s%s\n' "$red" "$*" "$off" >&2
  printf 'Chi tiết kỹ thuật: ~/.lop-hoc/install.log\n' >&2
  printf 'Cô chạy lại đúng dòng lệnh cài đặt là máy làm tiếp từ chỗ này. Vẫn lỗi thì chụp màn hình gửi người giúp cô.\n' >&2
  exit 1
}
trap 'die "Có một bước chưa xong (dòng $LINENO)."' ERR

# Prompts read from the terminal, so this also works when the script itself arrives through a pipe.
ask() { # ask VAR "question" [default]
  local answer=""
  if [ -n "${3:-}" ]; then printf '%s%s%s [%s]: ' "$bold" "$2" "$off" "$3" >/dev/tty; else printf '%s%s%s: ' "$bold" "$2" "$off" >/dev/tty; fi
  IFS= read -r answer </dev/tty || true
  printf -v "$1" '%s' "${answer:-${3:-}}"
}
ask_secret() { # ask_secret VAR "question" — nothing is echoed
  local answer=""
  printf '%s%s%s: ' "$bold" "$2" "$off" >/dev/tty
  IFS= read -rs answer </dev/tty || true
  printf '\n' >/dev/tty
  printf -v "$1" '%s' "$answer"
}
pause() { printf '%s%s%s' "$bold" "${1:-Xong thì bấm Enter để đi tiếp...}" "$off" >/dev/tty; read -r _ </dev/tty || true; }

# Open a page in the Windows browser from WSL; elsewhere, print it.
open_url() {
  if command -v rundll32.exe >/dev/null 2>&1; then
    rundll32.exe url.dll,FileProtocolHandler "$1" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 || true
  fi
  say "Nếu trình duyệt chưa tự mở, cô mở trang này:"
  say "  $1"
}

# ---------- 0. where we are ----------

[ "$(id -u)" -ne 0 ] || die "Đừng chạy bằng quyền root (sudo). Chạy thẳng: bash setup/setup.sh"
[ -r /etc/debian_version ] || die "Bản cài này dành cho Ubuntu (trong WSL trên Windows)."
USER="${USER:-$(id -un)}"
IN_WSL=0; grep -qi microsoft /proc/version 2>/dev/null && IN_WSL=1
case "$PWD" in /mnt/*) cd "$HOME" ;; esac # the Windows drives are slow and confuse git's file modes

SRC_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  [ -f "$candidate/CLAUDE.md" ] && [ -f "$candidate/setup/setup.sh" ] && SRC_DIR="$candidate"
fi
mkdir -p "$STATE_DIR" && chmod 700 "$STATE_DIR"
STATE="$STATE_DIR/state.env"
LOG="$STATE_DIR/install.log" # installers' chatter goes here, not on her screen
touch "$STATE" && chmod 600 "$STATE"
# shellcheck disable=SC1090
. "$STATE"
remember() { # remember KEY VALUE — kept between runs in ~/.lop-hoc/state.env
  local tmp; tmp="$(mktemp)"
  grep -v "^$1=" "$STATE" >"$tmp" || true
  printf '%s=%q\n' "$1" "$2" >>"$tmp"
  mv "$tmp" "$STATE" && chmod 600 "$STATE"
  printf -v "$1" '%s' "$2"
}

cat <<'EOF'

  🌱  Cài đặt Lớp Học Hạnh Phúc

  Máy sẽ tự cài mọi thứ. Cô chỉ cần:
    • gõ mật khẩu Ubuntu khi được hỏi (gõ không hiện chữ, cứ gõ rồi Enter),
    • đăng nhập 4 lần trong trình duyệt: GitHub, Cloudflare (2 lần), Claude,
    • trả lời vài câu về lớp của cô.
  Mất khoảng 30–45 phút, phần lớn là chờ. Đừng đóng cửa sổ này.

EOF
pause "Bấm Enter để bắt đầu..."

# ---------- 1. tools ----------

step "1/8 · Cài công cụ"
sudo -v || die "Chưa đúng mật khẩu Ubuntu."

missing=()
for pkg in git curl ca-certificates jq openssl tmux unzip; do dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg"); done
if [ "${#missing[@]}" -gt 0 ]; then
  say "Đang cài: ${missing[*]}"
  sudo apt-get update -qq >>"$LOG" 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}" >>"$LOG" 2>&1
fi

# Docker Engine inside WSL: no Docker Desktop window, licence prompt or tray icon to keep alive.
if ! command -v docker >/dev/null 2>&1; then
  say "Đang cài Docker..."
  curl -fsSL https://get.docker.com | sudo sh >>"$LOG" 2>&1
fi
NEED_RELOGIN=0
if ! id -nG "$USER" | grep -qw docker && getent group docker >/dev/null; then
  sudo usermod -aG docker "$USER"
  NEED_RELOGIN=1
fi
if [ -d /run/systemd/system ]; then
  sudo systemctl enable --now docker >/dev/null 2>&1 || true
else
  # Docker needs systemd to start with WSL. New Ubuntu images have it on; older ones need this and a WSL restart.
  if ! grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null; then
    printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf >/dev/null
  fi
  sudo service docker start >/dev/null 2>&1 || true
fi
sudo docker info >/dev/null 2>&1 || warn "Docker chưa chạy. Sau khi cài xong, khởi động lại máy tính là được."

# Node 22 through nvm, as .nvmrc says.
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  say "Đang cài Node.js..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash >>"$LOG" 2>&1
fi
set +u
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 22 >>"$LOG" 2>&1
nvm alias default 22 >/dev/null
nvm use 22 >/dev/null
set -u

if ! command -v gh >/dev/null 2>&1; then
  say "Đang cài GitHub CLI..."
  sudo mkdir -p -m 755 /etc/apt/keyrings
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" |
    sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -qq >>"$LOG" 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq gh >>"$LOG" 2>&1
fi

export PATH="$HOME/.local/bin:$PATH"
if ! command -v claude >/dev/null 2>&1; then
  say "Đang cài Claude Code..."
  curl -fsSL https://claude.ai/install.sh | bash >>"$LOG" 2>&1
fi
grep -q 'HOME/.local/bin' "$HOME/.bashrc" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >>"$HOME/.bashrc"
say "✓ Công cụ đã sẵn sàng."

# ---------- 2. GitHub ----------

step "2/8 · Đăng nhập GitHub"
export BROWSER="${BROWSER:-}"
if [ "$IN_WSL" = 1 ] && [ -z "$BROWSER" ]; then
  printf '#!/bin/sh\nrundll32.exe url.dll,FileProtocolHandler "$1"\n' >"$STATE_DIR/open-url" && chmod +x "$STATE_DIR/open-url"
  export BROWSER="$STATE_DIR/open-url"
fi
if ! gh auth status -h github.com >/dev/null 2>&1; then
  say "Máy sẽ hiện một mã 8 ký tự (dạng ABCD-1234) rồi mở trang GitHub."
  say "Cô bấm Enter, dán mã đó vào trang GitHub, bấm Continue rồi Authorize."
  gh auth login -h github.com -p https -w -s workflow </dev/tty
fi
# The workflow scope lets Claude push changes to .github/workflows later.
if ! gh api -i user 2>/dev/null | grep -i '^x-oauth-scopes:' | grep -q workflow; then
  say "Cần thêm một quyền nhỏ trên GitHub, làm như vừa rồi:"
  gh auth refresh -h github.com -s workflow </dev/tty
fi
gh auth setup-git >/dev/null
GH_USER="$(gh api user -q .login)"
git config --global user.name >/dev/null || git config --global user.name "$(gh api user -q '.name // .login')"
git config --global user.email >/dev/null || git config --global user.email "$(gh api user -q .id)+${GH_USER}@users.noreply.github.com"
git config --global init.defaultBranch master
say "✓ GitHub: $GH_USER"

# ---------- 3. her own copy of the code ----------

step "3/8 · Tạo kho mã riêng của cô"
REPO="$GH_USER/$REPO_NAME"
if [ -d "$APP_DIR/.git" ]; then
  say "Đã có thư mục $APP_DIR."
  REPO="$(cd "$APP_DIR" && gh repo view --json nameWithOwner -q .nameWithOwner)"
  git -C "$APP_DIR" pull --ff-only -q || warn "Chưa kéo được bản mới nhất, dùng bản đang có."
elif [ -n "$SRC_DIR" ] && [ ! -d "$SRC_DIR/.git" ]; then
  # Unzipped from a file: this folder becomes her repo.
  [ "$SRC_DIR" = "$APP_DIR" ] || cp -a "$SRC_DIR" "$APP_DIR"
  git -C "$APP_DIR" init -q
  git -C "$APP_DIR" add -A
  git -C "$APP_DIR" commit -q -m "Start from the Lớp Học Hạnh Phúc template"
  gh repo create "$REPO" --private --source "$APP_DIR" --remote origin --push >/dev/null
else
  if ! gh repo view "$REPO" >/dev/null 2>&1; then
    gh repo create "$REPO" --private --template "$TEMPLATE_REPO" >/dev/null
    # GitHub copies the template in the background; wait for the first commit before cloning.
    for _ in $(seq 1 30); do gh api "repos/$REPO/commits?per_page=1" >/dev/null 2>&1 && break; sleep 2; done
  fi
  gh repo clone "$REPO" "$APP_DIR" -- -q
fi
[ "$REPO" != "$TEMPLATE_REPO" ] || die "Thư mục $APP_DIR đang là bản mẫu, không phải kho riêng của cô. Đổi tên nó (mv $APP_DIR ${APP_DIR}-mau) rồi chạy lại."
remember REPO "$REPO"
cd "$APP_DIR"
say "✓ Mã của cô: https://github.com/$REPO (riêng tư, chỉ cô xem được)"

say "Đang tải các thư viện (vài phút)..."
npm ci --no-audit --no-fund --loglevel=error >>"$LOG" 2>&1
say "✓ Xong."

# ---------- 4. who she is ----------

step "4/8 · Vài câu về lớp của cô"
if [ -z "${T_DISPLAY:-}" ]; then
  ask T_DISPLAY "Học sinh và phụ huynh gọi cô là gì? (ví dụ: Cô Hạnh)"
  ask T_FULLNAME "Họ và tên đầy đủ của cô"
  ask T_CLASS "Cô chủ nhiệm lớp nào? (ví dụ: 4A)"
  ask T_SCHOOL "Trường nào? (ví dụ: Trường Tiểu học Kim Đồng)"
  ask T_HELPER "Ai giúp cô cài máy? (tên người đó; tự cài thì bấm Enter)"
  for k in T_DISPLAY T_FULLNAME T_CLASS T_SCHOOL T_HELPER; do remember "$k" "${!k}"; done
fi
say "✓ ${T_DISPLAY}, lớp ${T_CLASS}, ${T_SCHOOL}."

# ---------- 5. Cloudflare ----------

step "5/8 · Đăng nhập Cloudflare"
if ! (cd apps/api && npx wrangler whoami 2>&1) | grep -qi "logged in"; then
  say "Trình duyệt sẽ mở trang Cloudflare. Cô đăng nhập rồi bấm Allow."
  pause
  (cd apps/api && npx wrangler login </dev/tty)
fi

cf() { # cf METHOD PATH [JSON] — the Cloudflare API with her token
  local method="$1" path="$2"
  if [ -n "${3:-}" ]; then
    curl -sS -X "$method" -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" --data "$3" "$CF_API$path"
  else
    curl -sS -X "$method" -H "Authorization: Bearer $CF_TOKEN" "$CF_API$path"
  fi
}
TOKEN_FILE="$STATE_DIR/cloudflare-token"
CF_TOKEN=""
[ -s "$TOKEN_FILE" ] && CF_TOKEN="$(cat "$TOKEN_FILE")"
if [ -z "$CF_TOKEN" ] || [ "$(cf GET /user/tokens/verify | jq -r .success)" != "true" ]; then
  perms='[{"key":"workers_scripts","type":"edit"},{"key":"workers_routes","type":"edit"},{"key":"d1","type":"edit"},{"key":"zone","type":"edit"},{"key":"dns","type":"edit"},{"key":"zone_settings","type":"edit"},{"key":"account_settings","type":"read"}]'
  url="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=$(jq -rn --arg p "$perms" '$p|@uri')&accountId=*&zoneId=all&name=lop-hoc-hanh-phuc-deploy"
  say ""
  say "Bây giờ tạo một \"chìa khoá\" để GitHub được phép đưa trang web lên Cloudflare."
  say "Trang Cloudflare sẽ mở với mọi thứ điền sẵn. Cô chỉ cần:"
  say "  1) kéo xuống cuối, bấm  Continue to summary"
  say "  2) bấm  Create Token"
  say "  3) bấm nút Copy cạnh dãy chữ dài vừa hiện ra"
  pause "Bấm Enter để mở trang..."
  open_url "$url"
  while :; do
    ask_secret CF_TOKEN "Dán chìa khoá vào đây (chuột phải để dán, sẽ không hiện chữ) rồi Enter"
    CF_TOKEN="$(printf '%s' "$CF_TOKEN" | tr -d '[:space:]')"
    [ "$(cf GET /user/tokens/verify | jq -r .success)" = "true" ] && break
    warn "Chìa khoá này chưa đúng. Cô bấm Copy lần nữa rồi dán lại nhé."
  done
  (umask 077 && printf '%s' "$CF_TOKEN" >"$TOKEN_FILE")
fi
printf '%s' "$CF_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN -R "$REPO" >/dev/null

accounts="$(cf GET /accounts)"
[ "$(jq -r '.result | length' <<<"$accounts")" -ge 1 ] || die "Chìa khoá không thấy tài khoản Cloudflare nào. Tạo lại chìa khoá theo đúng trang đã mở."
CF_ACCOUNT="$(jq -r '.result[0].id' <<<"$accounts")"
printf '%s' "$CF_ACCOUNT" | gh secret set CLOUDFLARE_ACCOUNT_ID -R "$REPO" >/dev/null
say "✓ Cloudflare: $(jq -r '.result[0].name' <<<"$accounts")"

# ---------- 6. database, address, invite code ----------

step "6/8 · Tạo cơ sở dữ liệu và địa chỉ trang web"
DB_ID="$(cf GET "/accounts/$CF_ACCOUNT/d1/database?name=$WORKER" | jq -r --arg n "$WORKER" '[.result[]? | select(.name == $n)][0].uuid // empty')"
if [ -z "$DB_ID" ]; then
  created="$(cf POST "/accounts/$CF_ACCOUNT/d1/database" "$(jq -nc --arg n "$WORKER" '{name: $n, primary_location_hint: "apac"}')")"
  DB_ID="$(jq -r '.result.uuid // empty' <<<"$created")"
  [ -n "$DB_ID" ] || die "Chưa tạo được cơ sở dữ liệu: $(jq -c .errors <<<"$created")"
fi
gh variable set D1_DATABASE_ID -R "$REPO" --body "$DB_ID" >/dev/null

# Every Cloudflare account picks one <name>.workers.dev once; the app lives at lop-hoc-hanh-phuc.<name>.workers.dev.
SUB="$(cf GET "/accounts/$CF_ACCOUNT/workers/subdomain" | jq -r '.result.subdomain // empty')"
if [ -z "$SUB" ]; then
  base="$(printf '%s' "$GH_USER" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9-' '-' | sed 's/^-*//; s/-*$//' | cut -c1-40)"
  for candidate in "$base" "$base-lophoc" "$base-$(openssl rand -hex 2)"; do
    res="$(cf PUT "/accounts/$CF_ACCOUNT/workers/subdomain" "$(jq -nc --arg s "$candidate" '{subdomain: $s}')")"
    if [ "$(jq -r .success <<<"$res")" = "true" ]; then SUB="$candidate"; break; fi
  done
  [ -n "$SUB" ] || die "Chưa đặt được tên workers.dev: $(jq -c .errors <<<"$res"). Nếu Cloudflare báo cần xác nhận email, cô mở hộp thư bấm xác nhận rồi chạy lại."
fi
DOMAIN="$(gh variable list -R "$REPO" --json name,value -q '.[] | select(.name == "CUSTOM_DOMAIN") | .value')"
if [ -n "$DOMAIN" ]; then
  SITE_URL="https://$DOMAIN"
else
  SITE_URL="https://$WORKER.$SUB.workers.dev"
  gh variable set SITE_URL -R "$REPO" --body "$SITE_URL" >/dev/null
fi
remember SITE_URL "$SITE_URL"

INVITE_FILE="$STATE_DIR/ma-moi.txt"
if [ "$NEW_INVITE" = 1 ] || [ ! -s "$INVITE_FILE" ]; then
  (umask 077 && openssl rand -base64 12 | tr -d '/+=\n' >"$INVITE_FILE")
fi
gh secret set TEACHER_INVITE_CODE -R "$REPO" <"$INVITE_FILE" >/dev/null
say "✓ Địa chỉ trang web: $SITE_URL"

# ---------- 7. first deploy and her teacher account ----------

step "7/8 · Đưa trang web lên mạng"
cat >TEACHER.md <<EOF
# This install

| | |
| --- | --- |
| Teacher | **${T_FULLNAME:-$T_DISPLAY}** — the children and families call her "${T_DISPLAY}" |
| Class | ${T_CLASS}, ${T_SCHOOL} |
| Helper | ${T_HELPER:-none — she set the laptop up herself} |
| Live site | ${SITE_URL} |
| Repo | https://github.com/${REPO} (private), branch \`master\` |
| Laptop | Windows + WSL, repo at \`${APP_DIR}\`, phone sessions from \`claude remote-control\` (tmux session \`lophoc\`) |

Written by \`setup/setup.sh\` on $(date +%F). \`setup/domain.sh\` updates the live site when she adds her own domain.
EOF
if ! git diff --quiet -- TEACHER.md; then
  git add TEACHER.md
  git commit -q -m "chore: record who this install is for"
  git push -q origin master
fi

healthy() { curl -sf "$SITE_URL/api/health" 2>/dev/null | grep -q '"environment":"production"'; }
if healthy; then
  say "✓ Trang web đã chạy từ trước."
else
  say "Máy đang kiểm tra toàn bộ ứng dụng rồi mới đưa lên mạng: khoảng 15 phút. Cô cứ để máy chạy."
  since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  gh workflow run ci.yml -R "$REPO" --ref master >/dev/null
  run_id=""
  for _ in $(seq 1 30); do
    run_id="$(gh run list -R "$REPO" -w ci.yml -e workflow_dispatch -L 5 --json databaseId,createdAt \
      -q "[.[] | select(.createdAt >= \"$since\")][0].databaseId // empty")"
    [ -n "$run_id" ] && break
    sleep 4
  done
  [ -n "$run_id" ] || die "GitHub chưa bắt đầu chạy. Mở https://github.com/$REPO/actions xem có bị tắt không."
  gh run watch "$run_id" -R "$REPO" --exit-status --interval 20 ||
    die "Bước kiểm tra trên GitHub bị lỗi. Xem chi tiết: https://github.com/$REPO/actions/runs/$run_id"
  for _ in $(seq 1 30); do healthy && break; sleep 10; done
  healthy || die "Đã đưa lên nhưng $SITE_URL chưa trả lời. Đợi 5 phút rồi chạy lại."
  say "✓ Trang web đã lên: $SITE_URL"
fi

if [ "${REGISTERED:-}" != 1 ]; then
  say ""
  say "Giờ tạo tài khoản giáo viên của cô trên trang web."
  while :; do
    ask T_USER "Tên đăng nhập (chữ không dấu, viết liền, ví dụ: cohanh)"
    [[ "$T_USER" =~ ^[a-zA-Z0-9._-]{3,32}$ ]] || { warn "Chỉ dùng chữ không dấu và số, 3 đến 32 ký tự."; continue; }
    ask_secret T_PASS "Mật khẩu (ít nhất 8 ký tự, gõ không hiện chữ)"
    [ "${#T_PASS}" -ge 8 ] || { warn "Mật khẩu cần ít nhất 8 ký tự."; continue; }
    ask_secret T_PASS2 "Gõ lại mật khẩu"
    [ "$T_PASS" = "$T_PASS2" ] || { warn "Hai lần gõ chưa giống nhau."; continue; }
    status="$(jq -nc --arg c "$(cat "$INVITE_FILE")" --arg u "$T_USER" --arg d "$T_DISPLAY" --arg p "$T_PASS" \
      '{inviteCode: $c, username: $u, displayName: $d, password: $p}' |
      curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data @- "$SITE_URL/api/auth/teacher/register")"
    case "$status" in
      201) break ;;
      409)
        # A reinstall on a new laptop finds her account already there.
        again=""
        ask again "Tên này đã có. Đây là tài khoản của chính cô từ trước (cài lại máy)? (c/k)" "k"
        [ "$again" = "c" ] && break
        warn "Chọn tên đăng nhập khác nhé." ;;
      *) die "Chưa tạo được tài khoản (mã $status)." ;;
    esac
  done
  unset T_PASS T_PASS2
  remember T_USER "$T_USER"
  remember REGISTERED 1
fi
say "✓ Tài khoản giáo viên: $T_USER"

# ---------- 8. the laptop answers the phone ----------

step "8/8 · Nối máy tính với điện thoại"
RC_NAME="$(printf 'Lớp %s – %s' "$T_CLASS" "$T_DISPLAY" | tr -d "'\"\\\\\`$")"
mkdir -p "$HOME/.local/bin"
cat >"$HOME/.local/bin/lophoc" <<EOF
#!/usr/bin/env bash
# Claude in the class app, typed on the laptop itself.
cd "$APP_DIR" && exec claude --dangerously-skip-permissions "\$@"
EOF
cat >"$HOME/.local/bin/lophoc-remote" <<EOF
#!/usr/bin/env bash
# Keeps "claude remote-control" running in tmux session "lophoc", so the Claude app on her phone can start sessions
# here. Started by Windows at sign-in (Startup folder); --foreground keeps the window attached, which keeps WSL awake.
export NVM_DIR="\$HOME/.nvm"; [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh" >/dev/null
export PATH="\$HOME/.local/bin:\$PATH"
cd "$APP_DIR" || exit 1
tmux has-session -t lophoc 2>/dev/null ||
  tmux new-session -d -s lophoc -c "$APP_DIR" \\
    "while :; do claude remote-control --name '${RC_NAME}' --permission-mode bypassPermissions; echo 'Khởi động lại sau 30 giây...'; sleep 30; done"
[ "\${1:-}" = "--foreground" ] && exec tmux attach -t lophoc
exit 0
EOF
chmod +x "$HOME/.local/bin/lophoc" "$HOME/.local/bin/lophoc-remote"

# Phone sessions run without permission prompts: nobody is at the laptop to answer them. CLAUDE.md, and the deny list in
# .claude/settings.json, are what steer them away from secrets and from deleting data.
mkdir -p "$HOME/.claude"
[ -s "$HOME/.claude/settings.json" ] || echo '{}' >"$HOME/.claude/settings.json"
jq '. + {skipDangerousModePermissionPrompt: true, remoteControlAtStartup: true}' "$HOME/.claude/settings.json" >"$HOME/.claude/settings.json.new" &&
  mv "$HOME/.claude/settings.json.new" "$HOME/.claude/settings.json"

if [ "$IN_WSL" = 1 ]; then
  appdata="$(cd /mnt/c 2>/dev/null && cmd.exe /c 'echo %APPDATA%' 2>/dev/null | tr -d '\r')"
  if [ -n "$appdata" ]; then
    startup="$(wslpath "$appdata")/Microsoft/Windows/Start Menu/Programs/Startup"
    mkdir -p "$startup"
    printf '@echo off\r\ntitle Lop Hoc Hanh Phuc - thu nho cua so nay, DUNG DONG\r\nwsl.exe -d %s -- bash -lc "~/.local/bin/lophoc-remote --foreground"\r\n' \
      "${WSL_DISTRO_NAME:-Ubuntu}" >"$startup/lop-hoc-hanh-phuc.bat"
    say "✓ Máy sẽ tự nối với điện thoại mỗi khi Windows khởi động."
  fi
fi

if [ ! -s "$HOME/.claude/.credentials.json" ]; then
  cat <<'EOF'

Bây giờ đăng nhập Claude (lần cuối cùng):
  • Nếu hỏi giao diện: bấm Enter.
  • Chọn "Claude account with subscription", đăng nhập trong trình duyệt.
    Nếu trang hiện một mã, chép mã đó dán vào đây rồi Enter.
  • Nếu hỏi có tin thư mục này / chế độ bỏ qua xác nhận: chọn Yes / Yes, I accept.
  • Khi thấy ô để gõ chữ, gõ  /exit  rồi Enter.
EOF
  pause "Bấm Enter để bắt đầu..."
  (cd "$APP_DIR" && claude --dangerously-skip-permissions </dev/tty) || true
fi

cat <<EOF

${bold}${green}🎉 Xong rồi!${off}

  Trang web của lớp:   ${bold}${SITE_URL}${off}
  Đăng nhập giáo viên: ${bold}${T_USER}${off} (mật khẩu cô vừa đặt)
  Mã mời (cho đồng nghiệp muốn có tài khoản): $(cat "$INVITE_FILE")

  Cửa sổ tiếp theo là "đường dây" nối máy với điện thoại. Nếu nó hỏi
  "Enable Remote Control?", gõ ${bold}y${off} rồi Enter. Sau đó ${bold}thu nhỏ${off} cửa sổ, đừng đóng.

  Trên điện thoại: mở ứng dụng Claude → mục Code → chọn "${RC_NAME}"
  rồi nhắn như nhắn cho đồng nghiệp: "Cô muốn thêm ...".
EOF
[ "$NEED_RELOGIN" = 1 ] && warn "Lần đầu cài Docker: sau bước này cô khởi động lại máy tính một lần cho chắc."
pause "Bấm Enter để mở đường dây..."
trap - ERR
# sg starts it with the docker group Docker's installer just added, without signing out first.
if [ "$NEED_RELOGIN" = 1 ]; then exec sg docker -c "$HOME/.local/bin/lophoc-remote --foreground"; fi
exec "$HOME/.local/bin/lophoc-remote" --foreground
