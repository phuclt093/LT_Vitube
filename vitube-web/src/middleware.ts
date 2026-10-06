import { NextRequest, NextResponse } from 'next/server';

/**
 * Mở CORS cho API, để một bản vitube cài trên máy khác — hoặc bản giao diện tĩnh
 * trên GitHub Pages — gọi tới được.
 *
 * Bản GitHub Pages không có server riêng nên gọi MỌI endpoint ở đây (feed, tìm
 * kiếm, luồng video…), không chỉ tài khoản/thư viện. Vì vậy matcher phủ cả /api.
 * Ví dụ cho GitHub Pages:
 *
 *   VITUBE_ALLOW_ORIGINS=https://phuclt093.github.io
 *
 * (origin không có đường dẫn — không ghi /LT_Vitube ở cuối)
 *
 *   VITUBE_ALLOW_ORIGINS=https://vitube.example.com,local
 *
 * Bỏ trống (mặc định) thì **không mở gì cả** — server chỉ phục vụ chính nó, đúng
 * như chế độ chạy trên máy cá nhân. Chỉ đặt biến này trên server dùng chung.
 *
 * Giá trị đặc biệt:
 *   `local`  cho phép mọi `http://localhost:<cổng>` và `http://127.0.0.1:<cổng>`.
 *            Cần cho app desktop: vỏ Electron xin cổng trống lúc khởi động nên
 *            origin của nó đổi mỗi lần chạy, không thể liệt kê sẵn.
 *   `*`      cho phép tất cả. Chỉ dùng khi thử nghiệm — kèm cookie thì đây là
 *            mời cả internet mượn phiên đăng nhập của người khác.
 *
 * Origin không nằm trong danh sách thì middleware không thêm header nào — trình
 * duyệt tự chặn, server vẫn phục vụ chính nó như cũ.
 */
export const config = {
  matcher: ['/api/:path*'],
};

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function allowList(): string[] {
  return (process.env.VITUBE_ALLOW_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function allowed(origin: string): boolean {
  const list = allowList();
  if (!list.length) return false;
  if (list.includes('*')) return true;
  if (list.includes(origin)) return true;
  return list.includes('local') && LOCAL.test(origin);
}

/**
 * Không dùng `Access-Control-Allow-Origin: *` được: kèm `credentials` là trình
 * duyệt từ chối thẳng. Phải phản chiếu đúng origin đang gọi, và khai `Vary:
 * Origin` để proxy không phát nhầm phản hồi của origin này cho origin khác.
 */
function cors(res: NextResponse, origin: string): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Vary', 'Origin');
  // để fetch/Shaka đọc được thông tin phát theo đoạn của /api/stream
  res.headers.set(
    'Access-Control-Expose-Headers',
    'Content-Range, Content-Length, Accept-Ranges, Content-Type'
  );
  return res;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');

  // Cùng origin thì không có header này, và cũng chẳng cần CORS
  if (!origin || !allowed(origin)) return NextResponse.next();

  if (req.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.headers.set(
      'Access-Control-Allow-Headers',
      req.headers.get('access-control-request-headers') ?? 'Content-Type'
    );
    // Nhớ kết quả kiểm tra trước một ngày, khỏi hỏi lại mỗi request
    res.headers.set('Access-Control-Max-Age', '86400');
    return cors(res, origin);
  }

  return cors(NextResponse.next(), origin);
}
