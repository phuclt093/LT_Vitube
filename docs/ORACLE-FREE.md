# Server xemchua trên Oracle Cloud miễn phí

Máy ảo Oracle chạy server 24/7, trang `https://xemchua.pages.dev` gọi sang đó. Không
cần bật máy nào ở nhà, không cần tên miền.

```
  xemchua.pages.dev  ──►  https://xemchua.<mạng>.ts.net  (máy Oracle, Docker)  ──►  YouTube
```

Tổng thời gian lần đầu: khoảng 30–45 phút, phần lớn là chờ.

---

## Bước 1 — Tạo tài khoản Oracle Cloud

1. Vào https://signup.cloud.oracle.com → điền email, tên, quốc gia **Vietnam**.
2. **Home Region**: chọn **Singapore** (gần VN nhất). ⚠️ Chọn rồi **không đổi được** —
   máy miễn phí chỉ tạo được ở vùng này.
3. Xác minh thẻ Visa/Mastercard (thẻ ghi nợ cũng được). Oracle giữ tạm ~1 USD rồi trả
   lại. Tài khoản **Always Free** không tự trừ tiền trừ khi bạn tự bấm nâng cấp.
4. Đợi email "Your account is ready" (vài phút, đôi khi vài giờ).

## Bước 2 — Tạo máy ảo

Đăng nhập https://cloud.oracle.com → menu ☰ → **Compute → Instances → Create instance**.

| Mục | Chọn |
|---|---|
| Name | `xemchua` |
| Image | **Change image → Canonical Ubuntu 24.04** |
| Shape | **Change shape → Ampere → VM.Standard.A1.Flex**, 2 OCPU, 12 GB RAM (có nhãn *Always Free-eligible*) |
| Networking | để mặc định (tự tạo VCN, có *public IPv4*) |
| SSH keys | **Generate a key pair for me → Save private key** (tải file `.key` về, giữ kỹ) |
| Boot volume | để mặc định (50 GB) |

Bấm **Create**. Đợi trạng thái chuyển **Running** (1–2 phút), chép **Public IP address**.

> **Báo "Out of capacity"?** Singapore hay hết máy ARM. Thử lại sau vài giờ (sáng sớm
> thường được), hoặc đổi *Availability domain* nếu có nhiều cái. Bất đắc dĩ thì chọn shape
> **VM.Standard.E2.1.Micro** (x86, 1 GB RAM — cũng miễn phí, script tự thêm swap nên
> vẫn build được, chỉ chậm hơn).

Không cần mở cổng tường lửa nào — Tailscale đi đường ra ngoài, không ai gọi thẳng vào máy.

## Bước 3 — Đăng nhập vào máy ảo

Trên máy Linux nhà bạn (hoặc PowerShell trên Windows):

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<Public IP>
```

Gõ `yes` khi được hỏi. Thấy dòng `ubuntu@xemchua:~$` là đã vào.

## Bước 4 — Chạy script cài đặt

Dán đúng một lệnh này vào cửa sổ SSH:

```bash
curl -fsSL https://raw.githubusercontent.com/phuclt093/LT_Vitube/main/vitube_PWA/oracle-setup.sh | bash
```

Script tự làm: thêm swap → cài Docker → tải code → build và chạy server → cài Tailscale.

Giữa chừng có **2 lần cần bạn bấm**:

1. **Đăng nhập Tailscale**: script in ra link `https://login.tailscale.com/a/...` → mở
   trên điện thoại/máy tính → đăng nhập (Google/GitHub, cùng tài khoản máy nhà cũng được).
2. **Bật Funnel** (chỉ lần đầu): script in ra link bật HTTPS/Funnel và dừng lại → mở
   link, bấm bật → **chạy lại lệnh `curl … | bash` ở trên** (lần này nhanh, không build lại).

Cuối cùng thấy:

```
[✓] Xong. Địa chỉ server: https://xemchua.ten-mang.ts.net
```

## Bước 5 — Nối trang web với server

Mở https://xemchua.pages.dev → **Cài đặt → Máy chủ xemchua** → dán địa chỉ `ts.net`
ở trên → **Lưu và thử** → hiện ✓.

Muốn mọi máy tự dùng địa chỉ này (khỏi nhập): GitHub → **Settings → Secrets and
variables → Actions → Variables → New variable** `VITUBE_API_URL` = địa chỉ đó → chạy lại
workflow *Deploy Cloudflare Pages*.

---

## Khi YouTube báo "Sign in to confirm you're not a bot"

IP máy chủ thuê hay bị YouTube nghi. Cách gỡ là cho server mượn cookie:

1. Trên máy tính, dùng **trình duyệt ẩn danh**, đăng nhập một **tài khoản Google phụ**
   vào youtube.com.
2. Cài extension **Get cookies.txt LOCALLY** → trên tab YouTube bấm *Export* → được
   `cookies.txt`. Đóng tab ẩn danh luôn (đừng đăng xuất — đăng xuất là cookie hết hạn).
3. Chép sang máy Oracle:
   ```bash
   scp -i ~/Downloads/ssh-key-*.key cookies.txt ubuntu@<Public IP>:~/LT_Vitube/vitube_PWA/cookies/
   ```
4. Trên máy Oracle:
   ```bash
   cd ~/LT_Vitube/vitube_PWA
   sed -i 's|^# YTDLP_COOKIES_FILE=|YTDLP_COOKIES_FILE=|' .env
   sudo docker compose up -d
   ```

## Lệnh hay dùng (trên máy Oracle)

```bash
cd ~/LT_Vitube/vitube_PWA
sudo docker compose logs -f --tail 100     # xem log
sudo docker compose restart                # khởi động lại
curl -fsSL https://raw.githubusercontent.com/phuclt093/LT_Vitube/main/vitube_PWA/oracle-setup.sh | bash   # cập nhật code mới
```

Dữ liệu tài khoản/lịch sử nằm ở `~/LT_Vitube/vitube_PWA/data` — thỉnh thoảng sao lưu.

## Lưu ý

- Oracle có thể **thu hồi máy Always Free nếu nó gần như không làm gì trong 7 ngày**
  (CPU, mạng, RAM đều rất thấp). Dùng thường xuyên thì không sao.
- Băng thông ra miễn phí 10 TB/tháng — xem video thoải mái.
- Đây là dự án cá nhân: đừng chia sẻ địa chỉ server rộng rãi.
