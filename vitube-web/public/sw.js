/*
 * Service worker của vitube.
 *
 * Việc chính: làm cho vitube CÀI ĐƯỢC như app và mở nhanh. Không phải để xem offline —
 * video luôn phải lấy từ server.
 *
 * Quy tắc cache, cố ý giữ đơn giản để không bao giờ phục vụ nhầm dữ liệu cũ:
 *  - /_next/static/*, /icons/*  → cache-first. Tên file của Next có mã băm, đổi code
 *                                 là đổi tên, nên cache mãi không sợ cũ.
 *  - /api/*                     → KHÔNG ĐỤNG VÀO. Luồng video, proxy, đăng nhập, lịch sử
 *                                 đều đi thẳng ra mạng. Cache nhầm ở đây là hỏng phát video.
 *  - trang HTML                 → mạng trước; mất mạng thì trả trang "offline" dựng sẵn.
 */
const VERSION = 'vitube-sw-v1';
const STATIC = `${VERSION}-static`;
// Thư mục gốc của app: '/' khi chạy có server, '/<tên-repo>/' trên GitHub Pages
const ROOT = new URL(self.registration.scope).pathname;
const OFFLINE_URL = `${ROOT}offline.html`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE_URL, `${ROOT}icons/icon-192.png`]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // dọn cache của phiên bản cũ
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith(`${ROOT}api/`)) return; // xem ghi chú ở đầu file

  if (url.pathname.startsWith(`${ROOT}_next/static/`) || url.pathname.startsWith(`${ROOT}icons/`)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
