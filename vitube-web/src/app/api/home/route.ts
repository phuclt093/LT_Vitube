import { NextRequest, NextResponse } from 'next/server';
import { getYT } from '@/lib/innertube';
import { firstOk, homeAttempts } from '@/lib/feeds';
import { buildHome } from '@/lib/recommend';
import { profileFor } from '@/lib/profile-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/home — trang chủ trộn theo những gì người dùng theo dõi.
 *
 * Phải là POST vì tín hiệu cá nhân hoá nằm ở phía máy người dùng: kênh đăng ký và
 * lịch sử xem đều lưu trong `localStorage`, server không tự biết được. Nhét cả
 * danh sách kênh vào query string thì vừa dài vừa lọt vào log.
 *
 * Body: `{ channelIds: string[], seedTitles: string[], watchedIds: string[] }`
 *
 * Chưa theo dõi gì thì trả về đúng feed chung — trang chủ của người mới không
 * nên trống trơn, và cũng không nên bắt họ đăng ký kênh mới có gì xem.
 */
/**
 * GET /api/home — cho app TV / điện thoại đã đăng nhập: không cần gửi gì, server tự
 * đọc lịch sử trong tài khoản. Chưa đăng nhập thì ra feed chung.
 */
export async function GET(req: NextRequest) {
  return handle({});
}

/**
 * POST /api/home
 * Body (tất cả tuỳ chọn):
 *   { history: [{id,title,author:{id,name},savedAt,ratio}], liked: [...], later: [...], subs: [channelId] }
 * Kiểu cũ { channelIds, seedTitles, watchedIds } vẫn nhận.
 */
export async function POST(req: NextRequest) {
  return handle(await req.json().catch(() => ({})));
}

async function handle(body: any) {
  try {
    const { profile, account } = await profileFor(body);

    const yt = await getYT();

    /*
      Lấy feed chung trước, dùng cho hai việc: làm nguồn "khám phá" trong bộ trộn,
      và làm phương án dự phòng nếu chưa có tín hiệu cá nhân hoá nào.
    */
    /*
      Dùng chung chuỗi dự phòng với /api/feed thay vì gọi trần `getHomeFeed()`.

      Chỗ này trước đây là `try { getHomeFeed() } catch { general = [] }`: YouTube đổi
      cấu trúc feed chủ là trang chủ đen thui, không một dòng thông báo — vì lỗi bị
      nuốt, `videos` rỗng, mà rỗng thì phía giao diện chẳng có nhánh nào để vẽ. Giờ
      hỏng thì còn FEwhat_to_watch, FEtrending, rồi tìm kiếm để bấu víu.
    */
    const { videos: general, via, errors } = await firstOk(homeAttempts(yt));

    if (!general.length) {
      console.error('[api/home] không nguồn nào ra video —', errors.join(' | '));
    } else if (via !== 'getHomeFeed') {
      console.warn(`[api/home] getHomeFeed hỏng, đang dùng ${via} — ${errors.join(' | ')}`);
    }

    const { videos, mix } = await buildHome(yt, general, profile);

    if (!videos.length) {
      return NextResponse.json({
        videos: general,
        mix: [],
        personalized: false,
        via,
        // Rỗng thì PHẢI nói vì sao, nếu không giao diện chỉ còn cách hiện màn hình trắng
        error: general.length ? undefined : `Không nguồn nào trả về video. ${errors.join(' | ')}`,
      });
    }

    return NextResponse.json({
      videos,
      mix,
      personalized: true,
      // true = hồ sơ lấy từ tài khoản (dùng chung mọi nền tảng), false = chỉ từ máy này
      account,
      topics: profile.topics.map((t) => t.phrase),
      via,
    });
  } catch (e: any) {
    console.error('[api/home] hỏng:', e);
    return NextResponse.json({ error: e?.message ?? 'lỗi trang chủ', videos: [] }, { status: 500 });
  }
}
