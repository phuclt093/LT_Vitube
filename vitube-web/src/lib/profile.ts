import { libraryList } from './db';
import { phrasesOf, rankPhrases, type Scored } from './phrases';
import type { VideoItem } from './types';

/**
 * Hồ sơ sở thích của một người xem — đầu vào của bộ đề xuất.
 *
 * ── Tín hiệu ──────────────────────────────────────────────────────────────
 *   lịch sử xem   trọng số theo mức xem thật: bấm nhầm (<10%) gần như bằng 0,
 *                 xem dở ~0.6, xem quá nửa 1.0, xem gần hết 1.2
 *   đã thích      2.0 — tín hiệu rõ nhất
 *   xem sau       0.8 — có ý định, chưa chắc thích
 *   kênh đăng ký  cộng thẳng vào độ yêu thích của kênh
 *
 *   Mọi tín hiệu phai dần theo thời gian: nửa đời 21 ngày. Xem một buổi toàn video
 *   nấu ăn không còn kéo lệch trang chủ cả tháng, nhưng thói quen lâu dài vẫn giữ.
 *
 * ── Hồ sơ rút ra ───────────────────────────────────────────────────────────
 *   channels   độ yêu thích từng kênh (có cả số âm: kênh toàn bấm vào rồi thoát)
 *   topics     các cụm chủ đề xếp hạng (xem lib/phrases.ts)
 *   seeds      vài video vừa xem kỹ — để lấy "vì bạn đã xem X"
 *   watched    video đã xem, loại khỏi trang chủ
 *
 * Phim Bilibili bị loại khỏi hồ sơ này: tiêu đề của chúng ("E24 - The Awakening…")
 * đem đi tìm trên YouTube chỉ ra rác.
 */

export type Signal = {
  id: string;
  title: string;
  channelId?: string;
  channelName?: string;
  /** mốc thời gian (ms) — lúc xem / lúc thích / lúc lưu */
  at: number;
  /** 0–1, chỉ lịch sử có */
  ratio?: number;
};

export type Signals = {
  history: Signal[];
  liked: Signal[];
  later: Signal[];
  subs: string[];
};

export type Profile = {
  channels: Map<string, number>;
  /** tên hiển thị của kênh, để ghi nhãn "vì bạn hay xem <kênh>" */
  channelNames: Map<string, string>;
  topics: Scored[];
  seeds: Signal[];
  watched: Set<string>;
  /** có đủ dữ liệu để cá nhân hoá không */
  empty: boolean;
};

const HALF_LIFE_DAYS = 21;
const DAY = 86_400_000;

const decay = (at: number, now: number) =>
  Math.pow(0.5, Math.max(0, now - (at || now)) / DAY / HALF_LIFE_DAYS);

function historyWeight(ratio?: number): number {
  if (ratio === undefined) return 0.6; // app cũ / TV chưa gửi tỉ lệ xem → coi như xem dở
  if (ratio < 0.1) return 0.05;
  if (ratio < 0.5) return 0.6;
  if (ratio < 0.9) return 1.0;
  return 1.2;
}

export const channelKey = (id?: string, name?: string) => id || (name ? `name:${name}` : '');

const isYouTube = (id: string) => !!id && !id.startsWith('bili_') && !id.startsWith('xl_');

/* ------------------------------------------------------------------ */
/* Lấy tín hiệu                                                          */
/* ------------------------------------------------------------------ */

function fromStored(v: any): Signal | null {
  if (!v?.id || !v?.title) return null;
  return {
    id: String(v.id),
    title: String(v.title),
    channelId: v.author?.id || v.channelId || undefined,
    channelName: v.author?.name || v.channelName || undefined,
    at: Number(v.savedAt ?? v.at ?? v.addedAt ?? 0) || 0,
    ratio: typeof v.ratio === 'number' ? v.ratio : undefined,
  };
}

const clean = (arr: any, max: number): Signal[] =>
  (Array.isArray(arr) ? arr : []).slice(0, max).map(fromStored).filter(Boolean) as Signal[];

/**
 * Tín hiệu từ máy gửi lên (người chưa đăng nhập, hoặc dữ liệu chưa kịp đồng bộ).
 * Nhận cả kiểu cũ `{ channelIds, seedTitles, watchedIds }` để app TV/điện thoại
 * bản cũ vẫn chạy.
 */
export function signalsFromBody(body: any): Signals {
  const history = clean(body?.history, 300);
  if (!history.length && Array.isArray(body?.seedTitles)) {
    const ids: string[] = Array.isArray(body?.watchedIds) ? body.watchedIds : [];
    body.seedTitles.slice(0, 30).forEach((t: string, i: number) =>
      history.push({ id: ids[i] || `seed:${i}`, title: String(t), at: Date.now() - i * 3600_000 })
    );
    ids.slice(body.seedTitles.length).forEach((id) => history.push({ id, title: '', at: 0 }));
  }
  const subs = Array.isArray(body?.subs) ? body.subs : Array.isArray(body?.channelIds) ? body.channelIds : [];
  return {
    history,
    liked: clean(body?.liked, 200),
    later: clean(body?.later, 100),
    subs: subs.filter((x: any) => typeof x === 'string').slice(0, 200),
  };
}

/**
 * Tín hiệu lưu trên server cho người đã đăng nhập.
 *
 * Đây là thứ làm cho mọi nền tảng dùng chung một bộ đề xuất: app TV hay điện thoại
 * chỉ cần gọi /api/home kèm cookie đăng nhập là được trang chủ theo đúng lịch sử
 * xem ở MỌI máy — không phải tự gom rồi gửi gì lên.
 */
export async function signalsFromAccount(userId: number): Promise<Signals> {
  const [history, liked, later, subs] = await Promise.all([
    libraryList(userId, 'history'),
    libraryList(userId, 'liked'),
    libraryList(userId, 'later'),
    libraryList(userId, 'subs'),
  ]);
  return {
    history: clean(history, 300),
    liked: clean(liked, 200),
    later: clean(later, 100),
    subs: (subs as any[]).map((s) => s?.id).filter(Boolean),
  };
}

/** Gộp hai nguồn, bỏ trùng theo id; mục nào có tỉ lệ xem cao hơn / mới hơn thì giữ */
export function mergeSignals(a: Signals, b: Signals): Signals {
  const merge = (x: Signal[], y: Signal[]) => {
    const m = new Map<string, Signal>();
    for (const s of [...x, ...y]) {
      const cur = m.get(s.id);
      if (!cur) m.set(s.id, s);
      else
        m.set(s.id, {
          ...cur,
          ...s,
          at: Math.max(cur.at, s.at),
          ratio: Math.max(cur.ratio ?? -1, s.ratio ?? -1) >= 0 ? Math.max(cur.ratio ?? 0, s.ratio ?? 0) : undefined,
          title: cur.title || s.title,
        });
    }
    return [...m.values()].sort((p, q) => q.at - p.at);
  };
  return {
    history: merge(a.history, b.history),
    liked: merge(a.liked, b.liked),
    later: merge(a.later, b.later),
    subs: [...new Set([...a.subs, ...b.subs])],
  };
}

/* ------------------------------------------------------------------ */
/* Dựng hồ sơ                                                            */
/* ------------------------------------------------------------------ */

export function buildProfile(sig: Signals, now = Date.now()): Profile {
  const channels = new Map<string, number>();
  const channelNames = new Map<string, string>();
  const docs: { title: string; weight: number; channel?: string; id?: string }[] = [];

  const add = (s: Signal, base: number) => {
    if (!isYouTube(s.id)) return;
    const w = base * decay(s.at, now);
    const ck = channelKey(s.channelId, s.channelName);
    if (ck) {
      // bấm vào rồi thoát ngay là tín hiệu âm nhẹ cho kênh
      const delta = base <= 0.05 ? -0.3 * decay(s.at, now) : w;
      channels.set(ck, (channels.get(ck) ?? 0) + delta);
      if (s.channelName) channelNames.set(ck, s.channelName);
    }
    if (s.title) docs.push({ title: s.title, weight: w, channel: ck, id: s.id });
  };

  sig.history.forEach((s) => add(s, historyWeight(s.ratio)));
  sig.liked.forEach((s) => add(s, 2.0));
  sig.later.forEach((s) => add(s, 0.8));
  for (const id of sig.subs) channels.set(id, (channels.get(id) ?? 0) + 1.5);

  // Bỏ chủ đề quá yếu: hai lần bấm nhầm cũng đủ "lặp lại ở 2 video", nhưng điểm của
  // chúng gần bằng 0 — không được phép thành một mục trên trang chủ.
  const rawTopics = rankPhrases(docs, 5);
  const topScore = rawTopics[0]?.score ?? 0;
  const topics = rawTopics.filter((t) => t.score >= Math.max(0.5, topScore * 0.15));

  /*
    "Vì bạn đã xem X": video xem kỹ gần đây hoặc đã thích, và phải KHÁC CHỦ ĐỀ nhau.
    Không lọc thì ba video giá vàng liền nhau chiếm cả ba suất — ba lần gợi ý cùng
    một thứ, còn video bóng đá vừa bấm thích thì bị bỏ quên.
    Video đã thích được xét trước.
  */
  const likedIds = new Set(sig.liked.map((s) => s.id));
  const pool = [...sig.liked, ...sig.history]
    .filter((s) => isYouTube(s.id) && s.title && now - s.at < 10 * DAY)
    .filter((s) => likedIds.has(s.id) || (s.ratio ?? 0) >= 0.5);
  const topicSet = new Set(topics.map((t) => t.phrase));
  const seeds: Signal[] = [];
  const usedTopics = new Set<string>();
  const usedIds = new Set<string>();
  for (const s of pool) {
    if (usedIds.has(s.id)) continue;
    const mine = phrasesOf(s.title).filter((ph) => topicSet.has(ph));
    if (mine.some((ph) => usedTopics.has(ph))) continue;
    mine.forEach((ph) => usedTopics.add(ph));
    usedIds.add(s.id);
    seeds.push(s);
    if (seeds.length >= 3) break;
  }

  return {
    channels,
    channelNames,
    topics,
    seeds,
    watched: new Set(sig.history.map((s) => s.id)),
    empty: docs.length === 0 && sig.subs.length === 0,
  };
}

/** Các kênh nên lấy video mới: thích nhiều nhất trước, rồi lấy mẫu thêm trong kênh đăng ký */
export function topChannels(p: Profile, n: number): string[] {
  return [...p.channels.entries()]
    .filter(([k, v]) => v > 0.3 && !k.startsWith('name:')) // cần id kênh thật để tải video
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/* ------------------------------------------------------------------ */
/* Chấm điểm và xếp hạng                                                */
/* ------------------------------------------------------------------ */

export type Candidate = { v: VideoItem; source: string; prior: number };

/** "3 ngày trước" → độ mới 0–1. Không đọc được thì trung tính. */
function freshness(published: string): number {
  const t = published.toLowerCase();
  if (!t) return 0.5;
  if (/giây|phút|giờ|second|minute|hour|trực tiếp|live|đang/.test(t)) return 1;
  if (/ngày|day/.test(t)) return 0.9;
  if (/tuần|week/.test(t)) return 0.7;
  if (/tháng|month/.test(t)) return 0.4;
  if (/năm|year/.test(t)) return 0.1;
  return 0.5;
}

/**
 * Xếp hạng ứng viên.
 *
 *   điểm = ưu tiên của nguồn
 *        + 0.8 × độ yêu thích kênh (chuẩn hoá)
 *        + 0.6 × mức khớp chủ đề của tiêu đề
 *        + 0.25 × độ mới
 *        + nhiễu nhỏ 0–0.15 (mỗi lần mở trang chủ ra thứ tự hơi khác)
 *
 * Rồi chọn tham lam có phạt trùng lặp: đã có một video của kênh X thì video kế
 * của X bị trừ 0.45, quá `perChannel` thì loại. Nhờ vậy vừa đúng gu vừa đa dạng.
 */
export function rank(
  cands: Candidate[],
  p: Profile,
  opts: { limit: number; exclude: Set<string>; perChannel?: number; jitter?: number }
): Candidate[] {
  const perChannel = opts.perChannel ?? 2;
  const jitter = opts.jitter ?? 0.15;
  const maxAff = Math.max(1, ...p.channels.values());
  const topicMax = Math.max(1, ...p.topics.map((t) => t.score));

  // gộp trùng: cùng video đến từ nhiều nguồn thì giữ nguồn ưu tiên cao nhất và cộng thưởng
  const byId = new Map<string, Candidate & { hits: number }>();
  for (const c of cands) {
    if (!c.v?.id || opts.exclude.has(c.v.id)) continue;
    const cur = byId.get(c.v.id);
    if (!cur) byId.set(c.v.id, { ...c, hits: 1 });
    else {
      cur.hits++;
      if (c.prior > cur.prior) Object.assign(cur, { source: c.source, prior: c.prior });
    }
  }

  const scored = [...byId.values()].map((c) => {
    const ck = channelKey(c.v.author.id, c.v.author.name);
    const aff = (p.channels.get(ck) ?? p.channels.get(`name:${c.v.author.name}`) ?? 0) / maxAff;
    const phrases = new Set(phrasesOf(c.v.title));
    const topic = Math.min(
      1,
      p.topics.filter((t) => phrases.has(t.phrase)).reduce((s, t) => s + t.score / topicMax, 0)
    );
    const score =
      c.prior +
      0.8 * Math.max(-0.5, aff) +
      0.6 * topic +
      0.25 * freshness(c.v.publishedText) +
      0.1 * (c.hits - 1) + // nhiều nguồn cùng gợi ý → đáng tin hơn
      Math.random() * jitter;
    return { c, ck, score };
  });

  const out: Candidate[] = [];
  const used = new Map<string, number>();
  while (out.length < opts.limit && scored.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < scored.length; i++) {
      const s = scored[i];
      const n = used.get(s.ck || s.c.v.id) ?? 0;
      if (n >= perChannel) continue;
      const adj = s.score - 0.45 * n;
      if (adj > bestScore) {
        bestScore = adj;
        best = i;
      }
    }
    if (best < 0) break;
    const [s] = scored.splice(best, 1);
    used.set(s.ck || s.c.v.id, (used.get(s.ck || s.c.v.id) ?? 0) + 1);
    out.push(s.c);
  }
  return out;
}
