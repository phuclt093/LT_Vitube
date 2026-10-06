'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { withBase } from '@/lib/base-path';
import {
  canPromptInstall,
  detectPlatform,
  isStandalone,
  onInstallChange,
  promptInstall,
  type Platform,
} from '@/lib/pwa';

/**
 * /install — trang bạn gửi link cho người khác để cài vitube lên điện thoại.
 *
 *   iPhone   tải "file cài đặt" (.mobileconfig) → Cài đặt → Đã tải về hồ sơ → Cài đặt
 *   Android  bấm "Cài vitube" (hộp thoại của Chrome), hoặc tải file .apk nếu có đặt sẵn
 *   Máy tính hiện địa chỉ để mở trên điện thoại
 */
export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [standalone, setStandalone] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [secure, setSecure] = useState(true);
  const [origin, setOrigin] = useState('');
  const [hasApk, setHasApk] = useState(false);
  const [iosOtherBrowser, setIosOtherBrowser] = useState(false);
  const [done, setDone] = useState(false);
  /** mốc bấm tải hồ sơ iPhone — iOS chỉ giữ hồ sơ chờ cài khoảng 8 phút */
  const [profileAt, setProfileAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!profileAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [profileAt]);

  const PROFILE_TTL = 8 * 60 * 1000;
  const left = profileAt ? Math.max(0, PROFILE_TTL - ((now || profileAt) - profileAt)) : 0;
  const mmss = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
    setOrigin(location.origin);
    setSecure(window.isSecureContext);
    // Trên iPhone, chỉ Safari mới mở được file hồ sơ — Chrome/Firefox/Edge iOS thì không
    setIosOtherBrowser(/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent));
    const read = () => setCanPrompt(canPromptInstall());
    read();
    // file .apk là tuỳ chọn: chỉ hiện nút tải khi bạn đã đặt nó vào public/download/
    fetch('/download/vitube.apk', { method: 'HEAD' })
      .then((r) => setHasApk(r.ok))
      .catch(() => {});
    return onInstallChange(read);
  }, []);

  const install = async () => setDone(await promptInstall());

  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-10">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={withBase('/icons/icon-192.png')} alt="" className="h-16 w-16" />
        <div>
          <h1 className="text-2xl font-bold">Cài vitube</h1>
          <p className="text-sm text-yt-sub">Xem video không quảng cáo, mở như một ứng dụng.</p>
        </div>
      </div>

      {standalone ? (
        <Card>
          <p className="font-medium">Bạn đang dùng vitube dạng ứng dụng rồi 🎉</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-yt-text px-5 py-2.5 text-sm font-medium text-yt-bg">
            Về trang chủ
          </Link>
        </Card>
      ) : (
        <>
          {!secure && (
            <Card tone="warn">
              <p className="font-medium">Địa chỉ này chưa có HTTPS</p>
              <p className="mt-1 text-sm">
                Điện thoại chỉ cài được vitube dạng ứng dụng từ một địa chỉ <code>https://</code>. Mở bằng địa
                chỉ hiện tại thì chỉ tạo được dấu trang. Xem hướng dẫn dựng HTTPS trong thư mục{' '}
                <code>vitube_PWA</code>.
              </p>
            </Card>
          )}

          {/* ---------------- iPhone / iPad ---------------- */}
          {platform === 'ios' && (
            <>
              {iosOtherBrowser && (
                <Card tone="warn">
                  <p className="text-sm">
                    Hãy mở trang này bằng <b>Safari</b> — trên iPhone chỉ Safari mới cài được file hồ sơ.
                  </p>
                </Card>
              )}
              <Card>
                {/*
                  Tải xong iPhone KHÔNG tự cài — Apple bắt người dùng vào app Cài đặt để
                  xác nhận, và trình duyệt không được phép mở thẳng Cài đặt. Người dùng
                  thường dừng ở thông báo "Đã tải về hồ sơ" rồi tưởng là hỏng, nên sau khi
                  bấm tải, trang đổi hẳn sang màn "bước tiếp theo" kèm đồng hồ 8 phút.
                */}
                {profileAt && left > 0 ? (
                  <div className="rounded-2xl border-2 border-yt-red bg-yt-red/10 p-4">
                    <p className="text-base font-bold">Đã tải — giờ mở app Cài đặt để cài</p>
                    <p className="mt-1 text-sm">
                      iPhone không tự cài hồ sơ. Còn <b className="tabular-nums">{mmss}</b> trước khi hồ sơ
                      tự huỷ.
                    </p>
                    <Steps
                      items={[
                        'Thoát ra màn hình chính, mở app Cài đặt (bánh răng ⚙️).',
                        'Bấm dòng "Đã tải về hồ sơ" ngay dưới tên tài khoản Apple ở trên cùng. (Không thấy thì vào Cài đặt chung → VPN & Quản lý thiết bị → vitube.)',
                        'Bấm Cài đặt ở góc trên phải → nhập mật mã → bấm Cài đặt lần nữa → Xong.',
                        'Biểu tượng vitube xuất hiện trên màn hình chính.',
                      ]}
                    />
                    <p className="mt-3 text-xs text-yt-sub">
                      Chữ "Chưa ký" màu đỏ lúc cài là bình thường. Quá giờ thì bấm tải lại bên dưới.
                    </p>
                    <a
                      href="/api/pwa/mobileconfig"
                      onClick={() => {
                        setProfileAt(Date.now());
                        setNow(Date.now());
                      }}
                      className="mt-3 block text-center text-sm text-yt-sub underline"
                    >
                      Tải lại file cài đặt
                    </a>
                  </div>
                ) : (
                  <>
                    <a
                      href="/api/pwa/mobileconfig"
                      onClick={() => {
                        setProfileAt(Date.now());
                        setNow(Date.now());
                      }}
                      className="block rounded-full bg-yt-red px-5 py-3 text-center font-medium text-white"
                    >
                      {profileAt ? 'Hồ sơ đã hết hạn — tải lại' : 'Tải file cài đặt'}
                    </a>
                    <Steps
                      items={[
                        'Bấm "Tải file cài đặt", rồi chọn Cho phép.',
                        'Mở app Cài đặt — ngay trên cùng có dòng "Đã tải về hồ sơ", bấm vào.',
                        'Bấm Cài đặt (góc trên phải), nhập mật mã máy, bấm Cài đặt thêm lần nữa.',
                        'Xong — biểu tượng vitube nằm trên màn hình chính.',
                      ]}
                    />
                  </>
                )}
                <p className="mt-3 text-xs text-yt-sub">
                  Hồ sơ chỉ chứa một biểu tượng trỏ tới {origin || 'trang này'}, không cài phần mềm và không
                  đổi cài đặt nào khác. Gỡ bất cứ lúc nào ở Cài đặt → Cài đặt chung → VPN &amp; Quản lý thiết bị.
                </p>
              </Card>
              <Card>
                <p className="text-sm font-medium">Hoặc thêm tay, không cần hồ sơ</p>
                <Steps
                  items={[
                    'Bấm nút Chia sẻ (ô vuông có mũi tên lên) ở thanh dưới của Safari.',
                    'Kéo xuống, chọn "Thêm vào Màn hình chính".',
                    'Bấm Thêm.',
                  ]}
                />
              </Card>
            </>
          )}

          {/* ---------------- Android ---------------- */}
          {platform === 'android' && (
            <Card>
              {done ? (
                <p className="font-medium">Đã cài! Mở vitube từ màn hình chính hoặc danh sách ứng dụng.</p>
              ) : canPrompt ? (
                <button onClick={install} className="w-full rounded-full bg-yt-red px-5 py-3 font-medium text-white">
                  Cài vitube
                </button>
              ) : (
                <>
                  <p className="text-sm font-medium">Cài từ trình duyệt</p>
                  <Steps
                    items={[
                      'Mở trang này bằng Chrome.',
                      'Bấm nút ⋮ ở góc trên phải.',
                      'Chọn "Cài đặt ứng dụng" (hoặc "Thêm vào màn hình chính").',
                    ]}
                  />
                </>
              )}
              {hasApk && (
                <div className="mt-5 border-t border-yt-border pt-4">
                  <a
                    href="/download/vitube.apk"
                    download
                    className="block rounded-full bg-yt-chip px-5 py-3 text-center text-sm font-medium"
                  >
                    Tải file cài đặt (.apk)
                  </a>
                  <p className="mt-2 text-xs text-yt-sub">
                    Mở file vừa tải → cho phép cài từ nguồn này nếu máy hỏi → Cài đặt.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* ---------------- máy tính ---------------- */}
          {platform === 'desktop' && (
            <Card>
              <p className="text-sm">Mở địa chỉ này trên điện thoại để cài:</p>
              <p className="mt-2 break-all rounded-lg bg-yt-chip px-3 py-2 font-mono text-sm">{origin}/install</p>
              {canPrompt && (
                <button onClick={install} className="mt-4 rounded-full bg-yt-chip px-5 py-2.5 text-sm font-medium">
                  Cài vitube trên máy tính này
                </button>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone?: 'warn' }) {
  return (
    <div
      className={`mt-5 rounded-2xl p-5 ${
        tone === 'warn' ? 'border border-yt-red/40 bg-yt-red/10' : 'bg-yt-elev'
      }`}
    >
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 space-y-2 text-sm">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-yt-chip text-xs font-medium">
            {i + 1}
          </span>
          <span className="pt-0.5">{t}</span>
        </li>
      ))}
    </ol>
  );
}
