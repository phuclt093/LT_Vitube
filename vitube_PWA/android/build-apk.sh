#!/usr/bin/env bash
#
# Build "file cài đặt" vitube cho Android (.apk bọc web — Trusted Web Activity).
#
#   ./build-apk.sh https://vitube.example.com
#
# Lần đầu: tự tạo chứng chỉ ký (vitube-release.jks + keystore.properties).
# GIỮ KỸ hai file đó — mất là không phát hành bản cập nhật cho người đã cài được nữa
# (máy sẽ báo xung đột chữ ký, phải gỡ ra cài lại). Chúng đã nằm trong .gitignore.
#
set -euo pipefail
cd "$(dirname "$0")"

die()  { printf '\n\033[1;31m[X] %s\033[0m\n\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m[✓]\033[0m %s\n' "$*"; }
note() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }

URL="${1:-}"
URL="${URL%/}"
[ -n "$URL" ] || die "Thiếu địa chỉ. Dùng: ./build-apk.sh https://ten-mien-cua-ban"
[[ "$URL" == https://* ]] || die "Địa chỉ phải là https:// — Android chỉ mở toàn màn hình với trang HTTPS."

command -v java >/dev/null    || die "Chưa có Java 17. Cài: sudo apt install openjdk-17-jdk"
command -v keytool >/dev/null || die "Thiếu keytool (đi kèm Java). Cài: sudo apt install openjdk-17-jdk"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
[ -d "$SDK/platforms" ] || die "Không thấy Android SDK ở $SDK — xem docs/ANDROID-TV-LINUX.md, bước 2."
[ -f local.properties ] || echo "sdk.dir=$SDK" > local.properties
ok "Java + Android SDK"

# ---- chứng chỉ ký (chỉ tạo một lần) ----
if [ ! -f keystore.properties ]; then
  PASS=$(head -c 64 /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 24)
  keytool -genkeypair -keystore vitube-release.jks -alias vitube -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$PASS" -keypass "$PASS" -dname "CN=vitube, O=vitube, C=VN" >/dev/null 2>&1
  cat > keystore.properties <<PROPS
storeFile=vitube-release.jks
storePassword=$PASS
keyAlias=vitube
keyPassword=$PASS
PROPS
  chmod 600 keystore.properties vitube-release.jks
  note "Đã tạo chứng chỉ ký vitube-release.jks — hãy sao lưu nó cùng keystore.properties."
fi
PASS=$(grep '^storePassword=' keystore.properties | cut -d= -f2-)

# ---- build ----
./gradlew :app:assembleRelease -PvitubeUrl="$URL"
APK=app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || die "Build xong nhưng không thấy $APK"
ok "Đã build: $APK"

# ---- đặt APK cho trang /install ----
DL=../../vitube-web/public/download
mkdir -p "$DL"
cp "$APK" "$DL/vitube.apk"
ok "Đã chép sang vitube-web/public/download/vitube.apk — trang /install sẽ hiện nút tải"

# ---- vân tay cho assetlinks.json ----
SHA=$(keytool -list -v -keystore vitube-release.jks -alias vitube -storepass "$PASS" 2>/dev/null \
      | awk '/SHA256:/ {print $2; exit}')

cat <<MSG

  ─────────────────────────────────────────────────────────────
  Việc cuối: thêm dòng này vào vitube-web/.env.local rồi khởi động lại server

      TWA_SHA256=$SHA

  Kiểm tra: mở $URL/.well-known/assetlinks.json — phải thấy vân tay ở trên.
  Thiếu bước này app vẫn chạy, nhưng có một thanh địa chỉ nhỏ phía trên
  thay vì toàn màn hình.

  Gửi cho người dùng: link $URL/install  (hoặc gửi thẳng file APK)
  ─────────────────────────────────────────────────────────────
MSG
