'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { apiFetch } from '@/lib/api';
import { BASE_PATH } from '@/lib/base-path';
import { useAuth, type User } from './AuthProvider';

/** Cách đăng nhập server đang bật — xem /api/auth/config */
export type AuthConfig = { google: string | null; mail: boolean };

export function useAuthConfig(): AuthConfig | null {
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  useEffect(() => {
    apiFetch('/api/auth/config')
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setCfg({ google: null, mail: false }));
  }, []);
  return cfg;
}

async function postJson(path: string, body: unknown) {
  const r = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'Có lỗi xảy ra');
  return j;
}

/* ------------------------------------------------------------------ */
/* Đăng nhập bằng Google                                               */
/* ------------------------------------------------------------------ */

const GSI = 'https://accounts.google.com/gsi/client';

function loadGsi(): Promise<any> {
  const w = window as any;
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  return (w.__vitubeGsi ??= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = GSI;
    s.async = true;
    s.onload = () => ok(w.google);
    s.onerror = () => {
      w.__vitubeGsi = undefined;
      fail(new Error('Không tải được nút Google'));
    };
    document.head.appendChild(s);
  }));
}

export function GoogleButton({ clientId, onDone, onError }: {
  clientId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { adopt } = useAuth();
  const box = useRef<HTMLDivElement>(null);
  // Giữ callback mới nhất mà không phải dựng lại nút mỗi lần render
  const cb = useRef({ onDone, onError, adopt });
  cb.current = { onDone, onError, adopt };

  /*
    Google chỉ nhận những trang đã khai trong "Authorized JavaScript origins".
    `xemchua.pages.dev.` (dấu chấm cuối) là origin khác hẳn và không khai được,
    nên báo người dùng mở lại đúng địa chỉ thay vì để nút Google lỗi khó hiểu.
  */
  const trailingDot = typeof window !== 'undefined' && window.location.hostname.endsWith('.');

  useEffect(() => {
    if (trailingDot) return;
    let dead = false;
    loadGsi()
      .then((google) => {
        if (dead || !box.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }: { credential: string }) => {
            try {
              const j = await postJson('/api/auth/google', { credential });
              await cb.current.adopt(j.user as User);
              cb.current.onDone();
            } catch (e: any) {
              cb.current.onError(e?.message ?? 'Đăng nhập Google hỏng');
            }
          },
        });
        google.accounts.id.renderButton(box.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'vi',
          width: box.current.clientWidth || 320,
        });
      })
      .catch((e) => !dead && cb.current.onError(e.message));
    return () => {
      dead = true;
    };
  }, [clientId, trailingDot]);

  if (trailingDot) {
    const fixed = window.location.href.replace(window.location.hostname, window.location.hostname.slice(0, -1));
    return (
      <p className="rounded-lg bg-yt-chip px-3 py-2 text-xs leading-5 text-yt-sub">
        Địa chỉ đang có dấu chấm thừa ở cuối nên Google không nhận.{' '}
        <a href={fixed} className="font-medium text-yt-blue hover:underline">Mở lại đúng địa chỉ</a> để
        đăng nhập bằng Google.
      </p>
    );
  }

  return <div ref={box} className="flex min-h-[44px] w-full justify-center" />;
}

/* ------------------------------------------------------------------ */
/* Đăng nhập bằng mã QR — máy này hiện mã, điện thoại đã đăng nhập quét */
/* ------------------------------------------------------------------ */

export function QrLogin({ onDone }: { onDone: () => void }) {
  const { adopt } = useAuth();
  const [img, setImg] = useState('');
  const [state, setState] = useState<'loading' | 'waiting' | 'expired' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [round, setRound] = useState(0);

  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        setState('loading');
        const { code, poll, expiresAt } = await postJson('/api/auth/qr', { action: 'start' });
        const url = `${window.location.origin}${BASE_PATH}/link/?c=${encodeURIComponent(code)}`;
        const data = await QRCode.toDataURL(url, { margin: 1, width: 240 });
        if (dead) return;
        setImg(data);
        setState('waiting');

        const tick = async () => {
          if (dead) return;
          if (Date.now() > expiresAt) return setState('expired');
          try {
            const r = await postJson('/api/auth/qr', { action: 'poll', poll });
            if (dead) return;
            if (r.status === 'approved') {
              await adopt(r.user as User);
              return onDone();
            }
            if (r.status === 'expired') return setState('expired');
          } catch {
            /* mạng chập chờn thì cứ hỏi tiếp */
          }
          timer = setTimeout(tick, 2000);
        };
        timer = setTimeout(tick, 2000);
      } catch (e: any) {
        if (dead) return;
        setErr(e?.message ?? 'Không tạo được mã');
        setState('error');
      }
    })();

    return () => {
      dead = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid h-[240px] w-[240px] place-items-center overflow-hidden rounded-xl bg-white">
        {state === 'waiting' && img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="Mã QR đăng nhập" width={240} height={240} />
        ) : state === 'loading' ? (
          <div className="skeleton h-full w-full" />
        ) : (
          <button
            onClick={() => setRound((n) => n + 1)}
            className="rounded-full bg-yt-chip px-4 py-2 text-sm font-medium text-yt-text hover:bg-yt-chip2"
          >
            Tạo mã mới
          </button>
        )}
      </div>
      <p className="text-xs leading-5 text-yt-sub">
        {state === 'expired'
          ? 'Mã đã hết hạn.'
          : state === 'error'
            ? err
            : 'Mở camera trên điện thoại đã đăng nhập xemchua, quét mã này rồi bấm "Cho phép". Mã hết hạn sau 2 phút.'}
      </p>
    </div>
  );
}
