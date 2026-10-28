'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';

/**
 * Trang mở ra khi điện thoại quét mã QR đăng nhập của máy khác.
 *
 * Luôn bắt bấm "Cho phép" chứ không tự duyệt khi vừa mở: kẻ xấu có thể gửi cho
 * bạn một mã QR do máy HẮN tạo ra — tự duyệt là trao tài khoản cho hắn. Nên trang
 * hiện rõ máy nào đang xin vào và nhắc chỉ cho phép khi máy đó đang ở trước mặt.
 */
export default function LinkDevicePage() {
  const { user, loading } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [device, setDevice] = useState('');
  const [state, setState] = useState<'checking' | 'ready' | 'done' | 'error'>('checking');
  const [err, setErr] = useState('');

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c') ?? '';
    setCode(c);
    if (!c) {
      setErr('Link thiếu mã. Hãy quét lại mã QR trên máy kia.');
      setState('error');
      return;
    }
    call({ action: 'peek', code: c })
      .then((j) => {
        setDevice(j.device);
        setState('ready');
      })
      .catch((e) => {
        setErr(e.message);
        setState('error');
      });
  }, []);

  const approve = async () => {
    try {
      await call({ action: 'approve', code });
      setState('done');
    } catch (e: any) {
      setErr(e.message);
      setState('error');
    }
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl bg-yt-elev p-6 text-center shadow-2xl">
      <h1 className="text-xl font-bold">Đăng nhập máy khác</h1>

      {state === 'checking' || loading ? (
        <div className="skeleton mx-auto mt-6 h-20 w-full rounded-xl" />
      ) : state === 'error' ? (
        <p className="mt-4 text-sm text-yt-red">{err}</p>
      ) : state === 'done' ? (
        <p className="mt-4 text-sm text-yt-blue">
          ✓ Xong! Máy kia sẽ tự vào tài khoản trong vài giây.
        </p>
      ) : !user ? (
        <p className="mt-4 text-sm leading-6 text-yt-sub">
          Điện thoại này chưa đăng nhập xemchua. Hãy{' '}
          <Link href="/" className="font-medium text-yt-blue hover:underline">đăng nhập</Link> trước
          (nút góc trên phải), rồi quét lại mã QR.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-6">
            <b>{device}</b> đang xin vào tài khoản <b>{user.email}</b>.
          </p>
          <p className="mt-2 rounded-lg bg-yt-red/10 px-3 py-2 text-xs leading-5 text-yt-red">
            Chỉ cho phép khi máy đó đang ở ngay trước mặt bạn. Ai gửi mã QR qua tin nhắn
            nhờ bạn quét thì đừng bấm.
          </p>
          <div className="mt-5 flex gap-2">
            <Link href="/" className="flex-1 rounded-full bg-yt-chip py-2.5 text-sm font-medium hover:bg-yt-chip2">
              Huỷ
            </Link>
            <button
              onClick={approve}
              className="flex-1 rounded-full bg-yt-text py-2.5 text-sm font-medium text-yt-bg hover:bg-yt-text/90"
            >
              Cho phép
            </button>
          </div>
        </>
      )}
    </div>
  );
}

async function call(body: unknown) {
  const r = await apiFetch('/api/auth/qr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'Có lỗi xảy ra');
  return j;
}
