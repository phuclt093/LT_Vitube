import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Mã đặt lại mật khẩu, không cần bảng mới trong cơ sở dữ liệu.
 *
 * Mã = `<id>.<hạn>.<chữ ký>`, chữ ký là HMAC ký bằng **mã băm mật khẩu hiện tại**
 * của người dùng (cộng `AUTH_SECRET` nếu có). Nhờ vậy:
 *
 *   - Không ai làm giả được: phải biết mã băm nằm trong database.
 *   - Dùng một lần: đổi mật khẩu xong thì mã băm đổi, mọi link cũ tự hết hiệu lực.
 *   - Không phải thêm bảng/cột cho cả ba driver (sqlite, turso, json).
 */

const TTL = 30 * 60_000; // 30 phút

const sign = (payload: string, passwordHash: string) =>
  createHmac('sha256', `${process.env.AUTH_SECRET ?? ''}|${passwordHash}`)
    .update(payload)
    .digest('base64url');

export function makeResetToken(userId: number, passwordHash: string): string {
  const payload = `${userId}.${Date.now() + TTL}`;
  return `${payload}.${sign(payload, passwordHash)}`;
}

/** Đọc id từ mã — chưa kiểm chữ ký, chỉ để biết phải lấy người dùng nào ra */
export function resetTokenUserId(token: string): number | null {
  const id = Number(token.split('.')[0]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function verifyResetToken(token: string, passwordHash: string): boolean {
  const [id, exp, sig] = token.split('.');
  if (!id || !exp || !sig) return false;
  if (!(Number(exp) > Date.now())) return false;
  const want = Buffer.from(sign(`${id}.${exp}`, passwordHash));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
