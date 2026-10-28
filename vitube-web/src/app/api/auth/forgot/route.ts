import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/auth';
import { mailConfigured, sendMail } from '@/lib/mail';
import { makeResetToken } from '@/lib/reset';
import { publicOrigin } from '@/lib/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Một email chỉ được xin link mỗi phút một lần — chặn spam hộp thư người khác */
const recent: Map<string, number> = ((globalThis as any).__vitubeForgot ??= new Map());

/**
 * Trang nào được nhận link đặt lại.
 *
 * Không tin địa chỉ do trình duyệt gửi lên trong body: kẻ xấu sẽ điền trang của
 * hắn, và email thật từ xemchua sẽ dẫn nạn nhân tới đó kèm mã còn hiệu lực.
 * Header `Origin` thì trình duyệt tự đặt, và chỉ nhận nếu nằm trong danh sách
 * `VITUBE_ALLOW_ORIGINS` hoặc chính là server này.
 */
function appOrigin(req: NextRequest): string {
  const own = publicOrigin(req);
  const origin = req.headers.get('origin')?.replace(/\.(:\d+)?$/, '$1');
  if (!origin || origin === own) return own;
  const list = (process.env.VITUBE_ALLOW_ORIGINS ?? '').split(',').map((s) => s.trim());
  return list.includes(origin) ? origin : own;
}

export async function POST(req: NextRequest) {
  try {
    const { email = '', base = '' } = await req.json();
    const key = String(email).trim().toLowerCase();

    if (!mailConfigured())
      return NextResponse.json(
        { error: 'Server chưa cấu hình gửi email — nhờ chủ server đặt lại mật khẩu giúp' },
        { status: 503 }
      );

    // Trả cùng một câu dù email có tồn tại hay không — không cho dò email đã đăng ký
    const done = NextResponse.json({ ok: true });

    const last = recent.get(key) ?? 0;
    if (Date.now() - last < 60_000) return done;
    recent.set(key, Date.now());

    const user = await findUserByEmail(key);
    if (!user) return done;

    // basePath của GitHub Pages (`/LT_Vitube`) — chỉ nhận dạng đường dẫn đơn giản
    const path = /^(\/[\w-]+)*$/.test(base) ? base : '';
    const link = `${appOrigin(req)}${path}/reset-password/?token=${makeResetToken(user.id, user.passwordHash)}`;

    await sendMail(
      user.email,
      'Đặt lại mật khẩu xemchua',
      `Chào ${user.name},\n\nBấm vào link sau để đặt mật khẩu mới (hết hạn sau 30 phút):\n${link}\n\nKhông phải bạn yêu cầu thì cứ bỏ qua email này.`,
      `<p>Chào ${escapeHtml(user.name)},</p>
<p>Bấm vào nút dưới để đặt mật khẩu mới. Link hết hạn sau 30 phút.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:#a93a2e;color:#fff;text-decoration:none">Đặt lại mật khẩu</a></p>
<p style="color:#888;font-size:12px">Không phải bạn yêu cầu thì cứ bỏ qua email này.</p>`
    );
    return done;
  } catch (e: any) {
    console.error('[auth/forgot] hỏng:', e);
    return NextResponse.json({ error: 'Không gửi được email, thử lại sau' }, { status: 500 });
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
