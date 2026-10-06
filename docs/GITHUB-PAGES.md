# Chạy vitube trên GitHub Pages

GitHub Pages chỉ phục vụ file tĩnh — không chạy được Node, yt-dlp hay proxy luồng
video. Nên bản Pages gồm **hai nửa**:

```
  https://phuclt093.github.io/LT_Vitube/        https://ten-may.ts.net
  ┌──────────────────────────────┐   /api/*    ┌───────────────────────────┐
  │ Giao diện tĩnh (GitHub Pages)│ ──────────► │ Server vitube (vitube-web)│ ──► YouTube
  └──────────────────────────────┘             └───────────────────────────┘
```

- **Giao diện**: build bằng `npm run build:pages` (`output: 'export'`), GitHub Actions
  tự build và đưa lên Pages mỗi lần push lên `main`.
- **Server**: chính `vitube-web` chạy như bình thường (`npm run build && npm start`)
  trên máy nhà hoặc VPS, mở ra internet bằng **HTTPS**.

Cách giao diện tìm tới server: script `src/lib/remote-shim.ts` chạy đầu tiên trong
trang và chuyển mọi URL `/api/...` (fetch, `<video src>`, `<img src>`, EventSource…)
sang địa chỉ server. Địa chỉ lấy từ **Cài đặt → Máy chủ vitube**, nếu trống thì dùng
biến `VITUBE_API_URL` nhúng lúc build.

---

## 1. Đưa giao diện lên GitHub Pages

1. Tạo repo trên GitHub (vd `LT_Vitube`) rồi push:
   ```bash
   cd LT_Vitube
   git remote add origin https://github.com/phuclt093/LT_Vitube.git
   git push -u origin main
   ```
2. Trên GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Vào tab **Actions**, chờ workflow *Deploy GitHub Pages* xanh (lần đầu có thể phải
   bấm *Re-run* sau bước 2). Trang nằm ở `https://phuclt093.github.io/LT_Vitube/`.
4. (Tuỳ chọn) **Settings → Secrets and variables → Actions → Variables → New variable**
   `VITUBE_API_URL` = địa chỉ server ở bước 2 bên dưới, rồi chạy lại workflow. Không đặt
   thì mỗi người tự nhập trong Cài đặt.

## 2. Chạy server

Trên máy Linux nhà bạn (IP dân cư — YouTube ít chặn hơn IP máy chủ thuê):

```bash
cd LT_Vitube/vitube-web
npm install
npm run setup:ytdlp
echo 'VITUBE_ALLOW_ORIGINS=https://phuclt093.github.io' >> .env.local
npm run build && npm start            # cổng 3000

# mở ra internet bằng HTTPS, địa chỉ cố định *.ts.net
../vitube_PWA/https/tailscale.sh --public
```

- `VITUBE_ALLOW_ORIGINS` là **origin** của trang Pages — chỉ `https://<user>.github.io`,
  không kèm `/LT_Vitube`. Thiếu biến này trình duyệt chặn mọi lời gọi (CORS).
- Server **bắt buộc HTTPS**: trang Pages là https, trình duyệt không cho gọi sang http.
- Cách khác: Cloudflare Tunnel (`vitube_PWA/start.sh`, địa chỉ đổi mỗi lần chạy) hoặc
  VPS + `docker compose` — xem `vitube_PWA/README.md`.

## 3. Kết nối

Mở trang Pages → **Cài đặt → Máy chủ vitube** → dán địa chỉ server (vd
`https://ten-may.ten-mang.ts.net`) → **Lưu và thử**. Hiện ✓ là xong.

---

## Build thử trên máy

```bash
cd vitube-web
VITUBE_BASE_PATH=/LT_Vitube npm run build:pages     # ra thư mục out/
```

Script tạm cất `src/app/api`, `src/app/.well-known`, `src/middleware.ts` (bản tĩnh không
có chúng) rồi luôn trả lại sau khi build xong.

## Giới hạn đã biết

- **Đăng nhập** dùng cookie xuyên site (`SameSite=None`). Safari và chế độ chặn cookie
  bên thứ ba có thể chặn — khi đó tài khoản/đồng bộ không chạy, nhưng xem video, lịch
  sử, danh sách phát lưu trên máy vẫn bình thường.
- Đường dẫn kênh/danh sách phát đổi từ `/channel/<id>` sang `/channel?id=<id>`
  (`/list?id=`, `/playlists/view?id=`) — GitHub Pages không có route động.
- Máy chạy server tắt thì trang Pages chỉ còn giao diện trống.
- Mọi byte video vẫn đi qua server của bạn (xem `CONTEXT.md` mục 4.3).
