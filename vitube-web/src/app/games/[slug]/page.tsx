import GameView from './GameView';

/*
  Danh sách trò chơi cố định, nên dựng sẵn từng trang lúc build — bắt buộc cho bản
  tĩnh (GitHub Pages), và bản có server cũng nhanh hơn.

  Không lấy từ `@/lib/games` được vì file đó là 'use client' — server component
  import vào chỉ nhận về một tham chiếu, không phải mảng. Thêm trò mới thì thêm
  slug ở đây và trong GameView.tsx.
*/
const SLUGS = ['2048', 'ran-san-moi', 'do-min', 'lat-hinh', 'ninja'];
export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GameView slug={slug} />;
}
