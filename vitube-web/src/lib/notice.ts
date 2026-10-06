'use client';

/**
 * Thông báo nhỏ nổi ở cuối màn hình, tự tắt sau vài giây. Không phụ thuộc React để gọi
 * được từ bất cứ đâu (kể cả trong callback bất đồng bộ).
 */
export function notify(message: string, ms = 5000): void {
  if (typeof document === 'undefined') return;
  const old = document.getElementById('vitube-notice');
  old?.remove();

  const el = document.createElement('div');
  el.id = 'vitube-notice';
  el.setAttribute('role', 'status');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:calc(16px + env(safe-area-inset-bottom))',
    'transform:translateX(-50%)',
    'z-index:2147483647',
    'max-width:min(92vw,480px)',
    'padding:10px 14px',
    'border-radius:10px',
    'background:rgb(28 28 28 / 0.94)',
    'color:#fff',
    'font-size:13px',
    'line-height:1.4',
    'box-shadow:0 8px 24px rgb(0 0 0 / 0.35)',
    'transition:opacity .25s',
  ].join(';');
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  window.setTimeout(() => {
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 300);
  }, ms);
}
