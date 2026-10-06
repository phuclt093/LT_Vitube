#!/usr/bin/env bash
#
# Cho vitube một địa chỉ HTTPS thật bằng Tailscale — miễn phí, không cần tên miền,
# không phải mở cổng modem.
#
#   ./tailscale.sh            chỉ máy trong mạng Tailscale của bạn (người nhà cài app Tailscale)
#   ./tailscale.sh --public   mở ra internet (Tailscale Funnel) — ai có link cũng vào được
#
# Chạy trên máy đang chạy server vitube (npm start, cổng 3000).
#
set -euo pipefail
die() { printf '\n\033[1;31m[X] %s\033[0m\n\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m[✓]\033[0m %s\n' "$*"; }

PORT="${PORT:-3000}"
MODE=serve
[ "${1:-}" = "--public" ] && MODE=funnel

command -v tailscale >/dev/null || die "Chưa cài Tailscale. Cài bằng:
    curl -fsSL https://tailscale.com/install.sh | sh
rồi chạy:  sudo tailscale up"

tailscale status >/dev/null 2>&1 || die "Tailscale chưa đăng nhập. Chạy: sudo tailscale up"

curl -fsS -o /dev/null "http://127.0.0.1:$PORT/manifest.webmanifest" \
  || die "Không thấy server vitube ở cổng $PORT. Trong vitube-web chạy: npm run build && npm start"
ok "Server vitube đang chạy ở cổng $PORT"

# Lần đầu, Tailscale sẽ in ra một đường link để bật HTTPS (và Funnel) cho mạng của bạn —
# mở link đó trên trình duyệt, bấm bật, rồi chạy lại script này.
sudo tailscale "$MODE" --bg "$PORT"

NAME=$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
URL="https://$NAME"
ok "vitube đã có địa chỉ: $URL"

cat <<MSG

  ─────────────────────────────────────────────────────────────
  1. Thêm dòng này vào vitube-web/.env.local rồi khởi động lại server:

         VITUBE_PUBLIC_URL=$URL

  2. Gửi cho người dùng link:   $URL/install
MSG
if [ "$MODE" = serve ]; then
  echo "     (họ cần cài app Tailscale và đăng nhập cùng mạng của bạn — hoặc chạy lại với --public)"
fi
cat <<MSG

  Tắt:  sudo tailscale $MODE --https=443 off
  ─────────────────────────────────────────────────────────────
MSG
