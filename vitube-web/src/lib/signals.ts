'use client';

import * as store from './storage';
import { getSubs } from './subs';

/**
 * Gói tín hiệu sở thích trong máy để gửi cho /api/home và /api/related.
 *
 * Chưa đăng nhập thì đây là nguồn duy nhất server có. Đã đăng nhập thì server đọc
 * từ tài khoản là chính, phần này chỉ bù những gì vừa xem mà chưa kịp đồng bộ.
 * Chỉ gửi các trường bộ đề xuất cần — không gửi ảnh, mô tả…
 */
export function localSignals() {
  const slim = (v: store.StoredVideo) => ({
    id: v.id,
    title: v.title,
    author: { id: v.author?.id ?? '', name: v.author?.name ?? '' },
    savedAt: v.savedAt,
    ratio: v.ratio,
  });
  return {
    history: store.getList('history').slice(0, 300).map(slim),
    liked: store.getList('liked').slice(0, 200).map(slim),
    later: store.getList('later').slice(0, 100).map(slim),
    subs: getSubs().map((c) => c.id),
  };
}
