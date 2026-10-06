import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { publicOrigin } from '@/lib/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const run = promisify(execFile);

/**
 * GET /api/pwa/mobileconfig — "file cài đặt" vitube cho iPhone / iPad.
 *
 * Là một hồ sơ cấu hình Web Clip: cơ chế chính thức của Apple để đặt một biểu tượng
 * web lên màn hình chính (các công ty dùng nó để đẩy app nội bộ cho nhân viên). Người
 * nhận mở file → Cài đặt → "Đã tải về hồ sơ" → Cài đặt. Không qua App Store.
 *
 * Địa chỉ trong hồ sơ là địa chỉ người dùng đang mở server này (lấy từ header Host),
 * nên cùng một server phục vụ được cả tên miền thật lẫn địa chỉ Tailscale.
 *
 * Ký hồ sơ (tuỳ chọn): đặt PWA_SIGN_CERT, PWA_SIGN_KEY (và PWA_SIGN_CHAIN nếu có) trỏ
 * tới chứng chỉ HTTPS của tên miền — iPhone sẽ hiện "Đã xác minh" thay vì "Chưa ký".
 * Không đặt thì phục vụ bản chưa ký, vẫn cài được bình thường.
 */

/** UUID cố định theo tên miền: cài lại thì iOS thay hồ sơ cũ, không sinh biểu tượng trùng */
function stableUuid(seed: string): string {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function iconBase64(): string {
  const p = path.join(process.cwd(), 'public', 'icons', 'apple-touch-icon.png');
  try {
    return existsSync(p) ? readFileSync(p).toString('base64') : '';
  } catch {
    return '';
  }
}

async function sign(xml: string): Promise<Buffer | null> {
  const cert = process.env.PWA_SIGN_CERT?.trim();
  const key = process.env.PWA_SIGN_KEY?.trim();
  if (!cert || !key || !existsSync(cert) || !existsSync(key)) return null;

  const chain = process.env.PWA_SIGN_CHAIN?.trim();
  const args = ['smime', '-sign', '-signer', cert, '-inkey', key, '-nodetach', '-outform', 'der'];
  if (chain && existsSync(chain)) args.push('-certfile', chain);

  try {
    const child = run('openssl', args, { encoding: 'buffer', maxBuffer: 4 * 1024 * 1024 } as any);
    (child as any).child.stdin.end(xml);
    const { stdout } = (await child) as unknown as { stdout: Buffer };
    return stdout?.length ? stdout : null;
  } catch (e: any) {
    console.warn('[mobileconfig] ký hồ sơ thất bại, phục vụ bản chưa ký —', e?.message ?? e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const host = new URL(origin).hostname;
  const id = host.replace(/[^a-zA-Z0-9.-]/g, '-');
  const icon = iconBase64();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
${icon ? `      <key>Icon</key>\n      <data>${icon}</data>\n` : ''}      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>vitube</string>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${esc(origin)}/?source=webclip</string>
      <key>PayloadDescription</key>
      <string>Biểu tượng vitube trên màn hình chính</string>
      <key>PayloadDisplayName</key>
      <string>vitube</string>
      <key>PayloadIdentifier</key>
      <string>app.vitube.webclip.${esc(id)}</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>${stableUuid('webclip:' + host)}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Thêm vitube vào màn hình chính. Hồ sơ này chỉ chứa một biểu tượng trỏ tới ${esc(origin)} — không cài phần mềm, không đổi cài đặt nào khác của máy. Gỡ bất cứ lúc nào trong Cài đặt → Cài đặt chung → VPN &amp; Quản lý thiết bị.</string>
  <key>PayloadDisplayName</key>
  <string>vitube</string>
  <key>PayloadIdentifier</key>
  <string>app.vitube.profile.${esc(id)}</string>
  <key>PayloadOrganization</key>
  <string>vitube</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${stableUuid('profile:' + host)}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;

  const signed = await sign(xml);
  const body = signed ?? Buffer.from(xml, 'utf-8');

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': 'application/x-apple-aspen-config',
      'Content-Disposition': 'attachment; filename="vitube.mobileconfig"',
      'Cache-Control': 'no-store',
      'X-Vitube-Signed': signed ? '1' : '0',
    },
  });
}
