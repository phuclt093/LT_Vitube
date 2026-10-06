import { currentUser } from './auth';
import { buildProfile, mergeSignals, signalsFromAccount, signalsFromBody, type Profile } from './profile';

/**
 * Hồ sơ của người đang gọi API.
 *
 * Đã đăng nhập → đọc lịch sử, đã thích, xem sau, kênh đăng ký từ tài khoản (dữ liệu
 * của MỌI máy: web, desktop, TV, điện thoại), gộp thêm những gì máy này vừa gửi lên
 * mà có thể chưa kịp đồng bộ. Chưa đăng nhập → chỉ dùng thứ máy gửi lên.
 */
export async function profileFor(body: any): Promise<{ profile: Profile; account: boolean }> {
  const local = signalsFromBody(body ?? {});
  const user = await currentUser().catch(() => null);
  if (!user) return { profile: buildProfile(local), account: false };

  try {
    const remote = await signalsFromAccount(user.id);
    return { profile: buildProfile(mergeSignals(remote, local)), account: true };
  } catch {
    return { profile: buildProfile(local), account: false };
  }
}
