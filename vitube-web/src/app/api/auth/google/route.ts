import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSession, createUser, findUserByEmail, sessionCookieOptions, SESSION_COOKIE,
} from '@/lib/auth';
import { verifyGoogleCredential } from '@/lib/google';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { credential = '' } = await req.json();
    const g = await verifyGoogleCredential(String(credential));
    if (!g) return NextResponse.json({ error: 'Google không xác nhận được tài khoản này' }, { status: 401 });

    /*
      Gộp theo email: ai từng đăng ký bằng đúng Gmail này thì vào lại tài khoản cũ,
      giữ nguyên lịch sử. An toàn vì chỉ nhận email Google đã xác minh.

      Tài khoản mới tạo từ Google có mật khẩu ngẫu nhiên không ai biết — đăng nhập
      bằng mật khẩu coi như tắt, muốn vào thì đi đường Google.
    */
    const row = await findUserByEmail(g.email);
    const user = row
      ? { id: row.id, email: row.email, name: row.name }
      : await createUser(g.email, g.name, randomBytes(32).toString('hex'));

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (e: any) {
    console.error('[auth/google] hỏng:', e);
    return NextResponse.json({ error: e?.message ?? 'lỗi đăng nhập Google' }, { status: 500 });
  }
}
