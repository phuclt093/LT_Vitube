#!/usr/bin/env bash
#
# Dựng server xemchua trên máy Oracle Cloud miễn phí (Ubuntu, ARM hay x86 đều được).
# Chạy trên máy Oracle, KHÔNG chạy trên máy nhà:
#
#   curl -fsSL https://raw.githubusercontent.com/phuclt093/LT_Vitube/main/vitube_PWA/oracle-setup.sh | bash
#
# Chạy lại bao nhiêu lần cũng được — lần sau sẽ kéo code mới và build lại.
# Hướng dẫn đầy đủ: docs/ORACLE-FREE.md
#
set -euo pipefail
die() { printf '\n\033[1;31m[X] %s\033[0m\n\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m[✓]\033[0m %s\n' "$*"; }
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

REPO="${REPO:-https://github.com/phuclt093/LT_Vitube.git}"
DIR="$HOME/LT_Vitube"

[ "$(id -u)" -ne 0 ] || die "Đừng chạy bằng root — đăng nhập user ubuntu rồi chạy lại"

say "1/5 Bộ nhớ swap (build Next.js cần nhiều RAM)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
ok "swap đã bật"

say "2/5 Docker và git"
if ! command -v docker >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y git curl
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
command -v git >/dev/null || sudo apt-get install -y git
ok "$(sudo docker --version)"

say "3/5 Mã nguồn"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone --depth 1 "$REPO" "$DIR"
fi
cd "$DIR/vitube_PWA"
mkdir -p data cookies
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's|^VITUBE_PUBLIC_URL=.*|VITUBE_PUBLIC_URL=|' .env
fi
ok "code ở $DIR"

say "4/5 Build và chạy server (lần đầu mất 5–15 phút)"
sudo docker compose up -d --build
for _ in $(seq 1 60); do
  curl -fsS -o /dev/null http://127.0.0.1:3000/manifest.webmanifest && break
  sleep 2
done
curl -fsS -o /dev/null http://127.0.0.1:3000/manifest.webmanifest || die "Server không lên. Xem log: sudo docker compose -f $DIR/vitube_PWA/docker-compose.yml logs"
ok "server chạy ở cổng 3000 (chỉ trong máy)"

say "5/5 Địa chỉ HTTPS bằng Tailscale Funnel"
command -v tailscale >/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
if ! tailscale status >/dev/null 2>&1; then
  echo "  Mở đường link Tailscale in ra bên dưới để đăng nhập (dùng cùng tài khoản với máy nhà cũng được)."
  sudo tailscale up --hostname=xemchua
fi
bash "$DIR/vitube_PWA/https/tailscale.sh" --public

URL="https://$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
sed -i "s|^VITUBE_PUBLIC_URL=.*|VITUBE_PUBLIC_URL=$URL|" .env
sudo docker compose up -d
ok "Xong. Địa chỉ server: $URL"
cat <<MSG

  Mở https://xemchua.pages.dev → Cài đặt → Máy chủ xemchua → dán:
      $URL
  → Lưu và thử.

  Cập nhật sau này: chạy lại đúng lệnh curl … | bash ban đầu.
MSG
