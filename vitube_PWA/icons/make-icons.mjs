/**
 * Sinh bộ biểu tượng cho PWA từ logo xemchua (nền son bo góc + bong bóng chat kem).
 *
 *   node vitube_PWA/icons/make-icons.mjs
 *
 * Ghi vào vitube-web/public/icons/. Dùng `sharp` có sẵn trong vitube-web/node_modules.
 *
 * Vì sao cần nhiều bản:
 *  - icon-192 / icon-512      Android, trình duyệt — nền trong suốt, đã bo góc
 *  - maskable-512             Android cắt theo hình của từng hãng (tròn, giọt nước…):
 *                             phải tràn nền, hình chính nằm gọn trong 80% ở giữa
 *  - apple-touch-icon (180)   iPhone tự bo góc, nên cần hình vuông đặc, KHÔNG trong suốt
 *                             (trong suốt thì iOS tô đen phần đó)
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '..', '..', 'vitube-web');
const sharp = createRequire(path.join(web, 'package.json'))('sharp');
const out = path.join(web, 'public', 'icons');
mkdirSync(out, { recursive: true });

const RED = '#a93a2e';
const CREAM = '#faf7f0';

// Logo xemchua (khớp vitube-web/src/components/Logo.tsx): bong bóng chat kem trên nền son,
// giữa là mũi tên phát màu son. Vẽ trong khung 24; `s` = tỉ lệ bong bóng so với khung
const BUBBLE =
  'M7 2.5h10a5 5 0 0 1 5 5V13a5 5 0 0 1-5 5h-6.3l-4.1 3.2c-.66.5-1.6.04-1.6-.79V17.6A5 5 0 0 1 2 13V7.5a5 5 0 0 1 5-5Z';
const CHEVRON = 'M10.2 7 L14 10.25 L10.2 13.5';
const mark = (s) => `<g transform="translate(12 12.4) scale(${s}) translate(-12 -12)">
    <path d="${BUBBLE}" fill="${CREAM}"/>
    <path d="${CHEVRON}" fill="none" stroke="${RED}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;

const svg = {
  // bo góc, nền trong suốt quanh khung
  rounded: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <rect x="0.9" y="0.9" width="22.2" height="22.2" rx="4.5" fill="${RED}"/>${mark(0.68)}</svg>`,
  // tràn nền, hình chính thu vào vùng an toàn
  full: (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <rect width="24" height="24" fill="${RED}"/>${mark(s)}</svg>`,
};

const jobs = [
  ['icon-192.png', svg.rounded, 192],
  ['icon-512.png', svg.rounded, 512],
  ['maskable-512.png', svg.full(0.55), 512],
  ['apple-touch-icon.png', svg.full(0.68), 180],
];

for (const [name, src, size] of jobs) {
  const buf = await sharp(Buffer.from(src)).resize(size, size).png().toBuffer();
  writeFileSync(path.join(out, name), buf);
  console.log(`  ✓ ${name} (${size}×${size})`);
}
console.log(`\nĐã ghi vào ${out}`);

// biểu tượng launcher cho app Android bọc web (vitube_PWA/android)
const res = path.resolve(here, '..', 'android', 'app', 'src', 'main', 'res');
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, size] of Object.entries(densities)) {
  const dir = path.join(res, `mipmap-${d}`);
  mkdirSync(dir, { recursive: true });
  const buf = await sharp(Buffer.from(svg.rounded)).resize(size, size).png().toBuffer();
  writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
}
console.log(`  ✓ biểu tượng Android (${Object.keys(densities).join(', ')}) → ${res}`);
