import { randomBytes } from 'node:crypto';

/**
 * Đăng nhập máy khác bằng mã QR (kiểu Zalo/Telegram trên máy tính).
 *
 *   1. Máy chưa đăng nhập (TV, máy tính) xin một phiên → nhận `code` và `poll`.
 *      `code` vẽ thành QR; `poll` giữ kín, chỉ máy đó biết.
 *   2. Điện thoại đã đăng nhập quét QR → mở trang /link → bấm "Cho phép".
 *   3. Máy kia hỏi bằng `poll` thấy đã được duyệt → server cấp phiên đăng nhập.
 *
 * Tách hai mã để người nhìn trộm QR không tự lấy phiên được: QR chỉ chứa `code`,
 * mà `code` chỉ dùng để duyệt, không dùng để nhận phiên.
 *
 * Giữ trong RAM: server chỉ có một tiến trình, phiên sống 2 phút, khởi động lại
 * thì mất — quét lại là xong, chẳng đáng một bảng trong database.
 */

const TTL = 2 * 60_000;
const MAX = 500;

type Pending = {
  code: string;
  poll: string;
  device: string;
  expiresAt: number;
  userId?: number;
  done?: boolean;
};

const g = globalThis as any;
const byCode: Map<string, Pending> = (g.__vitubeQrLogin ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [k, v] of byCode) if (v.expiresAt < now || v.done) byCode.delete(k);
}

const shortCode = () => randomBytes(9).toString('base64url');

export function startQr(device: string) {
  sweep();
  if (byCode.size >= MAX) throw new Error('Quá nhiều yêu cầu đăng nhập, thử lại sau');
  const p: Pending = {
    code: shortCode(),
    poll: randomBytes(24).toString('base64url'),
    device: device.slice(0, 120),
    expiresAt: Date.now() + TTL,
  };
  byCode.set(p.code, p);
  return { code: p.code, poll: p.poll, expiresAt: p.expiresAt };
}

const live = (code: string) => {
  const p = byCode.get(code);
  return p && p.expiresAt > Date.now() && !p.done ? p : undefined;
};

/** Thông tin hiện cho người duyệt xem — máy nào đang xin vào */
export function peekQr(code: string) {
  const p = live(code);
  return p && { device: p.device, approved: !!p.userId };
}

export function approveQr(code: string, userId: number): boolean {
  const p = live(code);
  if (!p || p.userId) return false;
  p.userId = userId;
  return true;
}

/** Máy đang chờ hỏi kết quả. Trả userId đúng một lần rồi xoá phiên. */
export function pollQr(poll: string): { status: 'pending' | 'expired' } | { status: 'approved'; userId: number } {
  for (const p of byCode.values()) {
    if (p.poll !== poll) continue;
    if (p.expiresAt < Date.now() || p.done) return { status: 'expired' };
    if (!p.userId) return { status: 'pending' };
    p.done = true;
    return { status: 'approved', userId: p.userId };
  }
  return { status: 'expired' };
}

/** Tên thiết bị đọc từ User-Agent — chỉ để người duyệt nhận ra máy mình */
export function describeDevice(ua: string): string {
  const os =
    /Android TV|AFT|BRAVIA|SmartTV|Tizen|Web0S/i.test(ua) ? 'TV' :
    /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad/i.test(ua) ? 'iPhone/iPad' :
    /Windows/i.test(ua) ? 'Windows' :
    /Mac OS/i.test(ua) ? 'Mac' :
    /Linux/i.test(ua) ? 'Linux' : 'Thiết bị lạ';
  const app =
    /Electron/i.test(ua) ? 'app xemchua' :
    /Edg\//i.test(ua) ? 'Edge' :
    /Chrome\//i.test(ua) ? 'Chrome' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Safari\//i.test(ua) ? 'Safari' : 'trình duyệt';
  return `${app} trên ${os}`;
}
