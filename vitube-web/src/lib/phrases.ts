/**
 * Rút "chủ đề" ra khỏi tiêu đề video — không phụ thuộc server hay trình duyệt.
 *
 * Bản cũ đếm từng TỪ ĐƠN rồi lấy từ xuất hiện nhiều nhất. Tiếng Việt là tiếng đơn
 * lập, một từ đơn gần như không mang nghĩa chủ đề: ra "ngày", "phải", "việt" — ảnh
 * chụp trang chủ từng hiện đúng "bạn hay xem: ngày". Ở đây:
 *
 *  1. Lấy CỤM 1–3 tiếng liền nhau ("giá vàng", "bóng đá", "tu tiên").
 *  2. Cụm không được bắt đầu / kết thúc bằng hư từ ("của", "và", "là"…), từ đơn
 *     phải nằm ngoài danh sách từ rỗng nghĩa.
 *  3. Cụm dài được thưởng: "giá vàng" nói nhiều hơn "vàng".
 *  4. Cụm chỉ xuất hiện ở MỘT kênh bị hạ điểm — thường là tên kênh / khẩu hiệu kênh,
 *     đã có phần "kênh bạn hay xem" lo rồi, không phải chủ đề.
 *  5. Cụm con bị cụm cha "nuốt": có "giá vàng hôm nay" đủ mạnh thì bỏ "giá vàng".
 */

/** Hư từ và từ quá chung — không được đứng đầu/cuối cụm, không được làm từ đơn */
const STOP = new Set([
  // tiếng Việt
  'và', 'của', 'cho', 'với', 'những', 'một', 'các', 'là', 'có', 'không', 'người', 'được',
  'này', 'kia', 'đó', 'khi', 'thì', 'mà', 'đã', 'sẽ', 'đang', 'cũng', 'như', 'rất', 'lại',
  'ra', 'vào', 'trên', 'dưới', 'tại', 'bị', 'làm', 'đến', 'tới', 'từ', 'về', 'sau', 'trước',
  'hôm', 'nay', 'ngày', 'năm', 'tháng', 'giờ', 'phút', 'giây', 'lần', 'cái', 'con', 'chiếc',
  'phải', 'nên', 'nếu', 'vì', 'để', 'hay', 'nhất', 'mới', 'cực', 'siêu', 'quá', 'thật',
  'nhé', 'rồi', 'ơi', 'à', 'ạ', 'luôn', 'ngay', 'nào', 'gì', 'sao', 'ai', 'đâu', 'bao',
  'chính', 'thức', 'phần', 'tập', 'full', 'bản', 'cả', 'mọi', 'nhiều', 'ít', 'hết',
  'xem', 'nghe', 'kênh', 'video', 'clip', 'phim', 'official', 'trực', 'tiếp', 'live',
  'livestream', 'shorts', 'short', 'tiktok', 'reaction', 'mv', 'hd', 'fhd', 'vietsub',
  'thuyết', 'minh', 'việt', 'nam', 'anh', 'em', 'chị', 'tôi', 'mình', 'bạn', 'họ',
  'qua', 'bằng', 'theo', 'trong', 'ngoài', 'giữa', 'cùng', 'chỉ', 'đều', 'vẫn', 'còn',
  'hơn', 'thêm', 'nữa', 'đoạn', 'số',
  // tiếng Anh
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are', 'was', 'our',
  'new', 'best', 'top', 'how', 'what', 'why', 'when', 'who', 'all', 'full', 'part', 'episode',
  'ep', 'vs', 'feat', 'ft', 'official', 'video', 'music', 'lyrics', 'lyric', 'audio',
]);

export function tokens(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    // bỏ mọi thứ không phải chữ/số: dấu câu, emoji, ký hiệu
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+$/.test(w) && w.length <= 20);
}

/** Mọi cụm 1–3 tiếng hợp lệ trong một tiêu đề (mỗi cụm một lần) */
export function phrasesOf(title: string): string[] {
  const ws = tokens(title);
  const out = new Set<string>();
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + n <= ws.length; i++) {
      const g = ws.slice(i, i + n);
      if (STOP.has(g[0]) || STOP.has(g[g.length - 1])) continue;
      if (n === 1 && g[0].length < 3) continue;
      out.add(g.join(' '));
    }
  }
  return [...out];
}

export type Scored = { phrase: string; score: number };

/**
 * Xếp hạng chủ đề từ một tập video có trọng số.
 *
 * `docs` là các video đã xem, mỗi cái có trọng số (xem hết nặng hơn bấm nhầm, mới
 * nặng hơn cũ — bên gọi tự tính) và kênh để biết cụm đó trải qua mấy kênh.
 */
export function rankPhrases(
  docs: { title: string; weight: number; channel?: string; id?: string }[],
  max = 6
): Scored[] {
  const score = new Map<string, number>();
  // số VIDEO khác nhau chứa cụm — một video vừa trong lịch sử vừa được thích không
  // được tính là "lặp lại ở 2 video"
  const vids = new Map<string, Set<string>>();
  const chans = new Map<string, Set<string>>();

  for (const d of docs) {
    if (d.weight <= 0 || !d.title) continue;
    for (const p of phrasesOf(d.title)) {
      score.set(p, (score.get(p) ?? 0) + d.weight);
      if (!vids.has(p)) vids.set(p, new Set());
      vids.get(p)!.add(d.id || d.title);
      if (!chans.has(p)) chans.set(p, new Set());
      chans.get(p)!.add(d.channel || '?');
    }
  }

  const ranked: (Scored & { single: boolean })[] = [];
  for (const [p, s] of score) {
    if ((vids.get(p)?.size ?? 0) < 2) continue; // phải lặp lại ở ít nhất 2 video
    const n = p.split(' ').length;
    const lengthBonus = n === 1 ? 1 : n === 2 ? 1.6 : 1.9;
    const spread = chans.get(p)!.size;
    const channelFactor = spread >= 2 ? 1 : 0.45; // chỉ một kênh → nhiều khả năng là tên kênh
    ranked.push({ phrase: p, score: s * lengthBonus * channelFactor, single: spread < 2 });
  }
  ranked.sort((a, b) => b.score - a.score);

  /*
    Chọn đa dạng:
    - cụm nào có chung từ với một cụm đã chọn (điểm cao hơn) thì bỏ — "tiếng anh qua"
      và "qua những đoạn" là một chủ đề cắt hai lát, tìm hai lần chỉ ra cùng một thứ;
    - tối đa MỘT cụm chỉ đến từ một kênh: loạt video cùng kênh đã có phần "kênh bạn
      hay xem" lo, để nó chiếm hết suất chủ đề thì trang chủ lại đóng khung một kênh.
  */
  const picked: Scored[] = [];
  const pickedWords: Set<string>[] = [];
  let singles = 0;
  for (const r of ranked) {
    const words = new Set(r.phrase.split(' '));
    if (pickedWords.some((pw) => [...words].some((w) => pw.has(w)))) continue;
    if (r.single && singles >= 1) continue;
    if (r.single) singles++;
    picked.push({ phrase: r.phrase, score: r.score });
    pickedWords.push(words);
    if (picked.length >= max) break;
  }
  return picked;
}
