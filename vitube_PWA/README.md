# vitube_PWA — cài vitube lên điện thoại như một app, không qua cửa hàng

Gửi cho người khác **một link hoặc một file**; họ mở ra, bấm đồng ý, là có biểu tượng
vitube trên màn hình chính. Mở lên toàn màn hình, không thanh địa chỉ — như app thật.
Không qua App Store, không qua Google Play.

Thư mục này chứa mọi thứ để **đem vitube đi chạy và phát hành dạng app**: script chạy thử,
file triển khai lên host, đường hầm HTTPS, app Android bọc web, biểu tượng. Phần giao diện
và server vẫn là `../vitube-web` — không tách bản sao, vì chính server đó lấy luồng video;
sửa ở đó một lần là web, desktop và app trên điện thoại cùng đổi.

---

## Thử trên iPhone ngay — một lệnh

```bash
sudo apt install qrencode        # không bắt buộc, để hiện mã QR
./vitube_PWA/start.sh
```

Script tự lo: cài thư viện nếu thiếu → build vitube nếu mã nguồn mới hơn → mở đường hầm
HTTPS miễn phí của Cloudflare (**không cần tài khoản, không cần tên miền**) → chạy server →
in ra link `https://…trycloudflare.com/install` và mã QR.

Trên iPhone: quét mã bằng **Camera** → mở bằng **Safari** → **Tải file cài đặt** →
**Cho phép** → vào **Cài đặt** → dòng **Đã tải về hồ sơ** → **Cài đặt** → nhập mật mã → Xong.

⚠️ Địa chỉ `trycloudflare.com` **đổi mỗi lần chạy lại script**. Biểu tượng đã cài sẽ trỏ vào
địa chỉ cũ và không mở được nữa. Hợp để thử; dùng thật thì chuyển sang một host có địa chỉ
cố định ở dưới.

---

## Host — nên dùng gì

vitube **không** chạy được trên host kiểu Vercel, Netlify, Cloudflare Pages, GitHub Pages:
chúng chỉ chạy hàm ngắn hoặc trang tĩnh, không chạy được `yt-dlp` và không chuyển tiếp nổi
cả luồng video dài. Cần một máy chạy Node liên tục — máy nhà hoặc máy chủ ảo (VPS).

| Nhu cầu | Gợi ý | Chi phí | Điểm cần biết |
|---|---|---|---|
| **Thử ngay** | `./start.sh` (Cloudflare Quick Tunnel) | 0 | Địa chỉ đổi mỗi lần chạy |
| **Dùng lâu dài, máy nhà thường bật** ⭐ | Máy Linux của bạn + **Tailscale Funnel** — `./https/tailscale.sh --public` | 0 | Địa chỉ cố định `*.ts.net`, không cần tên miền. Máy tắt thì app không xem được |
| **24/7, không phụ thuộc máy nhà** | **Oracle Cloud Always Free** (máy ARM) + `docker compose` | 0 (cần thẻ để xác minh) | Từ 7/2026 chỉ còn 2 nhân / 12 GB — vẫn thừa. IP máy chủ hay bị YouTube hỏi "not a bot" → cần cookie |
| **24/7, ổn định hơn** | VPS rẻ (Hetzner, hoặc VPS Việt Nam) + `docker compose` | ~100–150k/tháng | Cùng vấn đề IP máy chủ như trên |

**Gợi ý cho bạn:** thử bằng `start.sh` hôm nay; thấy ổn thì chuyển sang **Tailscale Funnel
trên chính máy Linux Mint** — miễn phí, địa chỉ không đổi, và quan trọng nhất là IP nhà bạn
là IP dân cư nên YouTube ít chặn hơn hẳn IP máy chủ thuê.

### Tailscale Funnel (địa chỉ cố định, miễn phí)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                       # đăng nhập bằng Google/GitHub…
cd vitube-web && npm run build && npm start &
./vitube_PWA/https/tailscale.sh --public
```

Lần đầu, Tailscale in ra một link để bật HTTPS và Funnel cho tài khoản — mở link, bấm
bật, chạy lại script. Script in ra địa chỉ `https://ten-may.ten-mang.ts.net` và dòng
`VITUBE_PUBLIC_URL=…` cần thêm vào `vitube-web/.env.local`.

### Máy chủ 24/7 bằng Docker

Trên máy chủ (đã cài Docker), chép cả thư mục project sang rồi:

```bash
cd vitube_PWA
cp .env.example .env                    # sửa VITUBE_PUBLIC_URL, và TUNNEL_TOKEN nếu dùng Cloudflare
docker compose up -d --build            # hoặc: docker compose --profile cloudflare up -d --build
```

HTTPS cho máy chủ: chạy `./https/tailscale.sh --public` ngay trên máy chủ đó, hoặc dùng
Cloudflare Tunnel có tên (cần tên miền quản lý bằng Cloudflare) với `TUNNEL_TOKEN` trong `.env`.

---

## Chi tiết từng bước (khi không dùng start.sh)

### 1. Chạy bản build, không phải bản dev

```bash
cd vitube-web
npm run build && npm start        # cổng 3000
```

Service worker (thứ làm cho cài được và mở nhanh) **chỉ bật ở bản build**. Ở `npm run dev`
nó cố ý tắt — bật lên thì nó giữ code cũ trong bộ nhớ đệm, sửa gì cũng không thấy đổi.

### 2. Khai báo địa chỉ công khai

Trong `vitube-web/.env.local`:

```
VITUBE_PUBLIC_URL=https://ten-may.ten-mang.ts.net
```

Cần cho Tailscale: nó không báo cho server biết người dùng đang vào bằng https, thiếu dòng
này thì file cài đặt iPhone ghi nhầm `http://`. Vào bằng IP trong mạng nhà vẫn chạy như cũ.

### 3. Gửi link

```
https://<địa-chỉ-của-bạn>/install
```

Trang tự nhận ra iPhone, Android hay máy tính và hiện đúng cách cài. Trong app cũng có
mục **Cài app điện thoại** ở thanh bên.

### 4. (Tuỳ chọn) File APK cho Android

Chỉ cần nếu muốn gửi *file* thay vì link. Cần Java 17 + Android SDK
(xem `docs/ANDROID-TV-LINUX.md`, bước 1–2).

```bash
./vitube_PWA/android/build-apk.sh https://<địa-chỉ-của-bạn>
```

Script tự tạo chứng chỉ ký ở lần đầu, build, chép APK sang `vitube-web/public/download/`
(trang `/install` tự hiện nút tải), và in ra dòng `TWA_SHA256=…` cần thêm vào `.env.local`.
Thiếu dòng đó app vẫn chạy nhưng có một thanh địa chỉ nhỏ phía trên thay vì toàn màn hình.

**Sao lưu `android/vitube-release.jks` và `android/keystore.properties`.** Mất chúng thì
không phát hành bản cập nhật được nữa — máy người dùng báo xung đột chữ ký, phải gỡ ra
cài lại. Hai file này đã nằm trong `.gitignore`.

Vì APK chỉ mở trang web, đổi giao diện **không** cần build lại APK. Chỉ build lại khi đổi
địa chỉ server.

### 5. (Tuỳ chọn) Ký hồ sơ iPhone

Chưa ký thì iPhone hiện chữ *Chưa ký* màu đỏ lúc cài — vẫn cài bình thường, chỉ trông kém
tin cậy. Có chứng chỉ HTTPS của tên miền (Cloudflare/Let's Encrypt) thì ký được:

```
PWA_SIGN_CERT=/duong/dan/cert.pem
PWA_SIGN_KEY=/duong/dan/privkey.pem
PWA_SIGN_CHAIN=/duong/dan/chain.pem      # nếu có
```

---

## Kiểm tra

- Trên máy tính, Chrome → F12 → **Application → Manifest**: phải thấy tên, biểu tượng, và
  không có dòng cảnh báo đỏ nào về khả năng cài đặt.
- `https://<địa-chỉ>/manifest.webmanifest` — manifest
- `https://<địa-chỉ>/api/pwa/mobileconfig` — tải về file cài đặt iPhone
- `https://<địa-chỉ>/.well-known/assetlinks.json` — sau khi build APK, phải có vân tay

## Giới hạn nên biết (chủ yếu trên iPhone)

- **Phát khi khoá màn hình / chuyển app:** Android ổn. iPhone hay ngắt tiếng — giới hạn
  của Apple với app web, không vượt được.
- **Cửa sổ nổi (PiP):** Android tốt; iPhone chập chờn hơn ở chế độ app.
- **Trình duyệt trên iPhone:** file cài đặt chỉ mở được bằng **Safari**. Trang `/install`
  tự nhắc nếu người dùng đang ở Chrome/Firefox.
- App web chỉ vượt qua *khâu duyệt của cửa hàng*, không thay đổi chuyện vitube dùng
  YouTube/Bilibili ngoài điều khoản của họ. Dùng trong nhà thì ổn; phát hành rộng rãi thì
  rủi ro vẫn như cũ.

## Cấu trúc

```
vitube_PWA/
├── README.md
├── start.sh                 thử ngay: build + chạy + đường hầm HTTPS tạm + mã QR
├── docker-compose.yml       chạy 24/7 trên máy chủ (+ .env.example)
├── https/tailscale.sh       địa chỉ HTTPS cố định bằng Tailscale
├── icons/make-icons.mjs     sinh biểu tượng web + Android từ logo
└── android/                 app Android bọc web (Trusted Web Activity) + build-apk.sh

Phần nằm trong vitube-web (dùng chung với bản web và desktop):
  src/app/manifest.ts                        manifest của app
  src/app/install/page.tsx                   trang cài đặt gửi cho người dùng
  src/app/api/pwa/mobileconfig/route.ts      file cài đặt iPhone
  src/app/api/pwa/assetlinks/route.ts        xác nhận APK Android (/.well-known/assetlinks.json)
  public/sw.js, public/offline.html          service worker + trang mất mạng
  public/icons/                              biểu tượng (sinh bởi make-icons.mjs)
  src/lib/pwa.ts, src/components/PwaSetup.tsx
```

Các thư mục `bin/`, `logs/`, `data/` và file `.env` do script tạo ra khi chạy — không đưa lên git.
