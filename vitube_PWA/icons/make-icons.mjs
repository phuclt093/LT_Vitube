/**
 * Sinh bộ biểu tượng cho PWA từ logo vitube (nền đỏ bo góc + mũi tên kem).
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

// mũi tên "play" kiểu chevron, vẽ trong khung 1024; `s` = tỉ lệ thu nhỏ quanh tâm
const chevron = (s) => {
  const t = (x, y) => `${512 + (x - 512) * s} ${512 + (y - 512) * s}`;
  return `<path d="M${t(420, 300)} L${t(664, 512)} L${t(420, 724)}" fill="none" stroke="${CREAM}"
    stroke-width="${128 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const svg = {
  // bo góc, nền trong suốt quanh khung
  rounded: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect x="40" y="40" width="944" height="944" rx="190" fill="${RED}"/>${chevron(1)}</svg>`,
  // tràn nền, hình chính thu vào vùng an toàn
  full: (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" fill="${RED}"/>${chevron(s)}</svg>`,
};

const jobs = [
  ['icon-192.png', svg.rounded, 192],
  ['icon-512.png', svg.rounded, 512],
  ['maskable-512.png', svg.full(0.72), 512],
  ['apple-touch-icon.png', svg.full(0.9), 180],
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
