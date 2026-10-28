import nodemailer from 'nodemailer';

/**
 * Gửi email qua SMTP — dùng cho "Quên mật khẩu".
 *
 * Chọn SMTP chứ không gọi API riêng của dịch vụ nào: Gmail, Resend, Brevo… đều
 * có cổng SMTP, đổi nhà cung cấp chỉ là đổi biến môi trường. Với app cá nhân thì
 * Gmail + mật khẩu ứng dụng là gọn nhất — gửi được tới mọi địa chỉ, không cần
 * sở hữu tên miền như Resend đòi.
 *
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465                 (465 = SSL; 587 = STARTTLS)
 *   SMTP_USER=ban@gmail.com
 *   SMTP_PASS=<mật khẩu ứng dụng 16 ký tự>
 *   MAIL_FROM="xemchua <ban@gmail.com>"   (bỏ trống thì dùng SMTP_USER)
 *
 * Các biến này chỉ nằm trên server (`.env.local`), không bao giờ tới trình duyệt.
 */

export const mailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const g = globalThis as any;

function transport() {
  if (g.__vitubeMailer) return g.__vitubeMailer as nodemailer.Transporter;
  const port = Number(process.env.SMTP_PORT || 465);
  g.__vitubeMailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return g.__vitubeMailer as nodemailer.Transporter;
}

export async function sendMail(to: string, subject: string, text: string, html: string) {
  await transport().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}
