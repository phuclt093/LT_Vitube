'use client';

/**
 * Cửa sổ nổi (Picture-in-Picture) cho mọi nền tảng.
 *
 * Mỗi nhà một kiểu:
 *   - Chrome (máy tính, Android), Edge, Electron:  API chuẩn `video.requestPictureInPicture()`
 *   - Safari trên iPhone:  KHÔNG có API chuẩn. Phải dùng cơ chế riêng của Apple
 *                          `video.webkitSetPresentationMode('picture-in-picture')`.
 *
 * Trước đây trình phát chỉ gọi API chuẩn, nên trên iPhone nút cửa sổ nổi bấm vào không
 * có tác dụng gì. Mọi chỗ trong app muốn bật/tắt/kiểm tra cửa sổ nổi đi qua đây.
 */

import { trace, vinfo } from './trace';

type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;
  webkitPresentationMode?: string;
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
  autoPictureInPicture?: boolean;
};

const standard = (v: HTMLVideoElement) =>
  typeof v.requestPictureInPicture === 'function' && !!document.pictureInPictureEnabled;

const webkit = (v: HTMLVideoElement) =>
  typeof (v as WebkitVideo).webkitSetPresentationMode === 'function' &&
  !!(v as WebkitVideo).webkitSupportsPresentationMode?.('picture-in-picture');

/** Máy này bật được cửa sổ nổi cho thẻ video này không */
export function pipSupported(v: HTMLVideoElement | null): boolean {
  return !!v && (standard(v) || webkit(v));
}

/** Video này đang ở cửa sổ nổi */
export function inPip(v: HTMLVideoElement | null): boolean {
  if (!v) return false;
  if (document.pictureInPictureElement === v) return true;
  return (v as WebkitVideo).webkitPresentationMode === 'picture-in-picture';
}

/** Có video nào (bất kể thẻ nào) đang ở cửa sổ nổi */
export function anyInPip(): HTMLVideoElement | null {
  const std = document.pictureInPictureElement as HTMLVideoElement | null;
  if (std) return std;
  const vids = Array.from(document.querySelectorAll('video')) as WebkitVideo[];
  return vids.find((x) => x.webkitPresentationMode === 'picture-in-picture') ?? null;
}

/** Lý do lần gần nhất không bật được cửa sổ nổi — trang /debug/pip đọc để hiện ra */
export const PIP_ERR_KEY = 'vitube.pipLastError';

function remember(reason: string) {
  trace('cửa sổ nổi THẤT BẠI', reason);
  try {
    sessionStorage.setItem(PIP_ERR_KEY, `${new Date().toLocaleTimeString()} — ${reason}`);
  } catch {
    /* không có bộ nhớ phiên */
  }
}

/** Vì sao máy này không có cửa sổ nổi (null = có) */
export function pipBlocker(v: HTMLVideoElement | null): string | null {
  if (!v) return 'chưa có trình phát';
  if (v.disablePictureInPicture) return 'video bị đặt disablePictureInPicture';
  if (typeof v.requestPictureInPicture === 'function') {
    if (!document.pictureInPictureEnabled)
      return 'trình duyệt đang tắt cửa sổ nổi (document.pictureInPictureEnabled = false) — kiểm tra quyền "Hình trong hình" của Chrome/app';
    return null;
  }
  if (webkit(v)) return null;
  return 'trình duyệt này không có API cửa sổ nổi';
}

/**
 * Bật cửa sổ nổi. Trả về `null` nếu thành công, hoặc câu giải thích vì sao không được
 * (để hiện cho người dùng thay vì im lặng như trước).
 */
export async function tryEnterPip(v: HTMLVideoElement): Promise<string | null> {
  const blocked = pipBlocker(v);
  if (blocked) {
    remember(blocked);
    return blocked;
  }
  try {
    if (standard(v)) {
      if (v.readyState < 1) {
        remember('video chưa tải xong (readyState 0)');
        return 'video chưa tải xong, thử lại sau vài giây';
      }
      trace('gọi requestPictureInPicture', vinfo(v));
      await v.requestPictureInPicture();
      trace('requestPictureInPicture OK');
      return null;
    }
    (v as WebkitVideo).webkitSetPresentationMode!('picture-in-picture');
    return null;
  } catch (e) {
    const err = e as DOMException;
    const reason =
      err?.name === 'NotAllowedError'
        ? `máy không cho mở (${err.message || 'NotAllowedError'}) — thường do quyền "Hình trong hình" bị tắt, hoặc bấm quá lâu sau thao tác chạm`
        : err?.name === 'NotSupportedError'
          ? `không hỗ trợ (${err.message || 'NotSupportedError'})`
          : `${err?.name ?? 'Lỗi'}: ${err?.message ?? String(e)}`;
    remember(reason);
    return reason;
  }
}

export async function enterPip(v: HTMLVideoElement): Promise<boolean> {
  return (await tryEnterPip(v)) === null;
}

export async function exitPip(): Promise<void> {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }
    const v = anyInPip() as WebkitVideo | null;
    v?.webkitSetPresentationMode?.('inline');
  } catch {
    /* đã thoát sẵn */
  }
}

/**
 * Cho video tự bay ra cửa sổ nổi khi người dùng rời app (vuốt về màn hình chính).
 *
 *  - iPhone:  thuộc tính `autoPictureInPicture` của WebKit.
 *  - Chrome:  hành động Media Session "enterpictureinpicture" — trình duyệt tự gọi
 *             khi người xem chuyển đi chỗ khác trong lúc video đang phát.
 *
 * Trình duyệt nào không hỗ trợ thì lặng lẽ bỏ qua; nút cửa sổ nổi vẫn dùng được.
 */
export function enableAutoPip(v: HTMLVideoElement): () => void {
  const wv = v as WebkitVideo;
  try {
    wv.autoPictureInPicture = true;
    v.setAttribute('autopictureinpicture', '');
  } catch {
    /* không hỗ trợ */
  }

  const ms = navigator.mediaSession;
  let registered = false;
  if (ms) {
    try {
      ms.setActionHandler('enterpictureinpicture' as MediaSessionAction, () => {
        if (!v.paused && !inPip(v)) void enterPip(v);
      });
      registered = true;
    } catch {
      /* trình duyệt chưa biết hành động này */
    }
  }

  return () => {
    if (registered) {
      try {
        ms.setActionHandler('enterpictureinpicture' as MediaSessionAction, null);
      } catch {
        /* bỏ qua */
      }
    }
  };
}

/**
 * Toàn màn hình. iPhone không cho phần tử thường (div) vào toàn màn hình — chỉ thẻ video
 * mới được, qua `webkitEnterFullscreen()`, và lúc đó dùng trình phát gốc của iOS (có sẵn
 * nút cửa sổ nổi, vuốt về là tự nổi). Máy khác thì cho cả khung trình phát vào toàn
 * màn hình để giữ thanh điều khiển của vitube.
 */
export function enterFullscreen(wrap: HTMLElement | null, v: HTMLVideoElement | null): void {
  if (wrap && typeof wrap.requestFullscreen === 'function' && document.fullscreenEnabled) {
    wrap.requestFullscreen().catch(() => {
      (v as WebkitVideo | null)?.webkitEnterFullscreen?.();
    });
    return;
  }
  (v as WebkitVideo | null)?.webkitEnterFullscreen?.();
}
