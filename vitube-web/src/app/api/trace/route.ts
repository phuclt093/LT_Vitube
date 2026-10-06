import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Nhật ký từ điện thoại → in ra terminal của server (logs/server.log).
 *
 * Dùng để dò những lỗi chỉ xảy ra trên máy thật (cửa sổ nổi trên Android...) mà
 * không cắm cáp gỡ lỗi được. Chỉ nhận chuỗi ngắn, không lưu gì.
 */
export async function POST(req: NextRequest) {
  try {
    const text = (await req.text()).slice(0, 4000);
    const lines = JSON.parse(text) as { t: string; m: string; d?: unknown }[];
    for (const l of Array.isArray(lines) ? lines.slice(0, 40) : []) {
      console.log(`[trace ${l.t}] ${String(l.m).slice(0, 200)}${l.d ? ' ' + JSON.stringify(l.d).slice(0, 600) : ''}`);
    }
  } catch {
    /* gói hỏng thì bỏ */
  }
  return new Response(null, { status: 204 });
}
