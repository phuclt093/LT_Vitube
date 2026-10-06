#!/usr/bin/env bash
#
# Build app Android TV rồi cài lên máy ảo Android TV — chạy trên Linux Mint / Ubuntu.
# Cách dựng máy ảo lần đầu: xem docs/ANDROID-TV-LINUX.md
#
#   chmod +x TEST-TV-LINUX.sh
#   ./TEST-TV-LINUX.sh            # build bản debug + cài lên máy ảo đang chạy
#   ./TEST-TV-LINUX.sh --mobile   # làm y vậy cho app điện thoại
#
set -euo pipefail
cd "$(dirname "$0")"

die() { printf '\n\033[1;31m[X] %s\033[0m\n\n' "$*" >&2; exit 1; }
ok()  { printf '\033[1;32m[✓]\033[0m %s\n' "$*"; }

MODULE=app; PKG=com.vitube.tv.debug
[ "${1:-}" = "--mobile" ] && { MODULE=mobile; PKG=""; }

# 1. Thư mục mã nguồn chung — từng bị .gitignore nuốt mất, kiểm tra trước cho rõ ràng
DATA=vitube-tv/core/src/main/java/com/vitube/core/data
[ -f "$DATA/Api.kt" ] || die "Thiếu $DATA/Api.kt
    Thư mục này chưa bao giờ lên git (dòng 'data/' cũ trong .gitignore đã bỏ qua nó).
    Chép nguyên thư mục đó từ máy Windows sang rồi chạy lại. Xem docs/ANDROID-TV-LINUX.md."
ok "Có mã nguồn core/data"

# 2. Java 17
command -v java >/dev/null || die "Chưa có Java. Cài: sudo apt install openjdk-17-jdk"
ok "Java: $(java -version 2>&1 | head -1)"

# 3. Android SDK
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
[ -d "$SDK/platform-tools" ] || die "Không thấy Android SDK ở $SDK. Xem docs/ANDROID-TV-LINUX.md, bước 2."
export ANDROID_HOME="$SDK" PATH="$SDK/platform-tools:$SDK/emulator:$PATH"
[ -f vitube-tv/local.properties ] || echo "sdk.dir=$SDK" > vitube-tv/local.properties
ok "Android SDK: $SDK"

# 4. Build — bản debug, không cần file ký như bản release
chmod +x vitube-tv/gradlew
( cd vitube-tv && ./gradlew ":$MODULE:assembleDebug" )
APK=$(ls -t vitube-tv/$MODULE/build/outputs/apk/debug/*.apk | head -1)
ok "Đã build: $APK"

# 5. Cài lên máy ảo / thiết bị đang kết nối
if adb get-state >/dev/null 2>&1; then
  adb install -r "$APK"
  ok "Đã cài lên $(adb devices | sed -n 2p | cut -f1)"
  [ -n "$PKG" ] && adb shell monkey -p "$PKG" -c android.intent.category.LEANBACK_LAUNCHER 1 >/dev/null 2>&1 || true
  echo
  echo "  Trong app, đặt địa chỉ server là  http://10.0.2.2:3000"
  echo "  (10.0.2.2 là máy Linux của bạn nhìn từ bên trong máy ảo)"
else
  echo
  echo "  Chưa thấy máy ảo nào đang chạy. Mở máy ảo rồi chạy lại:"
  echo "    emulator -avd vitube-tv &"
fi
