#!/usr/bin/env node
/**
 * Build bản giao diện tĩnh cho GitHub Pages → thư mục `out/`.
 *
 *   npm run build:pages
 *   VITUBE_BASE_PATH=/LT_Vitube NEXT_PUBLIC_VITUBE_API_URL=https://may.ts.net npm run build:pages
 *
 * `output: 'export'` không chấp nhận route API và middleware, nên script tạm cất
 * chúng sang `.pages-stash/`, build, rồi LUÔN trả lại chỗ cũ (kể cả khi build lỗi
 * hoặc bấm Ctrl+C). Mã nguồn không bị đổi gì sau khi chạy xong.
 *
 * Biến môi trường:
 *   VITUBE_BASE_PATH              đường dẫn con, vd `/LT_Vitube` (bỏ trống nếu dùng tên
 *                                 miền riêng hoặc repo `<user>.github.io`)
 *   NEXT_PUBLIC_VITUBE_API_URL    địa chỉ server vitube mặc định (người dùng vẫn đổi
 *                                 được trong Cài đặt)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stash = join(root, '.pages-stash');

// Những thứ chỉ chạy được khi có server
const SERVER_ONLY = ['src/app/api', 'src/app/.well-known', 'src/middleware.ts'];

const basePath = (process.env.VITUBE_BASE_PATH ?? '').replace(/\/+$/, '');
if (basePath && !basePath.startsWith('/')) {
  console.error('VITUBE_BASE_PATH phải bắt đầu bằng "/", vd /LT_Vitube');
  process.exit(1);
}

let moved = [];
function restore() {
  for (const rel of moved.reverse()) {
    const from = join(stash, rel);
    if (existsSync(from)) renameSync(from, join(root, rel));
  }
  moved = [];
  rmSync(stash, { recursive: true, force: true });
}

// Lần trước bị ngắt giữa chừng? Trả đồ về trước đã.
if (existsSync(stash)) {
  moved = SERVER_ONLY.filter((rel) => existsSync(join(stash, rel)));
  restore();
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    restore();
    process.exit(130);
  });
}

let status = 1;
try {
  for (const rel of SERVER_ONLY) {
    const from = join(root, rel);
    if (!existsSync(from)) continue;
    const to = join(stash, rel);
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
    moved.push(rel);
  }

  console.log(`[build:pages] basePath="${basePath || '/'}"  api="${process.env.NEXT_PUBLIC_VITUBE_API_URL || '(người dùng tự nhập)'}"`);
  const r = spawnSync(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITUBE_STATIC: '1', VITUBE_BASE_PATH: basePath, NEXT_TELEMETRY_DISABLED: '1' },
  });
  status = r.status ?? 1;
} finally {
  restore();
}

if (status !== 0) process.exit(status);

const out = join(root, 'out');
// GitHub Pages chạy Jekyll mặc định — Jekyll bỏ qua thư mục bắt đầu bằng "_" như _next/
writeFileSync(join(out, '.nojekyll'), '');
// offline.html là file tĩnh viết tay, không qua basePath của Next
const offline = join(out, 'offline.html');
if (basePath && existsSync(offline)) {
  writeFileSync(offline, readFileSync(offline, 'utf8').replaceAll('src="/icons/', `src="${basePath}/icons/`));
}
console.log('[build:pages] xong → out/');
