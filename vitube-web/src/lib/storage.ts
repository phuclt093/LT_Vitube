'use client';

import type { VideoItem } from './types';
import { remoteClear, remotePull, remotePushAll, remoteRemove, remoteUpsert } from './sync';
export { setSignedIn } from './sync';

export type StoredVideo = VideoItem & {
  savedAt: number;
  /**
   * Đã xem được bao nhiêu phần video, 0–1 — tín hiệu quan trọng nhất cho bộ đề xuất.
   * Mở 5 giây rồi thoát (≈0) khác hẳn xem hết (≈1); trước đây cả hai đều chỉ là
   * "có trong lịch sử" nên bấm nhầm một video cũng kéo lệch cả trang chủ.
   */
  ratio?: number;
};

/*
  Không còn `playlists` ở đây.

  Danh sách phát đã chuyển sang `playlists.ts` với khoá `vitube.playlistsV2` và có
  cấu trúc riêng (tên, thứ tự, mảng video). Cái `vitube.playlists` cũ là bản V1,
  không chỗ nào đọc nữa — nhưng `pushAllToServer()` vẫn đẩy nó lên server dưới
  đúng tên danh sách `playlists`, tức là **đè lên chính playlists thật** ngay lần
  đăng nhập đầu của ai còn sót dữ liệu V1.
*/
const KEYS = {
  history: 'vitube.history',
  later: 'vitube.later',
  liked: 'vitube.liked',
} as const;

export type StoreKey = keyof typeof KEYS;

/**
 * Chưa đăng nhập  -> localStorage.
 * Đã đăng nhập    -> localStorage đóng vai cache, đồng thời ghi lên server.
 * Nhờ vậy giao diện phản hồi tức thì, không phải chờ mạng.
 *
 * Cách gọi API nằm ở `sync.ts` — dùng chung với kênh đăng ký và danh sách phát.
 */

function read(key: StoreKey): StoredVideo[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEYS[key]) || '[]');
  } catch {
    return [];
  }
}

function write(key: StoreKey, list: StoredVideo[]) {
  localStorage.setItem(KEYS[key], JSON.stringify(list.slice(0, 500)));
  window.dispatchEvent(new CustomEvent('vitube-store', { detail: key }));
}

export function getList(key: StoreKey): StoredVideo[] {
  return read(key);
}

export function has(key: StoreKey, id: string): boolean {
  return read(key).some((v) => v.id === id);
}

export function add(key: StoreKey, v: VideoItem) {
  const list = read(key).filter((x) => x.id !== v.id);
  list.unshift({ ...v, savedAt: Date.now() });
  write(key, list);

  remoteUpsert(key, v);
}

/** Ngưỡng đáng đồng bộ — giữa các ngưỡng thì chỉ cập nhật trong máy */
const RATIO_STEPS = [0.1, 0.5, 0.9];
const step = (r: number) => RATIO_STEPS.filter((s) => r >= s).length;

/**
 * Ghi nhận đã xem tới đâu vào mục lịch sử của video (không đổi thứ tự lịch sử).
 *
 * Được gọi mỗi 5 giây khi đang xem, nên chỉ đẩy lên server khi vượt một ngưỡng
 * (10% / 50% / 90%) — đủ để bộ đề xuất phân biệt "bấm nhầm", "xem dở", "xem hết"
 * mà không bắn hàng trăm yêu cầu cho mỗi video.
 */
export function noteWatch(id: string, ratio: number) {
  if (!id || !Number.isFinite(ratio)) return;
  const r = Math.max(0, Math.min(1, ratio));
  const list = read('history');
  const i = list.findIndex((v) => v.id === id);
  if (i < 0) return;

  const old = list[i].ratio ?? 0;
  if (r <= old) return;

  list[i] = { ...list[i], ratio: r };
  write('history', list);
  if (step(r) > step(old)) remoteUpsert('history', list[i]);
}

export function remove(key: StoreKey, id: string) {
  write(key, read(key).filter((v) => v.id !== id));
  remoteRemove(key, id);
}

export function toggle(key: StoreKey, v: VideoItem): boolean {
  if (has(key, v.id)) {
    remove(key, v.id);
    return false;
  }
  add(key, v);
  return true;
}

export function clear(key: StoreKey) {
  write(key, []);
  remoteClear(key);
}

/** Kéo dữ liệu từ server về sau khi đăng nhập, ghi đè cache cục bộ */
export async function pullFromServer(key: StoreKey): Promise<StoredVideo[]> {
  const items = (await remotePull(key)) as StoredVideo[];
  if (!items.length) return read(key);
  localStorage.setItem(KEYS[key], JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('vitube-store', { detail: key }));
  return items;
}

/** Đẩy dữ liệu đang có ở máy lên server — gọi ngay sau khi đăng nhập lần đầu */
export async function pushAllToServer() {
  for (const key of Object.keys(KEYS) as StoreKey[]) {
    await remotePushAll(key, read(key));
  }
}
