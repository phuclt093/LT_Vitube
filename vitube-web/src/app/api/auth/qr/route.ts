import { NextRequest, NextResponse } from 'next/server';
import { createSession, currentUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { findUserById } from '@/lib/db';
import { approveQr, describeDevice, peekQr, pollQr, startQr } from '@/lib/qr-login';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Đăng nhập bằng QR — một endpoint, phân việc theo `action`. Cơ chế ở `lib/qr-login.ts`.
 *
 *   start    máy chưa đăng nhập xin mã
 *   poll     máy đó hỏi đã được duyệt chưa — được rồi thì nhận cookie phiên luôn
 *   peek     điện thoại xem máy nào đang xin vào
 *   approve  điện thoại (đã đăng nhập) cho phép
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    switch (body.action) {
      case 'start':
        return NextResponse.json(startQr(describeDevice(req.headers.get('user-agent') ?? '')));

      case 'poll': {
        const r = pollQr(String(body.poll ?? ''));
        if (r.status !== 'approved') return NextResponse.json(r);
        const row = await findUserById(r.userId);
        if (!row) return NextResponse.json({ status: 'expired' });
        const { token, expiresAt } = await createSession(row.id);
        const res = NextResponse.json({
          status: 'approved',
          user: { id: row.id, email: row.email, name: row.name },
        });
        res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
        return res;
      }

      case 'peek': {
        const p = peekQr(String(body.code ?? ''));
        return p
          ? NextResponse.json(p)
          : NextResponse.json({ error: 'Mã QR đã hết hạn — bấm tạo mã mới trên máy kia' }, { status: 404 });
      }

      case 'approve': {
        const me = await currentUser();
        if (!me) return NextResponse.json({ error: 'Điện thoại này chưa đăng nhập xemchua' }, { status: 401 });
        if (!approveQr(String(body.code ?? ''), me.id))
          return NextResponse.json({ error: 'Mã QR đã hết hạn hoặc đã dùng' }, { status: 404 });
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: 'action không hợp lệ' }, { status: 400 });
  } catch (e: any) {
    console.error('[auth/qr] hỏng:', e);
    return NextResponse.json({ error: e?.message ?? 'lỗi đăng nhập QR' }, { status: 500 });
  }
}
