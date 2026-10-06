import type { NextRequest } from 'next/server';

/**
 * Địa chỉ mà trình duyệt / app đang dùng để gọi server — để dựng đường dẫn proxy.
 *
 * KHÔNG dùng `req.nextUrl.origin`: Next.js (nhất là chế độ dev) chuẩn hoá nó về
 * "localhost" bất kể người dùng mở app bằng 127.0.0.1 hay địa chỉ LAN. Trình duyệt
 * coi localhost và 127.0.0.1 là hai nơi khác nhau, nên mọi lời gọi tới proxy bị chặn
 * CORS — luồng live đứng hình mãi, còn app điện thoại trong nhà thì gọi nhầm về
 * "localhost" của chính nó.
 *
 * Header `Host` giữ đúng những gì bên gọi đã gõ. Đứng sau reverse proxy thì ưu tiên
 * `X-Forwarded-*`.
 */
export function publicOrigin(req: NextRequest): string {
  const h = req.headers;
  const host = h.get('x-forwarded-host')?.split(',')[0].trim() || h.get('host') || req.nextUrl.host;

  /*
    VITUBE_PUBLIC_URL=https://vitube.ten-may.ts.net

    Một số đường hầm HTTPS (Tailscale serve…) không báo cho server biết người dùng đang
    vào bằng https — thiếu nó thì file cài đặt cho iPhone và đường dẫn luồng ghi nhầm
    "http://". Chỉ áp dụng khi người dùng đang vào ĐÚNG tên miền đó; vào bằng IP trong
    mạng nhà thì vẫn dùng địa chỉ họ gõ.
  */
  const pub = process.env.VITUBE_PUBLIC_URL?.trim().replace(/\/+$/, '');
  if (pub) {
    try {
      const u = new URL(pub);
      if (u.host === host) return u.origin;
    } catch {
      /* giá trị hỏng thì bỏ qua */
    }
  }

  const proto =
    h.get('x-forwarded-proto')?.split(',')[0].trim() || req.nextUrl.protocol.replace(/:$/, '') || 'http';
  return `${proto}://${host}`;
}
