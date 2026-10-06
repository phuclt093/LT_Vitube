'use client';

/**
 * Trạng thái "cài app" dùng chung cho cả app.
 *
 * Chrome Android bắn sự kiện `beforeinstallprompt` MỘT lần, lúc trang vừa đủ điều kiện
 * cài. Nếu không ai giữ lại thì cơ hội tự hiện hộp thoại "Cài vitube" mất luôn — nên
 * bắt nó ngay khi app khởi động (PwaSetup), cất ở đây, để trang /install gọi ra lúc
 * người dùng bấm nút.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

export function captureInstallPrompt(e: Event) {
  e.preventDefault(); // chặn thanh gợi ý mặc định của Chrome, tự hiện nút của mình
  deferred = e as InstallPrompt;
  notify();
}

export function clearInstallPrompt() {
  deferred = null;
  notify();
}

export const canPromptInstall = () => !!deferred;

/** Hiện hộp thoại cài của hệ thống. Trả về true nếu người dùng đồng ý. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Đang chạy như app đã cài (không phải tab trình duyệt) */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true // Safari iOS
  );
}

export type Platform = 'ios' | 'android' | 'desktop';

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  // iPad đời mới tự nhận là Mac — phân biệt bằng màn hình cảm ứng
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
