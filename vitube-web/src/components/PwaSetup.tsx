'use client';

import { useEffect } from 'react';
import { BASE_PATH } from '@/lib/base-path';
import { captureInstallPrompt, clearInstallPrompt } from '@/lib/pwa';

/**
 * Đăng ký service worker và giữ lại lời mời cài app của Chrome.
 *
 * Chỉ đăng ký ở bản build thật. Ở `npm run dev`, tên file của Next không có mã băm —
 * service worker sẽ giữ code cũ và sửa gì cũng không thấy đổi. Nên ở dev còn chủ động
 * gỡ service worker cũ (nếu từng chạy bản build trên cùng địa chỉ).
 *
 * Vỏ desktop (Electron) không cần: nó vốn đã là app.
 */
export default function PwaSetup() {
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', clearInstallPrompt);

    const sw = navigator.serviceWorker;
    const desktop = !!(globalThis as any).vitubeDesktop?.isDesktop;

    if (sw && !desktop) {
      if (process.env.NODE_ENV === 'production') {
        sw.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch((e) => console.warn('[vitube] không đăng ký được service worker:', e));
      } else {
        sw.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', clearInstallPrompt);
    };
  }, []);

  return null;
}
