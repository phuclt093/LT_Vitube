/**
 * Hai kiểu build từ cùng một mã nguồn:
 *
 *   mặc định           `output: 'standalone'` — giao diện + server API (desktop, Docker, máy nhà)
 *   VITUBE_STATIC=1    `output: 'export'` — chỉ giao diện tĩnh để đưa lên GitHub Pages.
 *                      Mọi lời gọi /api được chuyển sang server vitube đặt ở chỗ khác
 *                      (xem src/lib/remote-shim.ts và docs/GITHUB-PAGES.md).
 *                      Chạy bằng `npm run build:pages`, đừng đặt biến này bằng tay.
 */
const STATIC = process.env.VITUBE_STATIC === '1';
// GitHub Pages của một repo nằm ở https://<user>.github.io/<repo>/ — cần basePath
const BASE_PATH = STATIC ? (process.env.VITUBE_BASE_PATH ?? '').replace(/\/+$/, '') : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bản standalone gồm server.js kèm đúng module cần thiết — app desktop dùng bản này
  output: STATIC ? 'export' : 'standalone',
  ...(STATIC ? { basePath: BASE_PATH, trailingSlash: true } : {}),
  serverExternalPackages: ['youtubei.js'],
  // node:sqlite là module nội bộ của Node, không được bundle
  webpack: (config, { dev }) => {
    config.externals = [...(config.externals ?? []), { 'node:sqlite': 'commonjs node:sqlite' }];

    /**
     * Bớt thứ phải theo dõi khi chạy dev.
     *
     * Mỗi thư mục tốn một watcher của inotify, mà Linux mặc định chỉ cho khoảng
     * 8192 cái cho cả máy — dùng chung với trình soạn thảo, trình duyệt, và mọi
     * thứ khác đang mở. Riêng vitube-web đã có hơn 1300 thư mục, 1239 trong số đó
     * nằm ở node_modules và chẳng bao giờ đổi giữa chừng.
     *
     * Chạm trần thì Watchpack nôn ra hàng trăm dòng `ENOSPC` và nạp lại nóng
     * ngừng hoạt động, dù app vẫn chạy — kiểu hỏng khó đoán ra nhất.
     */
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/.git/**',
          '**/data/**',
          '**/bin/**',
          '**/release/**',
          '**/resources/**',
        ],
        aggregateTimeout: 300,
      };
    }

    return config;
  },
  images: { unoptimized: true },
  // Mốc build — trang /debug/pip hiện ra để biết điện thoại đang chạy bản nào
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_VITUBE_STATIC: STATIC ? '1' : '',
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },

  // Bản tĩnh không có server nên không có rewrites/headers
  ...(STATIC ? {} : { rewrites, headers }),
};

/*
    Các file "xác nhận quyền sở hữu tên miền" phải nằm đúng /.well-known/… — không
    đặt route trong thư mục app/.well-known vì tên bắt đầu bằng dấu chấm, trỏ sang
    route API thường cho chắc ăn.
*/
async function rewrites() {
  return [{ source: '/.well-known/assetlinks.json', destination: '/api/pwa/assetlinks' }];
}

// service worker không được bị trình duyệt cache lâu — cập nhật app phải tới ngay
async function headers() {
  return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
}
export default nextConfig;
