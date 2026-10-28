# Đăng nhập bằng Google và quét QR

- **Google:** nút "Tiếp tục với Google" trong khung Đăng nhập. Tài khoản cũ đăng ký
  bằng đúng Gmail đó được gộp vào, giữ nguyên lịch sử.
- **QR:** máy chưa đăng nhập (TV, máy tính) bấm *Quét mã QR bằng điện thoại* → điện
  thoại đã đăng nhập xemchua quét bằng camera → bấm **Cho phép**. Mã sống 2 phút,
  dùng một lần. QR **không cần cấu hình gì**, chạy ngay.

Chỉ Google cần một **Client ID** (miễn phí, công khai — không phải bí mật).

## Tạo Client ID (khoảng 5 phút)

1. Vào https://console.cloud.google.com, đăng nhập Gmail của bạn.
2. Thanh trên cùng → ô chọn project → **New project** → tên `xemchua` → **Create**.
   Đợi xong rồi chọn đúng project `xemchua`.
3. Menu ☰ → **APIs & Services → OAuth consent screen** (có thể hiện là
   **Google Auth Platform**) → **Get started**:
   - App name: `xemchua`, User support email: Gmail của bạn → Next
   - Audience: **External** → Next
   - Contact information: Gmail của bạn → Next → tích đồng ý → **Create**
4. Mục **Audience** → **Publish app** → Confirm.
   Không publish thì app ở chế độ *Testing*: chỉ những Gmail bạn thêm vào
   *Test users* mới đăng nhập được. xemchua chỉ xin tên + email nên publish không
   phải chờ Google duyệt.
5. Mục **Clients** → **Create client**:
   - Application type: **Web application**, Name: `xemchua web`
   - **Authorized JavaScript origins** → Add URI, thêm từng dòng:
     - `https://xemchua.pages.dev`
     - `https://phuclt-vostro-3671.tail6d710b.ts.net:8443` (khi mở thẳng web trên server)
     - `http://localhost:3000` (khi chạy `npm run dev`)
   - **Authorized redirect URIs: để trống** — không cần.
   - **Create** → chép **Client ID** (dạng `1234…-abc….apps.googleusercontent.com`).
6. Trên máy server:
   ```bash
   nano ~/xemchua-server/.env.local      # điền GOOGLE_CLIENT_ID=<Client ID>
   systemctl --user restart xemchua
   ```
7. Kiểm tra: mở `https://<server>/api/auth/config` → phải thấy `"google":"1234…"`.

Google có thể mất **5 phút tới vài giờ** mới nhận origin mới. Nút Google báo
`origin_mismatch` / "not allowed" trong lúc đó là bình thường — đợi rồi thử lại.

## Lỗi thường gặp

| Hiện tượng | Cách gỡ |
|---|---|
| Nút **Publish app** mờ | Mục **Branding** điền App name, User support email, Developer contact → Save. Hoặc **Add users** thêm Gmail của bạn vào Test users là dùng được luôn |
| Không thấy nút Google | Server chưa có `GOOGLE_CLIENT_ID`, hoặc chưa khởi động lại |
| "Địa chỉ đang có dấu chấm thừa" | Mở `https://xemchua.pages.dev` (không có `.` sau `dev`) |
| `origin_mismatch` | Thêm đúng địa chỉ đang mở vào *Authorized JavaScript origins*, đợi vài phút |
| "Access blocked… has not completed verification" | Chưa làm bước 4 (Publish app) |
| QR báo "Điện thoại này chưa đăng nhập" | Đăng nhập xemchua trên điện thoại trước, rồi quét lại |
