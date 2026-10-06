import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Shell from '@/components/Shell';
import { themeBootScript } from '@/lib/theme';
import { remoteShimScript } from '@/lib/remote-shim';
import { IS_STATIC, withBase } from '@/lib/base-path';
import ServerBanner from '@/components/ServerBanner';

export const metadata: Metadata = {
  title: 'vitube — xem video không quảng cáo',
  description: 'Trình xem YouTube tối giản, không quảng cáo.',
  manifest: withBase('/manifest.webmanifest'),
  /*
    iPhone không đọc manifest để biết "đây là app" — nó chỉ nghe mấy thẻ riêng của
    Apple. Thiếu `capable` thì thêm vào màn hình chính vẫn mở ra tab Safari.

    statusBarStyle 'default' (không phải 'black-translucent'): nội dung nằm DƯỚI thanh
    trạng thái, tự né tai thỏ — khỏi phải sửa từng thanh cố định theo safe-area.
  */
  appleWebApp: { capable: true, title: 'vitube', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' }],
    apple: [{ url: withBase('/icons/apple-touch-icon.png'), sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // màu thanh trạng thái khi chạy như app — khớp nền của chủ đề sáng mặc định
  themeColor: '#faf7f0',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {/*
          Áp bảng màu trước khi trang vẽ lần đầu.

          Phải là script chặn nằm ngay trong <head>: chờ React chạy thì trang đã hiện
          ra bằng màu mặc định mất rồi, đổi sau đó là một cú nháy màu vào mặt — với
          chủ đề sáng thì thành loé trắng.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        {/* Bản GitHub Pages: chuyển mọi /api sang server vitube — xem lib/remote-shim.ts */}
        {IS_STATIC && <script dangerouslySetInnerHTML={{ __html: remoteShimScript() }} />}
      </head>
      <body className="bg-yt-bg text-yt-text">
        <Suspense fallback={null}>
          <Shell>{children}</Shell>
          <ServerBanner />
        </Suspense>
      </body>
    </html>
  );
}
