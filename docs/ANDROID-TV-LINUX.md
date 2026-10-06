# Chạy thử app Android TV trên Linux Mint

Được. Cách chắc chắn nhất là **máy ảo Android TV chính chủ của Google** (Android
Emulator). Nó chạy nhanh trên Linux nhờ KVM, có sẵn giao diện TV, và bàn phím máy tính
đóng vai điều khiển từ xa.

---

## 0. Việc phải làm trước: lấy lại thư mục `core/data`

App TV và app điện thoại đều dùng chung `vitube-tv/core/src/main/java/com/vitube/core/data/`
(`Api.kt`, `Settings.kt`, `VideoItem`, …). Thư mục này **chưa bao giờ lên git**: file
`.gitignore` cũ có dòng `data/` trần, nó bỏ qua mọi thư mục tên `data` — kể cả thư mục mã
nguồn này. Dòng đó đã được sửa, nhưng bản trên máy Linux vẫn đang thiếu.

Bản đầy đủ còn trên máy Windows (lần build TV thành công gần nhất là ở đó). Chép nguyên
thư mục `vitube-tv\core\src\main\java\com\vitube\core\data\` sang đúng vị trí trên Linux,
rồi đưa lên git luôn cho khỏi mất lần nữa:

```bash
git add vitube-tv/core/src/main/java/com/vitube/core/data
git commit -m "Đưa core/data lên git (trước bị .gitignore bỏ qua)"
```

Thiếu thư mục này thì không build được app TV lẫn app điện thoại, trên bất kỳ máy nào.

---

## 1. Bật ảo hoá phần cứng (KVM)

```bash
egrep -c '(vmx|svm)' /proc/cpuinfo     # ra số > 0 là CPU hỗ trợ
sudo apt install cpu-checker && kvm-ok  # "KVM acceleration can be used" là ổn
```

Nếu `kvm-ok` báo đã tắt trong BIOS: khởi động lại, bấm **F2** lúc hiện logo Dell →
*Virtualization Support* → bật **Enable Intel Virtualization Technology** → lưu.

```bash
sudo apt install qemu-kvm openjdk-17-jdk unzip
sudo adduser "$USER" kvm     # rồi đăng xuất / đăng nhập lại
```

## 2. Cài Android SDK

**Cách dễ:** cài Android Studio (Software Manager của Mint có bản Flatpak, hoặc tải
bản `.tar.gz` từ developer.android.com). Mở lên một lần, nó tự tải SDK về `~/Android/Sdk`.

**Cách gọn, không cần Studio:** tải *Command line tools only* bản Linux từ
developer.android.com/studio, rồi:

```bash
mkdir -p ~/Android/Sdk/cmdline-tools
unzip commandlinetools-linux-*.zip -d ~/Android/Sdk/cmdline-tools
mv ~/Android/Sdk/cmdline-tools/cmdline-tools ~/Android/Sdk/cmdline-tools/latest

echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH' >> ~/.bashrc
source ~/.bashrc

sdkmanager "platform-tools" "emulator" "platforms;android-35" "build-tools;35.0.0"
```

## 3. Tạo máy ảo Android TV

Xem các bản TV đang có rồi chọn một (ưu tiên x86_64 / x86, API 33–34):

```bash
sdkmanager --list | grep -E "android-tv|google-tv"
```

Ví dụ với bản Android TV API 34:

```bash
sdkmanager "system-images;android-34;android-tv;x86"
avdmanager create avd -n vitube-tv -k "system-images;android-34;android-tv;x86" -d tv_1080p
emulator -avd vitube-tv &
```

(Dùng Android Studio thì làm bằng giao diện: *Device Manager → Create device → TV →
1080p*, chọn một system image TV.)

## 4. Build và cài app

Ở thư mục gốc project:

```bash
./TEST-TV-LINUX.sh            # app TV
./TEST-TV-LINUX.sh --mobile   # app điện thoại (tạo máy ảo điện thoại tương tự bước 3)
```

Script kiểm tra đủ `core/data`, Java, SDK; build bản **debug** (không cần file ký như
bản release); cài lên máy ảo đang chạy và mở app.

## 5. Nối app với server vitube

Chạy server web trên máy Linux như bình thường (`npm run dev` trong `vitube-web`). Trong
app TV, đặt địa chỉ server là:

```
http://10.0.2.2:3000
```

`10.0.2.2` là địa chỉ đặc biệt: từ bên trong máy ảo, nó trỏ về chính máy Linux của bạn.
Đừng dùng `localhost` — trong máy ảo, `localhost` là bản thân máy ảo.

Đăng nhập cùng tài khoản với bản web thì trang chủ trên TV dùng chung lịch sử xem và
bộ đề xuất với mọi máy khác.

## Điều khiển

| Nút remote | Trên bàn phím |
|---|---|
| Lên / xuống / trái / phải | phím mũi tên |
| OK | Enter |
| Back | Esc |
| Home | Home |

Xem log khi app lỗi: `adb logcat | grep -i vitube`

---

## Còn Waydroid thì sao?

Waydroid chạy Android thật trên Linux, nhanh hơn máy ảo, nhưng cần môi trường **Wayland**
— Linux Mint Cinnamon mặc định là X11 nên phải chạy lồng qua `weston`, khá rườm rà. Nó
cũng là Android điện thoại chứ không phải Android TV, nên giao diện TV (điều hướng bằng
phím, launcher TV) không thử được đúng. Máy ảo ở trên là lựa chọn đúng cho việc này.
