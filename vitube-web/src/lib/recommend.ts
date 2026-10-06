import { collectVideos, videosFrom } from './innertube';
import { firstOk, homeAttempts } from './feeds';
import type { VideoItem } from './types';
import { rank, topChannels, type Candidate, type Profile } from './profile';

/**
 * Bộ trộn gợi ý.
 *
 * Vấn đề của cách cũ: chỉ tìm theo tiêu đề video đang xem, nên kết quả dồn hết về
 * cùng một kênh — xem một video của ai thì cả cột phải toàn người đó.
 *
 * Cách làm ở đây là trộn nhiều nguồn có bản chất khác nhau rồi xen kẽ theo trọng số,
 * đồng thời chặn trần số video mỗi kênh. Nhờ vậy vừa giữ được cái liên quan sát,
 * vừa mở ra chủ đề và xu hướng mới.
 */

export type Bucket = { source: string; weight: number; items: VideoItem[] };


/* ---------------- cache nhỏ dùng chung ---------------- */

type Entry = { at: number; items: VideoItem[] };
const cache = new Map<string, Entry>();

async function cached(key: string, ttlMs: number, run: () => Promise<VideoItem[]>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.items;

  const items = await run();
  cache.set(key, { at: Date.now(), items });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return items;
}

/* ---------------- tách từ khoá ---------------- */

/** Từ quá phổ biến, giữ lại chỉ làm nhiễu truy vấn */
const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'official',
  'video', 'full', 'hd', 'mv', 'new', 'best', 'top', 'how', 'what', 'why',
  'và', 'của', 'cho', 'với', 'những', 'một', 'các', 'là', 'có', 'không', 'người',
  'chính', 'thức', 'mới', 'nhất', 'hay', 'phần', 'tập', 'series', 'nhé', 'rồi',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[|\-–—_()[\]{}#"'’.,!?:;/\\]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** Chọn ngẫu nhiên vài phần tử, để mỗi lần mở lại không ra y hệt nhau */
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

/* ---------------- gom từng nguồn ---------------- */

async function searchBucket(
  yt: any,
  query: string,
  source: string,
  weight: number
): Promise<Bucket> {
  const items = await cached(`s:${query}`, 10 * 60_000, async () => {
    const res = await yt.search(query, { type: 'video' });
    return videosFrom(res, 20);
  });
  return { source, weight, items };
}

async function trendingBucket(yt: any): Promise<Bucket> {
  const items = await cached('trending', 30 * 60_000, async () => {
    /*
      `/browse` có lúc trả về thứ youtubei.js không bóc ra được video nào — đo ngày
      01/09/2026: FEtrending, FEwhat_to_watch và getHomeFeed cùng rỗng trong khi
      search vẫn chạy. Không có nhánh lui thì rổ này rỗng theo và cột gợi ý mất
      hẳn một nguồn mà chẳng ai hay.
    */
    try {
      const res = await yt.actions.execute('/browse', { browseId: 'FEtrending', parse: true });
      const items = collectVideos(res, 30);
      if (items.length) return items;
    } catch {
      /* rơi xuống tìm kiếm */
    }

    try {
      return videosFrom(await yt.search('thịnh hành', { type: 'video' }), 30);
    } catch {
      return [];
    }
  });
  return { source: 'xu hướng', weight: 1, items };
}

/**
 * Video mới nhất của một kênh.
 *
 * Cache 15 phút vì trang chủ gọi cùng lúc cả chục kênh, và người ta mở lại trang
 * chủ liên tục — không cache thì mỗi lần vào là ngần ấy lượt gọi YouTube.
 */
async function channelBucketItems(yt: any, id: string): Promise<VideoItem[]> {
  return cached(`ch:${id}`, 15 * 60_000, async () => {
    try {
      const ch: any = await yt.getChannel(id);
      const tab = await ch.getVideos();
      return videosFrom(tab, 8);
    } catch {
      // Kênh bị xoá hay đổi id thì bỏ qua, đừng để một kênh hỏng chặn cả trang chủ
      return [];
    }
  });
}

/* ---------------- điểm vào ---------------- */

export type RelatedResult = {
  videos: VideoItem[];
  mix: { source: string; count: number }[];
};

/** Tiêu đề ngắn gọn cho nhãn "vì bạn đã xem …" */
const short = (t: string, n = 28) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

/**
 * Video YouTube tự gợi ý bên cạnh một video — nguồn "vì bạn đã xem X".
 * getInfo khá nặng nên nhớ 30 phút.
 */
async function watchNextOf(yt: any, id: string): Promise<VideoItem[]> {
  return cached(`wn:${id}`, 30 * 60_000, async () => {
    try {
      const info = await yt.getInfo(id);
      return collectVideos(info?.watch_next_feed ?? [], 20);
    } catch {
      return [];
    }
  });
}

function mixOf(picked: Candidate[]) {
  const m = new Map<string, number>();
  for (const c of picked) m.set(c.source, (m.get(c.source) ?? 0) + 1);
  return [...m.entries()].map(([source, count]) => ({ source, count }));
}

/**
 * Cột đề xuất bên cạnh trình phát.
 *
 * Ứng viên: gợi ý của chính YouTube cho video đang xem (ưu tiên cao nhất), chủ đề
 * của video đang xem, hai chủ đề hàng đầu trong hồ sơ người xem, và một ít xu hướng.
 * Rồi xếp hạng chung bằng `rank()` — kênh người xem hay xem được đẩy lên, kênh toàn
 * bấm vào rồi thoát bị đẩy xuống.
 */
export async function buildRelated(
  yt: any,
  info: any,
  id: string,
  opts: { profile?: Profile; limit?: number } = {}
): Promise<RelatedResult> {
  const limit = opts.limit ?? 24;
  const p = opts.profile;

  const cands: Candidate[] = collectVideos(info?.watch_next_feed ?? [], 30).map((v) => ({
    v,
    source: 'youtube',
    prior: 1.3,
  }));

  const keywords: string[] = info?.basic_info?.keywords ?? [];
  const title: string = info?.basic_info?.title ?? '';
  const topics = keywords.length ? sample(keywords, 3) : sample(tokenize(title), 2);
  const mine = (p?.topics ?? []).slice(0, 2).map((t) => t.phrase);

  const jobs: Promise<Bucket>[] = [
    ...topics.map((t) => searchBucket(yt, t, `chủ đề: ${t}`, 0)),
    ...mine.map((t) => searchBucket(yt, t, `bạn hay xem: ${t}`, 0)),
    trendingBucket(yt),
  ];
  for (const r of await Promise.allSettled(jobs)) {
    if (r.status !== 'fulfilled') continue;
    const b = r.value;
    const prior = b.source.startsWith('chủ đề') ? 0.9 : b.source.startsWith('bạn hay xem') ? 0.8 : 0.3;
    b.items.forEach((v) => cands.push({ v, source: b.source, prior }));
  }

  const profile: Profile = p ?? {
    channels: new Map(),
    channelNames: new Map(),
    topics: [],
    seeds: [],
    watched: new Set(),
    empty: true,
  };

  // cột bên cạnh: xem lại là chuyện thường, chỉ loại đúng video đang xem
  const picked = rank(cands, profile, { limit, exclude: new Set([id]), perChannel: 3, jitter: 0.05 });

  if (!picked.length) {
    const { videos: general } = await firstOk(homeAttempts(yt), limit + 1);
    const g = general.filter((v) => v.id !== id).slice(0, limit);
    return { videos: g, mix: g.length ? [{ source: 'khám phá', count: g.length }] : [] };
  }
  return { videos: picked.map((c) => c.v), mix: mixOf(picked) };
}

/**
 * Trang chủ theo người xem.
 *
 * Bốn nguồn ứng viên, mỗi nguồn một mức ưu tiên:
 *
 *   1.1  vì bạn đã xem X   gợi ý của YouTube cho vài video vừa xem kỹ / đã thích
 *   1.0  kênh bạn hay xem  video mới của kênh có độ yêu thích cao nhất (không chỉ
 *                          kênh đăng ký — kênh xem nhiều mà chưa bấm đăng ký cũng tính)
 *   0.9  chủ đề: …         tìm theo các cụm chủ đề hàng đầu trong hồ sơ
 *   0.35 khám phá          feed chung, để không đóng khung trong cái đã biết
 *
 * Rồi `rank()` chấm điểm và chọn có đa dạng. Video đã xem bị loại khỏi trang chủ.
 * Hồ sơ rỗng (người mới) thì trả rỗng, nơi gọi dùng feed chung.
 */
export async function buildHome(
  yt: any,
  fallback: VideoItem[],
  p: Profile,
  limit = 40
): Promise<RelatedResult> {
  if (p.empty) return { videos: [], mix: [] };

  const cands: Candidate[] = [];

  // kênh: 6 kênh yêu thích nhất + 3 kênh lấy ngẫu nhiên trong phần còn lại (để kênh
  // đăng ký lâu không xem vẫn có cơ hội xuất hiện)
  const ranked = topChannels(p, 30);
  const chIds = [...ranked.slice(0, 6), ...sample(ranked.slice(6), 3)];

  const topics = p.topics.slice(0, 4).map((t) => t.phrase);

  const [chRes, topicRes, seedRes] = await Promise.all([
    Promise.allSettled(chIds.map((id) => channelBucketItems(yt, id))),
    Promise.allSettled(topics.map((t) => searchBucket(yt, t, `chủ đề: ${t}`, 0))),
    Promise.allSettled(p.seeds.map((s) => watchNextOf(yt, s.id))),
  ]);

  chRes.forEach((r) => {
    if (r.status === 'fulfilled') r.value.forEach((v) => cands.push({ v, source: 'kênh bạn hay xem', prior: 1.0 }));
  });
  topicRes.forEach((r) => {
    if (r.status === 'fulfilled') r.value.items.forEach((v) => cands.push({ v, source: r.value.source, prior: 0.9 }));
  });
  seedRes.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const label = `vì bạn đã xem: ${short(p.seeds[i].title)}`;
    r.value.forEach((v) => cands.push({ v, source: label, prior: 1.1 }));
  });

  // chưa nguồn cá nhân nào ra gì → để nơi gọi trả feed chung, đừng dán nhãn "cá nhân hoá"
  if (!cands.length) return { videos: [], mix: [] };

  fallback.forEach((v) => cands.push({ v, source: 'khám phá', prior: 0.35 }));

  const picked = rank(cands, p, { limit, exclude: p.watched });
  return { videos: picked.map((c) => c.v), mix: mixOf(picked) };
}
