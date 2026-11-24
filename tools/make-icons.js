// 앱 아이콘(PNG) 생성기 — 외부 라이브러리 없이 동작합니다.
// 실행: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0; raw[o + 1] = a ? Math.round(g / a) : 0; raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BLUE = [47, 111, 237], WHITE = [255, 255, 255];

// 방패 모양 (cx, top, w, h 기준 정규화 좌표)
function inShield(x, y, s) {
  const u = (x - 0.5) / (0.27 * s), v = (y - (0.5 - 0.31 * s)) / (0.62 * s);
  if (Math.abs(u) > 1 || v > 1) return false;
  if (v < 0.08 * u * u) return false; // 위쪽 어깨를 둥글게
  const hw = v < 0.5 ? 1 : 1 - Math.pow((v - 0.5) / 0.5, 1.7);
  return Math.abs(u) <= hw;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function inCheck(x, y, s) {
  const c = (v) => 0.5 + (v - 0.5) * s;
  const w = 0.042 * s;
  return segDist(x, y, c(0.385), c(0.49), c(0.47), c(0.575)) < w ||
    segDist(x, y, c(0.47), c(0.575), c(0.625), c(0.41)) < w;
}
function roundRect(x, y, r) {
  const dx = Math.max(r - x, x - (1 - r), 0), dy = Math.max(r - y, y - (1 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

function icon({ scale = 1, rounded = 0 }) {
  return (x, y) => {
    if (rounded && !roundRect(x, y, rounded)) return [0, 0, 0, 0];
    if (inShield(x, y, scale)) return inCheck(x, y, scale) ? [...BLUE, 1] : [...WHITE, 1];
    return [...BLUE, 1]; // 단색 배경 (그라데이션 없음)
  };
}
const badge = (x, y) => (inShield(x, y, 1.25) && !inCheck(x, y, 1.25) ? [...WHITE, 1] : [0, 0, 0, 0]);

const files = {
  'icon-192.png': png(192, icon({ scale: 1, rounded: 0.22 })),
  'icon-512.png': png(512, icon({ scale: 1, rounded: 0.22 })),
  'icon-maskable-512.png': png(512, icon({ scale: 0.82 })),
  'apple-touch-icon.png': png(180, icon({ scale: 1 })),
  'badge-96.png': png(96, badge),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('만듦:', name, buf.length, 'bytes');
}
