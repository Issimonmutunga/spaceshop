// Generates the PWA icon set as PNGs (no image deps: zlib + a tiny rasterizer).
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync as z } from "node:zlib";
import path from "node:path";

const ACCENT = [0xd9, 0x43, 0x2b];
const INK = [0x1a, 0x1a, 0x1c];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", z(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// The figure: a quiet ground square with one vermilion pin.
function draw(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const s = (v) => v * size;
  const pad = maskable ? s(0.18) : s(0.06);
  const radius = maskable ? 0 : s(0.22);
  const cx = size / 2;
  const cy = maskable ? size * 0.46 : size * 0.44;
  const headR = s(0.15);
  const tail = size * 0.62;

  const inRounded = (x, y) => {
    if (maskable) return true;
    const x0 = pad,
      y0 = pad,
      x1 = size - pad,
      y1 = size - pad;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cxr = Math.min(Math.max(x, x0 + radius), x1 - radius);
    const cyr = Math.min(Math.max(y, y0 + radius), y1 - radius);
    return (x - cxr) ** 2 + (y - cyr) ** 2 <= radius ** 2 + 1e-6;
  };

  const cover = (x, y) => {
    if (!inRounded(x, y)) return null;
    const d = Math.hypot(x - cx, y - cy);
    // Teardrop: circle head tapering to a point at cy + tail.
    const dy = y - cy;
    if (dy >= 0) {
      const w = headR * Math.max(0, 1 - (dy / (tail - cy)) ** 2) ** 0.5;
      return Math.abs(x - cx) <= w ? 1 : 0;
    }
    return d <= headR ? 1 : 0;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let rgb = INK;
      let a = 255;
      const m = cover(x + 0.5, y + 0.5);
      if (m === null) {
        a = 0;
      } else if (m === 1) {
        rgb =
          Math.hypot(x + 0.5 - cx, y + 0.5 - (cy - headR * 0.3)) < headR * 0.32
            ? [246, 245, 241]
            : ACCENT;
      }
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = a;
    }
  }
  return png(size, px);
}

const out = path.join(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "icon-192.png"), draw(192, false));
writeFileSync(path.join(out, "icon-512.png"), draw(512, false));
writeFileSync(path.join(out, "maskable-512.png"), draw(512, true));
writeFileSync(path.join(out, "apple-touch-icon.png"), draw(180, false));
console.log("icons written to", out);
void deflateSync;
