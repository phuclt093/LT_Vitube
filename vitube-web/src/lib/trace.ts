'use client';

/**
 * Gửi nhật ký ngắn từ điện thoại về server để đọc trong logs/server.log.
 * Chỉ bật trên máy cảm ứng (nơi không mở được công cụ gỡ lỗi). Gom lại rồi gửi
 * mỗi giây một lần; lúc trang bị ẩn thì gửi ngay bằng sendBeacon cho chắc tới nơi.
 */

type Line = { t: string; m: string; d?: unknown };
let queue: Line[] = [];
let timer: number | null = null;

const enabled = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

function flush() {
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify(queue.splice(0, 40));
  try {
    if (navigator.sendBeacon?.('/api/trace', new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    /* thử đường khác */
  }
  fetch('/api/trace', { method: 'POST', body, keepalive: true }).catch(() => {});
}

export function trace(m: string, d?: unknown): void {
  if (!enabled()) return;
  const now = new Date();
  queue.push({ t: `${now.toLocaleTimeString()}.${String(now.getMilliseconds()).padStart(3, '0')}`, m, d });
  if (document.visibilityState === 'hidden') flush();
  else if (timer === null) timer = window.setTimeout(flush, 800);
}

/** Tình trạng một thẻ video, gọn để ghi nhật ký */
export function vinfo(v: HTMLVideoElement | null | undefined) {
  if (!v) return null;
  return {
    rs: v.readyState,
    paused: v.paused,
    muted: v.muted,
    w: v.videoWidth,
    h: v.videoHeight,
    t: Math.round(v.currentTime),
    src: v.srcObject ? 'stream' : (v.currentSrc || v.src || '').slice(0, 40),
    conn: v.isConnected,
    disp: v.isConnected ? getComputedStyle(v).display : '-',
    dpip: v.disablePictureInPicture,
  };
}

let installed = false;

/** Theo dõi mọi thứ liên quan tới cửa sổ nổi trên cả trang */
export function installPipTrace(): void {
  if (installed || !enabled()) return;
  installed = true;

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  trace('mở trang', {
    path: location.pathname,
    standalone,
    ref: document.referrer.slice(0, 60),
    pipEnabled: document.pictureInPictureEnabled,
    docPip: 'documentPictureInPicture' in window,
    ua: navigator.userAgent.slice(0, 140),
  });

  document.addEventListener(
    'enterpictureinpicture',
    (e) => trace('VÀO cửa sổ nổi', vinfo(e.target as HTMLVideoElement)),
    true
  );
  document.addEventListener(
    'leavepictureinpicture',
    (e) => trace('RA khỏi cửa sổ nổi', vinfo(e.target as HTMLVideoElement)),
    true
  );
  document.addEventListener('visibilitychange', () => {
    const v = (document.pictureInPictureElement as HTMLVideoElement | null) ?? document.querySelector('video');
    trace(`trang ${document.visibilityState}`, {
      inPip: !!document.pictureInPictureElement,
      fs: !!document.fullscreenElement,
      v: vinfo(v),
    });
  });
  document.addEventListener(
    'pause',
    (e) => {
      if (e.target instanceof HTMLVideoElement)
        trace('video dừng', { hidden: document.hidden, inPip: !!document.pictureInPictureElement });
    },
    true
  );
  document.addEventListener('fullscreenchange', () =>
    trace('toàn màn hình', { on: !!document.fullscreenElement, el: document.fullscreenElement?.tagName })
  );
  window.addEventListener('pagehide', () => trace('pagehide'));
}
