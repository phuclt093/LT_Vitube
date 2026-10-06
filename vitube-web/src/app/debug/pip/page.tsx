'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PIP_ERR_KEY, inPip, tryEnterPip, exitPip } from '@/lib/pip';

/**
 * /debug/pip — kiểm tra cửa sổ nổi ngay trên điện thoại.
 *
 * Video thử được vẽ bằng canvas nên không cần mạng, không dính trình phát Shaka:
 * nếu ở đây nổi được mà trong trang xem thì không → lỗi nằm ở trình phát vitube;
 * nếu ở đây cũng không → do trình duyệt / quyền của máy.
 */

type Row = [string, string];

function detect(): Row[] {
  const v = document.createElement('video');
  const w = window as Window & { documentPictureInPicture?: unknown };
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ref = document.referrer || '';
  const shell = ref.startsWith('android-app://')
    ? `APK (TWA) — ${ref}`
    : standalone
      ? 'App đã cài (màn hình chính)'
      : 'Trong tab trình duyệt';
  const yes = (b: unknown) => (b ? 'có' : 'KHÔNG');
  return [
    ['Bản build', process.env.NEXT_PUBLIC_BUILD_TIME ?? '(không rõ)'],
    ['Đang mở bằng', shell],
    ['Địa chỉ', location.origin],
    ['Kết nối bảo mật (https)', yes(window.isSecureContext)],
    ['requestPictureInPicture', yes(typeof v.requestPictureInPicture === 'function')],
    ['document.pictureInPictureEnabled', yes(document.pictureInPictureEnabled)],
    [
      'Cửa sổ nổi kiểu iPhone (webkit)',
      yes(typeof (v as HTMLVideoElement & { webkitSetPresentationMode?: unknown }).webkitSetPresentationMode === 'function'),
    ],
    ['Document PiP (chỉ máy tính)', yes(w.documentPictureInPicture)],
    ['Media Session', yes('mediaSession' in navigator)],
    ['Toàn màn hình', yes(document.fullscreenEnabled)],
    ['Màn hình cảm ứng', yes(window.matchMedia?.('(pointer: coarse)').matches)],
    ['Trình duyệt', navigator.userAgent],
  ];
}

export default function PipDebugPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [lastErr, setLastErr] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const add = useCallback((line: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 30));
  }, []);

  useEffect(() => {
    setRows(detect());
    try {
      setLastErr(sessionStorage.getItem(PIP_ERR_KEY) ?? '');
    } catch {
      /* bỏ qua */
    }
  }, []);

  // Video thử: đồng hồ chạy trên canvas → luồng video
  useEffect(() => {
    const c = canvasRef.current;
    const v = videoRef.current;
    if (!c || !v) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (t: number) => {
      const hue = (t / 40) % 360;
      ctx.fillStyle = `hsl(${hue} 60% 35%)`;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 64px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('vitube', c.width / 2, c.height / 2 - 10);
      ctx.font = '36px ui-monospace, monospace';
      ctx.fillText(new Date().toLocaleTimeString(), c.width / 2, c.height / 2 + 50);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const cap = (c as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
    if (typeof cap === 'function') {
      v.srcObject = cap.call(c, 30);
      v.play().catch((e) => add(`Không tự phát được: ${e?.name}`));
    } else {
      add('Máy không có canvas.captureStream — không tạo được video thử');
    }

    const on = (name: string) => () => add(`sự kiện: ${name}`);
    const enter = on('enterpictureinpicture');
    const leave = on('leavepictureinpicture');
    v.addEventListener('enterpictureinpicture', enter);
    v.addEventListener('leavepictureinpicture', leave);
    const vis = () => add(`trang ${document.visibilityState === 'hidden' ? 'bị ẩn (đã rời app)' : 'hiện lại'}${inPip(v) ? ' — video đang nổi' : ''}`);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('enterpictureinpicture', enter);
      v.removeEventListener('leavepictureinpicture', leave);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [add]);

  const testPip = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (inPip(v)) {
      await exitPip();
      add('Đã tắt cửa sổ nổi');
      return;
    }
    const why = await tryEnterPip(v);
    add(why ? `THẤT BẠI: ${why}` : 'THÀNH CÔNG — giờ vuốt về màn hình chính xem video còn nổi không');
  };

  const testFs = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.requestFullscreen();
      add('Đã vào toàn màn hình — bấm/vuốt Home ngay để thử tự nổi');
    } catch (e) {
      add(`Toàn màn hình lỗi: ${(e as Error)?.name} ${(e as Error)?.message ?? ''}`);
    }
  };

  const copy = async () => {
    const text = [
      ...rows.map(([k, val]) => `${k}: ${val}`),
      `Lỗi gần nhất: ${lastErr || '(chưa có)'}`,
      '--- nhật ký ---',
      ...log,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      add('Không chép được — chụp màn hình giúp nhé');
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6 text-sm">
      <h1 className="mb-1 text-xl font-bold">Kiểm tra cửa sổ nổi</h1>
      <p className="mb-4 text-yt-sub">
        Bấm “Thử cửa sổ nổi”. Nếu nổi được, vuốt về màn hình chính xem video còn nổi không.
      </p>

      <canvas ref={canvasRef} width={640} height={360} className="hidden" />
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="aspect-video w-full rounded-xl bg-black"
      />

      <div className="my-4 flex flex-wrap gap-2">
        <button onClick={testPip} className="rounded-full bg-yt-text px-4 py-2 font-medium text-yt-bg">
          Thử cửa sổ nổi
        </button>
        <button onClick={testFs} className="rounded-full border border-yt-border px-4 py-2">
          Thử toàn màn hình
        </button>
        <button onClick={copy} className="rounded-full border border-yt-border px-4 py-2">
          {copied ? 'Đã chép' : 'Chép kết quả'}
        </button>
      </div>

      {log.length > 0 && (
        <pre className="mb-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-yt-elev p-3 text-xs">
          {log.join('\n')}
        </pre>
      )}

      <table className="w-full border-collapse text-xs">
        <tbody>
          {rows.map(([k, val]) => (
            <tr key={k} className="border-b border-yt-border align-top">
              <td className="py-1.5 pr-3 font-medium">{k}</td>
              <td className={`break-all py-1.5 ${val === 'KHÔNG' ? 'font-bold text-red-500' : ''}`}>{val}</td>
            </tr>
          ))}
          <tr className="align-top">
            <td className="py-1.5 pr-3 font-medium">Lỗi gần nhất trong trang xem</td>
            <td className="break-all py-1.5">{lastErr || '(chưa có)'}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-6">
        <Link href="/" className="text-blue-500 underline">
          Về trang chủ
        </Link>
      </p>
    </div>
  );
}
