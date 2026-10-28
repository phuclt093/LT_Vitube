import { NextRequest, NextResponse } from 'next/server';
import {
  createSession, hashPassword, sessionCookieOptions, SESSION_COOKIE,
} from '@/lib/auth';
import { findUserById, updatePassword } from '@/lib/db';
import { resetTokenUserId, verifyResetToken } from '@/lib/reset';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { token = '', password = '' } = await req.json();
    if (String(password).length < 8)
      return NextResponse.json({ error: 'Mật khẩu phải từ 8 ký tự' }, { status: 400 });

    const id = resetTokenUserId(String(token));
    const row = id ? await findUserById(id) : undefined;
    if (!row || !verifyResetToken(String(token), row.passwordHash))
      return NextResponse.json(
        { error: 'Link đã hết hạn hoặc đã dùng rồi — hãy xin link mới' },
        { status: 400 }
      );

    // Đổi mật khẩu cũng đăng xuất mọi thiết bị khác
    await updatePassword(row.id, hashPassword(password));

    const { token: session, expiresAt } = await createSession(row.id);
    const res = NextResponse.json({ user: { id: row.id, email: row.email, name: row.name } });
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions(expiresAt));
    return res;
  } catch (e: any) {
    console.error('[auth/reset] hỏng:', e);
    return NextResponse.json({ error: e?.message ?? 'lỗi đặt lại mật khẩu' }, { status: 500 });
  }
}
