#!/usr/bin/env bash
#
# Chạy vitube + mở một địa chỉ HTTPS tạm thời để thử trên điện thoại — MỘT LỆNH.
#
#   ./vitube_PWA/start.sh
#
# Không cần tài khoản, không cần tên miền: dùng "Quick Tunnel" miễn phí của Cloudflare,
# cho một địa chỉ dạng https://ten-ngau-nhien.trycloudflare.com. Địa chỉ ĐỔI mỗi lần
# chạy lại — hợp để thử, không hợp để dùng lâu (biểu tượng đã cài sẽ trỏ vào địa chỉ
# cũ). Dùng lâu dài: xem README, mục "Host".
#
# Ctrl+C để tắt cả server lẫn đường hầm.
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="$(cd "$HERE/../vitube-web" && pwd)"
PORT="${PORT:-3000}"
LOGS="$HERE/logs"; BIN="$HERE/bin"
mkdir -p "$LOGS" "$BIN"

die()  { printf '\n\033[1;31m[X] %s\033[0m\n\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m[✓]\033[0m %s\n' "$*"; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# nạp NVM nếu Node cài qua đó
if [ -s "$HOME/.nvm/nvm.sh" ]; then export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" 2>/dev/null || true; fi
command -v node >/dev/null || die "Chưa có Node.js. Cài Node 22 rồi chạy lại."

SERVER_PID=""; TUNNEL_PID=""
cleanup() {
  echo
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  ok "Đã tắt."
}
trap cleanup EXIT INT TERM

cd "$WEB"

# ---- 1. thư viện + yt-dlp ----
step "1/4  Kiểm tra thư viện"
[ -d node_modules ] || npm install --no-audit --no-fund
[ -x bin/yt-dlp ] || npm run setup:ytdlp
ok "Đủ thư viện và yt-dlp"

# ---- 2. build (chỉ khi mã nguồn mới hơn bản build) ----
step "2/4  Bản build"
if [ ! -f .next/BUILD_ID ] || [ -n "$(find src public next.config.mjs -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]; then
  echo "  Mã nguồn đã đổi — build lại (lần đầu mất vài phút)…"
  npm run build > "$LOGS/build.log" 2>&1 || { tail -30 "$LOGS/build.log"; die "Build hỏng — log đầy đủ: $LOGS/build.log"; }
fi
ok "Bản build sẵn sàng (service worker chỉ bật ở bản build, không phải npm run dev)"

# ---- 3. đường hầm HTTPS (trước server, để biết địa chỉ công khai) ----
step "3/4  Địa chỉ HTTPS"
CF="$(command -v cloudflared || true)"
if [ -z "$CF" ]; then
  CF="$BIN/cloudflared"
  if [ ! -x "$CF" ]; then
    case "$(uname -m)" in
      x86_64) ARCH=amd64 ;; aarch64|arm64) ARCH=arm64 ;; armv7l) ARCH=arm ;;
      *) die "Chưa hỗ trợ kiến trúc $(uname -m) — cài cloudflared bằng tay." ;;
    esac
    echo "  Tải cloudflared (một lần)…"
    curl -fsSL -o "$CF" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH" \
      || die "Không tải được cloudflared"
    chmod +x "$CF"
  fi
fi

"$CF" tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$LOGS/tunnel.log" 2>&1 &
TUNNEL_PID=$!

URL=""
for _ in $(seq 1 40); do
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1 || true)"
  [ -n "$URL" ] && break
  kill -0 "$TUNNEL_PID" 2>/dev/null || { tail -20 "$LOGS/tunnel.log"; die "Đường hầm tắt ngang — log: $LOGS/tunnel.log"; }
  sleep 1
done
[ -n "$URL" ] || die "Chưa lấy được địa chỉ sau 40 giây — xem $LOGS/tunnel.log"

# ---- 4. server ----
# Truyền sẵn địa chỉ công khai: file cài đặt iPhone ghi đúng https://…trycloudflare.com
# mà không phải trông vào việc đường hầm có báo "https" cho server hay không.
step "4/4  Server vitube"
if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/manifest.webmanifest" 2>/dev/null; then
  ok "Server đã chạy sẵn ở cổng $PORT — dùng luôn (nếu file cài iPhone ghi nhầm http://, tắt server đó rồi chạy lại script)"
else
  VITUBE_PUBLIC_URL="$URL" PORT="$PORT" npx next start -p "$PORT" > "$LOGS/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/manifest.webmanifest" 2>/dev/null && break
    kill -0 "$SERVER_PID" 2>/dev/null || { tail -20 "$LOGS/server.log"; die "Server tắt ngang — log: $LOGS/server.log"; }
    sleep 1
  done
  ok "Server chạy ở cổng $PORT"
fi

# Cloudflare cần vài giây để địa chỉ mới có hiệu lực trên toàn mạng
for _ in $(seq 1 20); do curl -fsS -o /dev/null "$URL/manifest.webmanifest" 2>/dev/null && break; sleep 1; done

INSTALL="$URL/install"
printf '\n\033[1;32m  vitube đang chạy tại:\033[0m  %s\n' "$URL"
printf '\033[1m  Mở trên điện thoại:\033[0m    %s\n' "$INSTALL"
printf '\033[1m  Kiểm tra cửa sổ nổi:\033[0m   %s\n\n' "$URL/debug/pip"

if command -v qrencode >/dev/null; then
  echo "  Quét mã này bằng Camera của iPhone:"
  qrencode -t ansiutf8 -m 2 "$INSTALL"
else
  echo "  (Muốn hiện mã QR để quét bằng camera: sudo apt install qrencode)"
fi

cat <<MSG

  Trên iPhone: mở link bằng Safari → Tải file cài đặt → Cài đặt → "Đã tải về hồ sơ" → Cài đặt.

  Lưu ý: địa chỉ này ĐỔI mỗi lần chạy lại script. Biểu tượng đã cài lần trước sẽ
  không mở được nữa — gỡ nó đi rồi cài lại, hoặc chuyển sang địa chỉ cố định (README).

  Ctrl+C để tắt.
MSG

wait "$TUNNEL_PID"
