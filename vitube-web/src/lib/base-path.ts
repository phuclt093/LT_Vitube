/**
 * Tiền tố đường dẫn khi chạy trên GitHub Pages (`/<tên-repo>`), rỗng ở mọi chỗ khác.
 *
 * `next/link` và `router.push` tự thêm basePath, nhưng các chuỗi đường dẫn viết tay
 * (icon trong metadata, manifest, service worker, `<img src>`) thì không — dùng `withBase`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const IS_STATIC = process.env.NEXT_PUBLIC_VITUBE_STATIC === '1';

export const withBase = (path: string) => `${BASE_PATH}${path}`;
