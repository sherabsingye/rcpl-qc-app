// Generates PWA icons without any npm deps — uses zlib + Buffer to encode PNG.
// Run: node generate-icons.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ICON_DIR = path.join(__dirname, "icons");
fs.mkdirSync(ICON_DIR, { recursive: true });

// Rigsar brand: safety yellow #FBB042 on asphalt black #131313.
const YELLOW = [0xfb, 0xb0, 0x42];
const BLACK  = [0x13, 0x13, 0x13];

// Simple 5x7 glyph for "R" and "C" inside the R (RCPL).
// We render an "R" centered on black with yellow strokes.
function drawPixel(buf, width, x, y, rgb) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const off = (y * width + x) * 4;
  buf[off] = rgb[0];
  buf[off + 1] = rgb[1];
  buf[off + 2] = rgb[2];
  buf[off + 3] = 0xff;
}

function fillRect(buf, width, x, y, w, h, rgb) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      drawPixel(buf, width, i, j, rgb);
    }
  }
}

function buildIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Black background.
  fillRect(buf, size, 0, 0, size, size, BLACK);

  // Yellow rounded-ish frame (approximation via inset + corner cut).
  const pad = Math.round(size * 0.08);
  fillRect(buf, size, pad, pad, size - pad * 2, size - pad * 2, YELLOW);
  // Black inner for "R" canvas.
  const inset = Math.round(size * 0.13);
  fillRect(buf, size, inset, inset, size - inset * 2, size - inset * 2, BLACK);

  // Draw a yellow "R" glyph — geometric blocks.
  const cx = size / 2;
  const cy = size / 2;
  const glyphH = size * 0.5;
  const glyphW = size * 0.34;
  const stroke = Math.max(3, Math.round(size * 0.07));
  const x0 = Math.round(cx - glyphW / 2);
  const y0 = Math.round(cy - glyphH / 2);
  const xR = Math.round(cx + glyphW / 2);

  // Vertical stem.
  fillRect(buf, size, x0, y0, stroke, Math.round(glyphH), YELLOW);
  // Top horizontal.
  fillRect(buf, size, x0, y0, Math.round(glyphW * 0.85), stroke, YELLOW);
  // Middle horizontal.
  fillRect(buf, size, x0, Math.round(y0 + glyphH * 0.42), Math.round(glyphW * 0.8), stroke, YELLOW);
  // Right side of bowl.
  fillRect(buf, size, Math.round(x0 + glyphW * 0.82 - stroke), y0, stroke, Math.round(glyphH * 0.48), YELLOW);
  // Diagonal leg (approximated as a slanted line).
  const legStartX = Math.round(x0 + glyphW * 0.42);
  const legStartY = Math.round(y0 + glyphH * 0.48);
  const legEndX = xR - stroke;
  const legEndY = y0 + Math.round(glyphH);
  const legLen = Math.max(Math.abs(legEndX - legStartX), Math.abs(legEndY - legStartY));
  for (let i = 0; i <= legLen; i++) {
    const t = i / legLen;
    const x = Math.round(legStartX + (legEndX - legStartX) * t);
    const y = Math.round(legStartY + (legEndY - legStartY) * t);
    for (let dy = 0; dy < stroke; dy++) {
      for (let dx = 0; dx < stroke; dx++) {
        drawPixel(buf, size, x + dx, y + dy, YELLOW);
      }
    }
  }

  return buf;
}

function encodePng(rgbaBuf, width, height) {
  // PNG signature.
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw scanline data: per-row filter byte (0) + RGBA pixels.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgbaBuf.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatData = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CRC-32 for PNG chunks.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

for (const size of [192, 512]) {
  const rgba = buildIcon(size);
  const png = encodePng(rgba, size, size);
  fs.writeFileSync(path.join(ICON_DIR, `icon-${size}.png`), png);
  console.log(`wrote icons/icon-${size}.png (${png.length} bytes)`);
}

// Reuse 512 as a simple maskable icon (has safe black padding around the R).
fs.copyFileSync(
  path.join(ICON_DIR, "icon-512.png"),
  path.join(ICON_DIR, "icon-512-maskable.png")
);
console.log("wrote icons/icon-512-maskable.png");
