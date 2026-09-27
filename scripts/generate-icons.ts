import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUTPUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'public', 'icons');
const SIZES = [16, 32, 48, 128] as const;
const SUPERSAMPLE = 4;
const BACKGROUND = [31, 111, 235] as const;
const FOREGROUND = [255, 255, 255] as const;

const distanceToSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const ratio = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy));
};

const isGlyph = (pointX: number, pointY: number): boolean => {
  const stroke = 0.045;
  const ring = (cx: number, cy: number): boolean =>
    Math.abs(Math.hypot(pointX - cx, pointY - cy) - 0.08) < stroke;
  const line = (ax: number, ay: number, bx: number, by: number): boolean =>
    distanceToSegment(pointX, pointY, ax, ay, bx, by) < stroke;
  return (
    ring(0.3, 0.27) ||
    ring(0.3, 0.73) ||
    line(0.3, 0.35, 0.3, 0.65) ||
    ring(0.7, 0.73) ||
    line(0.7, 0.65, 0.7, 0.4) ||
    line(0.7, 0.4, 0.64, 0.32) ||
    line(0.64, 0.32, 0.53, 0.32) ||
    line(0.53, 0.32, 0.6, 0.25) ||
    line(0.53, 0.32, 0.6, 0.39)
  );
};

const isInsideRoundedSquare = (pointX: number, pointY: number): boolean => {
  const radius = 0.22;
  const cx = Math.min(Math.max(pointX, radius), 1 - radius);
  const cy = Math.min(Math.max(pointY, radius), 1 - radius);
  return Math.hypot(pointX - cx, pointY - cy) <= radius;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
const crc32 = (buffer: Buffer): number => {
  let crc = 0xff_ff_ff_ff;
  for (const byte of buffer) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const encodePng = (size: number, rgba: Uint8Array): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(6, 9);
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row += 1) {
    rows[row * (size * 4 + 1)] = 0;
    Buffer.from(rgba.subarray(row * size * 4, (row + 1) * size * 4)).copy(
      rows,
      row * (size * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

mkdirSync(OUTPUT, { recursive: true });
for (const size of SIZES) {
  const rgba = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let covered = 0;
      let glyph = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const pointX = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const pointY = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          if (isInsideRoundedSquare(pointX, pointY)) {
            covered += 1;
            glyph += isGlyph(pointX, pointY) ? 1 : 0;
          }
        }
      }
      const offset = (py * size + px) * 4;
      const glyphShare = covered === 0 ? 0 : glyph / covered;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = Math.round(
          (BACKGROUND[channel] ?? 0) * (1 - glyphShare) + (FOREGROUND[channel] ?? 0) * glyphShare,
        );
      }
      rgba[offset + 3] = Math.round((covered / SUPERSAMPLE ** 2) * 255);
    }
  }
  writeFileSync(join(OUTPUT, `icon-${size}.png`), encodePng(size, rgba));
  console.log(`wrote public/icons/icon-${size}.png`);
}
