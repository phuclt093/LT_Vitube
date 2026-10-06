# vitube

Xem YouTube không quảng cáo, giao diện bám sát YouTube.

| Thư mục | Là gì |
|---|---|
| `vitube-web/` | Next.js — giao diện web, đồng thời là server API cho mọi client |
| `vitube-desktop/` | Vỏ Electron, tự khởi động server, không cần terminal |
| `vitube-tv/` | App Android TV (Kotlin + Compose TV + Media3) |
| `docs/GITHUB-PAGES.md` | Đưa giao diện lên GitHub Pages, trỏ về server vitube của bạn |
| `docs/CONTEXT.md` | **Đọc file này trước** — kiến trúc, quyết định, những hướng đã thất bại, nhật ký tiến độ |

## Chạy trên GitHub Pages

Giao diện được build tĩnh và tự đưa lên GitHub Pages mỗi lần push lên `main`
(`.github/workflows/pages.yml`). Video vẫn cần một server vitube chạy HTTPS ở máy nhà
hoặc VPS — trang Pages gọi sang đó. Các bước đầy đủ: [`docs/GITHUB-PAGES.md`](docs/GITHUB-PAGES.md).

```bash
npm run build:pages    # build thử bản tĩnh → vitube-web/out/
```

## Đóng gói app desktop

Bấm đúp file tương ứng với máy bạn đang dùng — **phải build trên chính hệ điều
hành đó**, không build chéo được (xem `docs/LINUX.md`):

| Máy | File |
|---|---|
| Windows | `BUILD-DESKTOP.bat` |
| Linux | `BUILD-LINUX.sh` (`chmod +x` một lần) |
| macOS | `BUILD-MAC.command` (`chmod +x` một lần) |

Cả ba chỉ là vỏ bọc quanh cùng một lệnh, quen tay rồi thì gõ thẳng:

```bash
npm run dev      # chạy web + Electron
npm run check    # kiểm tra mọi thứ mà không đóng gói
npm run build    # kiểm tra rồi đóng gói cho hệ đang chạy
npm run db:check # thử kết nối Turso
npm run link:db  # chép cấu hình Turso sang chỗ bản đóng gói đọc được
```

## Bắt đầu nhanh

**Windows:** bấm đúp `create-shortcut.bat`, rồi bấm đúp shortcut **vitube** vừa hiện trên Desktop.
Lần đầu nó tự cài thư viện, tải yt-dlp, build và mở trình duyệt.

| File | Việc |
|---|---|
| `create-shortcut.bat` | Tạo shortcut — chạy một lần duy nhất |
| `BUILD-DESKTOP.bat` | Đóng gói thành file cài đặt Windows |
| `BUILD-WEB.bat` | Build lại bản web sau khi sửa code |

Xem `HUONG-DAN.txt` nếu gặp trục trặc.

**Dòng lệnh:**

```bash
cd vitube-web
npm install
npm run setup:ytdlp    # bắt buộc — tải yt-dlp về ./bin
npm run dev            # http://localhost:3000
```

Không chạy được thì mở `http://localhost:3000/api/debug/<videoId>` — nó nói rõ nguồn nào
còn dùng được và hỏng ở đâu.

## Kiến trúc một dòng

Mọi client gọi cùng một API. Server lo phần khó (yt-dlp, cache, gợi ý); client chỉ đọc
JSON rồi phát. Thêm client mới không phải viết lại gì.

Chi tiết ở [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Lưu ý

Dự án cá nhân, dùng API nội bộ không chính thức của YouTube. Không nên triển khai công
khai hay thương mại hoá. Nội dung video thuộc về YouTube và các chủ sở hữu bản quyền.
