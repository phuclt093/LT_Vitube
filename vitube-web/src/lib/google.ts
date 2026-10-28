/**
 * "Đăng nhập bằng Google" — kiểm tra ID token mà nút Google trả cho trình duyệt.
 *
 *   GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
 *
 * Client ID là thông tin công khai (nằm sẵn trong trang web), không phải bí mật.
 * Luồng này cũng không cần client secret: trình duyệt nhận thẳng một ID token đã
 * được Google ký, server chỉ việc xác minh.
 *
 * Xác minh bằng endpoint `tokeninfo` của Google thay vì tự tải khoá và kiểm chữ
 * ký JWT: thêm một vòng gọi mạng mỗi lần đăng nhập, nhưng đăng nhập hiếm khi xảy
 * ra, đổi lại khỏi phải thêm thư viện và tự lo xoay vòng khoá.
 */

export const googleClientId = () => process.env.GOOGLE_CLIENT_ID?.trim() || '';

export type GoogleProfile = { email: string; name: string };

export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile | null> {
  const clientId = googleClientId();
  if (!clientId || !credential) return null;

  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { cache: 'no-store' }
  );
  if (!r.ok) return null;
  const t = await r.json();

  // Token phải được cấp cho ĐÚNG app này — không thì trang khác lấy token của họ đem sang dùng
  if (t.aud !== clientId) return null;
  if (t.iss !== 'accounts.google.com' && t.iss !== 'https://accounts.google.com') return null;
  if (!(Number(t.exp) * 1000 > Date.now())) return null;
  // Chỉ tin email Google đã xác minh — gộp tài khoản theo email nên chỗ này quan trọng
  if (t.email_verified !== true && t.email_verified !== 'true') return null;
  if (!t.email) return null;

  return { email: String(t.email).toLowerCase(), name: String(t.name || t.email.split('@')[0]) };
}
