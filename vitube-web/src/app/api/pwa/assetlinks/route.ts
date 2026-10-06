import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
^ * /.well-known/assetlinks.json (qua rewrite trong next.config.mjs) — "giấy chứng nhận" cho app Android bọc web (TWA).
 *
 * File APK trong vitube_PWA/android chỉ mở vitube TOÀN MÀN HÌNH (không thanh địa chỉ)
 * khi tên miền xác nhận "APK này là của tôi" qua file này. Thiếu nó thì app vẫn chạy
 * nhưng hiện một thanh địa chỉ nhỏ ở trên — Chrome cẩn thận để không ai giả mạo trang.
 *
 *   TWA_PACKAGE=app.vitube.pwa               (mặc định)
 *   TWA_SHA256=AB:CD:…                      vân tay chứng chỉ ký APK; nhiều cái thì ngăn bằng dấu phẩy
 *
 * Script build APK in sẵn giá trị TWA_SHA256 cần đặt.
 */
export function GET() {
  const pkg = process.env.TWA_PACKAGE?.trim() || 'app.vitube.pwa';
  const prints = (process.env.TWA_SHA256 ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const body = prints.length
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: prints },
        },
      ]
    : [];

  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
