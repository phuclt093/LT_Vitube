import Link from 'next/link';

/**
 * Dấu hiệu nhận diện của xemchua — "xem chưa?" như một câu rủ nhau trong tin nhắn.
 *
 * Bong bóng chat màu son, đuôi chĩa xuống bên trái, giữa là mũi tên phát ghép từ
 * hai nét (không phải tam giác đặc — tránh na ná nhãn hiệu YouTube). Màu phẳng,
 * khớp với icon ứng dụng (`src/app/icon.svg`, `vitube_PWA/icons/make-icons.mjs`).
 *
 * Chữ: "xem" màu chữ thường, "chưa" màu son — đọc liền vẫn ra tên, tách ra thì
 * thành câu hỏi.
 */
export const BUBBLE =
  'M7 2.5h10a5 5 0 0 1 5 5V13a5 5 0 0 1-5 5h-6.3l-4.1 3.2c-.66.5-1.6.04-1.6-.79V17.6A5 5 0 0 1 2 13V7.5a5 5 0 0 1 5-5Z';
export const CHEVRON = 'M10.2 7 L14 10.25 L10.2 13.5';

export default function Logo() {
  return (
    <Link href="/" className="group flex select-none items-center gap-1.5" aria-label="xemchua trang chủ">
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105"
        aria-hidden
      >
        <path d={BUBBLE} fill="rgb(var(--yt-red))" />
        <path
          d={CHEVRON}
          fill="none"
          stroke="rgb(var(--yt-bg))"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span className="text-[21px] font-bold leading-none tracking-[-0.03em]">
        <span className="grad-text">xem</span>
        <span className="text-yt-red">chưa</span>
      </span>
    </Link>
  );
}
