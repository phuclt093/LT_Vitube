# Chạy vitube trên Cloudflare Pages — `https://xemchua.pages.dev`

Giống hệt bản GitHub Pages (`docs/GITHUB-PAGES.md`), chỉ khác chỗ chứa giao diện:
Cloudflare Pages chạy ở **gốc tên miền** (không có `/LT_Vitube`), miễn phí, không cần
tên miền riêng.

```
  https://xemchua.pages.dev                    https://ten-may.ts.net
  ┌──────────────────────────────┐   /api/*    ┌───────────────────────────┐
  │ Giao diện tĩnh (CF Pages)    │ ──────────► │ Server vitube (vitube-web)│ ──► YouTube
  └──────────────────────────────┘             └───────────────────────────┘
```

Cloudflare **không** chạy được phần server (yt-dlp, proxy video) — server vẫn nằm ở máy
nhà hoặc VPS như cũ.

---

## 1. Lấy khoá Cloudflare (một lần)

1. Đăng ký/đăng nhập https://dash.cloudflare.com (miễn phí).
2. **Account ID**: trang chủ dashboard → chọn tài khoản → cột phải có *Account ID* → chép.
3. **API token**: góc phải trên → *My Profile* → *API Tokens* → *Create Token* →
   *Create Custom Token*:
   - Permissions: **Account → Cloudflare Pages → Edit**
   - Account Resources: tài khoản của bạn
   - *Continue* → *Create Token* → chép token (chỉ hiện một lần).

## 2. Đặt secret trên GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Tên | Giá trị |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token ở bước 1.3 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID ở bước 1.2 |

(Tuỳ chọn) tab **Variables**: `VITUBE_API_URL` = địa chỉ server — dùng chung với bản GitHub Pages.

Vào **Actions → Deploy Cloudflare Pages → Run workflow** (hoặc push lên `main`).
Lần đầu workflow tự tạo project `xemchua`. Xanh là trang chạy ở `https://xemchua.pages.dev`.

> Tên `xemchua` đã có người lấy thì Cloudflare tự thêm đuôi (vd `xemchua-abc.pages.dev`)
> — xem địa chỉ thật trong log bước cuối hoặc dashboard *Workers & Pages*.

## 3. Cho server nhận lời gọi từ trang này

Trên máy chạy server, thêm origin của Cloudflare Pages (cách nhau bằng dấu phẩy nếu dùng
cả GitHub Pages):

```bash
cd vitube-web
# sửa dòng VITUBE_ALLOW_ORIGINS trong .env.local thành:
VITUBE_ALLOW_ORIGINS=https://xemchua.pages.dev,https://phuclt093.github.io
npm run build && npm start
../vitube_PWA/https/tailscale.sh --public     # server phải có HTTPS
```

## 4. Kết nối

Mở `https://xemchua.pages.dev` → **Cài đặt → Máy chủ vitube** → dán địa chỉ server →
**Lưu và thử**.

---

## Build thử trên máy

```bash
cd vitube-web
npm run build:pages                              # ra out/
npx wrangler pages deploy out --project-name=xemchua   # deploy tay (đăng nhập bằng trình duyệt)
```

Giới hạn giống bản GitHub Pages — xem mục *Giới hạn đã biết* trong `docs/GITHUB-PAGES.md`.
