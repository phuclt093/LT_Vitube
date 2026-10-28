'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { apiFetch } from '@/lib/api';
import { BASE_PATH } from '@/lib/base-path';
import { GoogleButton, QrLogin, useAuthConfig } from './AuthExtras';
import { HistoryIcon, ClockIcon, LikeIcon, PlaylistIcon, CloseIcon } from './Icons';

// Màu phẳng theo bảng cổ phong: son, ngọc, chàm, hổ phách — không gradient
const TONES = ['bg-[#a93a2e]', 'bg-[#2f6b5a]', 'bg-[#3d4f7a]', 'bg-[#9a6b2f]'];

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const g = TONES[name.length % TONES.length];
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={`grid shrink-0 place-items-center rounded-full ${g} font-medium text-[#faf7f0]`}
    >
      {initial}
    </div>
  );
}

export default function AuthMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (loading) return <div className="skeleton h-8 w-8 rounded-full" />;

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 rounded-full border border-yt-border px-3 py-1.5 text-sm font-medium text-yt-blue hover:bg-yt-blue/10"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-3 0-8 1.5-8 4.5V21h16v-2.5c0-3-5-4.5-8-4.5z" />
          </svg>
          <span className="hidden sm:inline">Đăng nhập</span>
        </button>
        {modal && <AuthModal onClose={() => setModal(false)} />}
      </>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Tài khoản">
        <Avatar name={user.name} />
      </button>

      {open && (
        <div className="anim-pop absolute right-0 top-11 w-72 origin-top-right overflow-hidden rounded-xl bg-yt-elev py-2 shadow-2xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar name={user.name} size={40} />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-xs text-yt-sub">{user.email}</p>
            </div>
          </div>
          <hr className="my-1 border-yt-border" />

          {[
            { href: '/history', label: 'Video đã xem', Icon: HistoryIcon },
            { href: '/later', label: 'Xem sau', Icon: ClockIcon },
            { href: '/liked', label: 'Video đã thích', Icon: LikeIcon },
            { href: '/playlists', label: 'Danh sách phát', Icon: PlaylistIcon },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-4 px-4 py-2.5 text-sm hover:bg-yt-hover"
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}

          <hr className="my-1 border-yt-border" />
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-4 px-4 py-2.5 text-sm hover:bg-yt-hover"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M11 17l1.4-1.4-2.6-2.6H21v-2H9.8l2.6-2.6L11 7l-5 5 5 5zM4 5h8V3H4a2 2 0 00-2 2v14a2 2 0 002 2h8v-2H4V5z" />
            </svg>
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'qr'>('login');
  const cfg = useAuthConfig();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const r = await apiFetch('/api/auth/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, base: BASE_PATH }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? 'Có lỗi xảy ra');
        setSent(true);
        return;
      }
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-lg border border-yt-border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-yt-blue';

  return (
    <div
      className="anim-fade-in fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-pop w-full max-w-sm rounded-2xl bg-yt-elev p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : mode === 'qr' ? 'Quét mã để đăng nhập' : 'Quên mật khẩu'}
            </h2>
            <p className="mt-1 text-xs text-yt-sub">
              {mode === 'forgot'
                ? 'Nhập email đã đăng ký, xemchua gửi link đặt mật khẩu mới'
                : 'Để lịch sử và danh sách của bạn theo được sang thiết bị khác'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-yt-hover" aria-label="Đóng">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/*
          Server có Google thì chỉ còn Google + QR, không còn ô mật khẩu.
          Server chưa khai GOOGLE_CLIENT_ID (vd. app desktop chạy server riêng) thì giữ
          form email/mật khẩu cũ — không thì chẳng còn đường nào để đăng nhập.
        */}
        {!cfg ? (
          <div className="skeleton h-11 w-full rounded-full" />
        ) : mode === 'qr' ? (
          <QrLogin onDone={onClose} />
        ) : cfg.google ? (
          <div className="space-y-3">
            <GoogleButton clientId={cfg.google} onDone={onClose} onError={setErr} />
            {err && <p className="rounded-lg bg-yt-red/15 px-3 py-2 text-sm text-yt-red">{err}</p>}
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <input
              className={field}
              placeholder="Tên hiển thị"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          )}
          <input
            className={field}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {mode !== 'forgot' && (
          <input
            className={field}
            type="password"
            placeholder="Mật khẩu (từ 8 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
          />
          )}

          {mode === 'login' && cfg?.mail && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setErr('');
                setSent(false);
              }}
              className="text-xs text-yt-blue hover:underline"
            >
              Quên mật khẩu?
            </button>
          )}

          {sent && (
            <p className="rounded-lg bg-yt-blue/15 px-3 py-2 text-sm text-yt-blue">
              Nếu email này đã đăng ký, link đặt lại sẽ tới trong vài phút. Nhớ xem cả mục Spam.
            </p>
          )}

          {err && <p className="rounded-lg bg-yt-red/15 px-3 py-2 text-sm text-yt-red">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-yt-text py-2.5 text-sm font-medium text-yt-bg hover:bg-yt-text/90 disabled:opacity-60"
          >
            {busy
              ? 'Đang xử lý…'
              : mode === 'login'
                ? 'Đăng nhập'
                : mode === 'register'
                  ? 'Đăng ký'
                  : sent
                    ? 'Gửi lại'
                    : 'Gửi link đặt lại'}
          </button>
        </form>
        )}

        {mode !== 'qr' ? (
          <button
            onClick={() => {
              setMode('qr');
              setErr('');
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-yt-border py-2.5 text-sm font-medium hover:bg-yt-hover"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm11-2h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3zm3 6h2v2h-2v-2z" />
            </svg>
            Quét mã QR bằng điện thoại
          </button>
        ) : (
          err && <p className="mt-3 rounded-lg bg-yt-red/15 px-3 py-2 text-sm text-yt-red">{err}</p>
        )}

        {cfg?.google ? (
          mode === 'qr' && (
            <p className="mt-4 text-center text-sm text-yt-sub">
              <button
                onClick={() => {
                  setMode('login');
                  setErr('');
                }}
                className="font-medium text-yt-blue hover:underline"
              >
                Đăng nhập bằng Google
              </button>
            </p>
          )
        ) : (
        <p className="mt-4 text-center text-sm text-yt-sub">
          {mode === 'login' ? 'Chưa có tài khoản?' : mode === 'register' ? 'Đã có tài khoản?' : mode === 'qr' ? 'Dùng cách khác?' : 'Nhớ ra rồi?'}{' '}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setSent(false);
              setErr('');
            }}
            className="font-medium text-yt-blue hover:underline"
          >
            {mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </p>
        )}
      </div>
    </div>
  );
}
