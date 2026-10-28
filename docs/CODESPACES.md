# Chạy tạm server xemchua trên GitHub Codespaces

Không cần thẻ, không cần máy nhà. Đổi lại: **chỉ chạy khi bạn mở**, tự tắt khi bỏ không
(mặc định 30 phút), miễn phí khoảng **60 giờ/tháng** (máy 2 nhân). Muốn chạy 24/7 thì
xem `ORACLE-FREE.md`.

## Lần đầu

1. Vào https://github.com/phuclt093/LT_Vitube → nút xanh **Code → Codespaces →
   Create codespace on main**.
2. Đợi nó tự cài và build (5–10 phút, xem tiến độ ở khung Terminal).
3. Mở tab **PORTS** (cạnh Terminal) → dòng cổng **3000** → chuột phải →
   **Port Visibility → Public**. ⚠️ Không đổi sang Public thì trang web không gọi được.
4. Chép địa chỉ ở cột *Forwarded Address*, dạng
   `https://ten-ngau-nhien-3000.app.github.dev`.
5. Mở https://xemchua.pages.dev → **Cài đặt → Máy chủ xemchua** → dán địa chỉ đó →
   **Lưu và thử**.

## Những lần sau

GitHub → **Code → Codespaces** → bấm vào codespace cũ. Server tự chạy lại, địa chỉ giữ
nguyên (nếu bị về Private thì làm lại bước 3).

Server không lên? Trong Terminal: `cat /tmp/xemchua.log`, hoặc chạy tay
`cd vitube-web && npm start`.

## Lưu ý

- Muốn đỡ bị tắt: https://github.com/settings/codespaces → **Default idle timeout**
  tăng lên tối đa 240 phút.
- Xoá codespace khi không dùng nữa để khỏi tốn dung lượng miễn phí (15 GB).
- Máy GitHub là IP máy chủ thuê, YouTube có thể báo *"not a bot"* — cách gỡ bằng
  cookie như trong `ORACLE-FREE.md` (đặt `YTDLP_COOKIES_FILE` trỏ tới file cookie rồi
  chạy lại `npm start`).
