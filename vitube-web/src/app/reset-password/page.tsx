'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { withBase } from '@/lib/base-path';

/**
 * Trang mở từ link trong email "Quên mật khẩu".
 *
 * Đọc mã từ `?token=` bằng `window.location` chứ không dùng `useSearchParams`:
 * bản tĩnh (GitHub/Cloudflare Pages) không có server để render theo query, và
 * `useSearchParams` ở đó đòi bọc Suspense chỉ để làm đúng việc này.
 */
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (password !== again) return setErr('Hai mật khẩu không khớp');
    setBusy(true);
    try {
      const r = await apiFetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Có lỗi xảy ra');
      // Server đã đăng nhập sẵn — tải lại trang chủ để AuthProvider đọc phiên mới
      window.location.href = withBase('/');
    } catch (e: any) {
      setErr(e?.message ?? 'Có lỗi xảy ra');
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-lg border border-yt-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-yt-blue';

  return (
    <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl bg-yt-elev p-6 shadow-2xl">
      <h1 className="text-xl font-bold">Đặt mật khẩu mới</h1>

      {token === '' ? (
        <p className="mt-4 text-sm text-yt-red">
          Link thiếu mã đặt lại. Hãy mở đúng link trong email, hoặc xin link mới ở mục Đăng nhập → Quên mật khẩu.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className={field}
            type="password"
            placeholder="Mật khẩu mới (từ 8 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <input
            className={field}
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            required
          />

          {err && <p className="rounded-lg bg-yt-red/15 px-3 py-2 text-sm text-yt-red">{err}</p>}

          <button
            type="submit"
            disabled={busy || !token}
            className="w-full rounded-full bg-yt-text py-2.5 text-sm font-medium text-yt-bg hover:bg-yt-text/90 disabled:opacity-60"
          >
            {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
          </button>
        </form>
      )}
    </div>
  );
}
