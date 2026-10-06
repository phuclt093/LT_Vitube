'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiBase, onApiBaseChange } from '@/lib/api';
import { IS_STATIC } from '@/lib/base-path';

/**
 * Chỉ hiện ở bản tĩnh (GitHub Pages) khi chưa trỏ tới server vitube nào.
 *
 * Bản tĩnh chỉ có giao diện; feed, tìm kiếm và luồng video đều phải lấy từ một
 * server vitube chạy ở chỗ khác. Chưa đặt địa chỉ thì trang nào cũng trống trơn —
 * nói rõ lý do và chỉ đường vào Cài đặt.
 */
export default function ServerBanner() {
  const [missing, setMissing] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!IS_STATIC) return;
    const check = () => setMissing(!apiBase());
    check();
    return onApiBaseChange(() => {
      check();
      // các lời gọi đã thất bại trước đó không tự chạy lại — nạp lại trang cho sạch
      if (apiBase()) location.reload();
    });
  }, []);

  if (!IS_STATIC || !missing || pathname?.startsWith('/settings')) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] mx-auto w-[min(92vw,560px)] rounded-xl border border-yt-border bg-yt-bg2 p-4 text-sm shadow-lg">
      <p className="font-medium">Chưa kết nối máy chủ vitube</p>
      <p className="mt-1 text-xs leading-5 text-yt-sub">
        Bản trên GitHub Pages chỉ có giao diện. Video, feed và tìm kiếm cần một server vitube
        đang chạy (máy nhà qua Tailscale Funnel / Cloudflare Tunnel, hoặc VPS).
      </p>
      <Link
        href="/settings"
        className="mt-3 inline-block rounded-full bg-yt-text px-4 py-1.5 text-xs font-medium text-yt-bg"
      >
        Nhập địa chỉ máy chủ
      </Link>
    </div>
  );
}
