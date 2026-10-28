import { NextResponse } from 'next/server';
import { googleClientId } from '@/lib/google';
import { mailConfigured } from '@/lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Những cách đăng nhập server này đang bật.
 *
 * Trang tĩnh trên Pages đọc từ đây thay vì nhúng lúc build — đổi Client ID chỉ
 * cần khởi động lại server, khỏi build lại trang.
 */
export function GET() {
  return NextResponse.json({ google: googleClientId() || null, mail: mailConfigured() });
}
