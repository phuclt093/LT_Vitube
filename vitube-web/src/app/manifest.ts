import type { MetadataRoute } from 'next';
import { withBase } from '@/lib/base-path';

// nội dung cố định — dựng một lần lúc build (bắt buộc cho bản tĩnh GitHub Pages)
export const dynamic = 'force-static';

/**
 * Web App Manifest — thứ biến vitube thành "app" khi cài lên điện thoại.
 * Next.js phục vụ file này ở /manifest.webmanifest.
 *
 * `display: standalone` = mở lên không có thanh địa chỉ, không có nút trình duyệt.
 * `id` cố định để đổi `start_url` sau này cũng không làm máy tưởng là app khác.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase('/'),
    name: 'vitube — xem video không quảng cáo',
    short_name: 'vitube',
    description: 'Trình xem YouTube và Bilibili tối giản, không quảng cáo.',
    lang: 'vi',
    start_url: withBase('/?source=pwa'),
    scope: withBase('/'),
    display: 'standalone',
    orientation: 'any',
    background_color: '#faf7f0',
    theme_color: '#faf7f0',
    categories: ['entertainment', 'video'],
    icons: [
      { src: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: withBase('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: withBase('/icons/maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Bilibili', url: withBase('/bili'), icons: [{ src: withBase('/icons/icon-192.png'), sizes: '192x192' }] },
      { name: 'Video đã xem', url: withBase('/history'), icons: [{ src: withBase('/icons/icon-192.png'), sizes: '192x192' }] },
    ],
  };
}
