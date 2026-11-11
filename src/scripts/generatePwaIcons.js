import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal pure Node PNG generator
function createPNG(width, height, isMaskable = false) {
  // RGBA buffer
  const buffer = Buffer.alloc(width * height * 4);

  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.48 : width * 0.44;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background Gradient from Deep Slate #0f172a to Indigo #312e81
      const t = (x + y) / (width + height);
      let r = Math.round(15 + t * 30);
      let g = Math.round(23 + t * 20);
      let b = Math.round(42 + t * 90);
      let a = 255;

      // Inside circle/squircle icon badge: Electric Indigo #4f46e5 to Violet #7c3aed
      if (isMaskable || dist <= radius) {
        // Gradient
        const badgeT = (y / height);
        r = Math.round(79 + badgeT * 45);
        g = Math.round(70 - badgeT * 12);
        b = Math.round(229 + badgeT * 8);

        // Center Layer Stack symbol (BundleByte 'Layers')
        const relX = (x - cx) / (width * 0.28);
        const relY = (y - cy) / (height * 0.28);

        // Top diamond (relY between -0.6 and -0.1, abs(relX) + abs(relY + 0.35) < 0.4)
        const inTopLayer = Math.abs(relX) * 0.6 + Math.abs(relY + 0.3) < 0.32;
        // Middle layer chevron
        const inMidLayer = Math.abs(relX) * 0.6 + Math.abs(relY + 0.05) < 0.32 && Math.abs(relX) * 0.6 + Math.abs(relY + 0.15) > 0.22;
        // Bottom layer chevron
        const inBotLayer = Math.abs(relX) * 0.6 + Math.abs(relY - 0.2) < 0.32 && Math.abs(relX) * 0.6 + Math.abs(relY - 0.1) > 0.22;

        if (inTopLayer || inMidLayer || inBotLayer) {
          r = 255;
          g = 255;
          b = 255;
        }
      } else if (!isMaskable) {
        // Transparent outside radius if standard icon
        a = 0;
        r = 0;
        g = 0;
        b = 0;
      }

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    }
  }

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0; // Filter None
    buffer.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);

  // PNG chunks helper
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // CRC32 table
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR[8] = 8; // Bit depth
  IHDR[9] = 6; // RGBA
  IHDR[10] = 0; // Deflate
  IHDR[11] = 0; // Filter
  IHDR[12] = 0; // Non-interlaced

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', IHDR),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Generate CRC table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

const outDir = path.resolve(process.cwd(), 'frontend/public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sizes = [
  { name: 'icon-192x192.png', size: 192, maskable: false },
  { name: 'icon-512x512.png', size: 512, maskable: false },
  { name: 'maskable-icon-192x192.png', size: 192, maskable: true },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon-180x180.png', size: 180, maskable: true },
];

for (const s of sizes) {
  const filePath = path.join(outDir, s.name);
  const pngData = createPNG(s.size, s.size, s.maskable);
  fs.writeFileSync(filePath, pngData);
  console.log(`✅ Generated ${s.name} (${s.size}x${s.size})`);
}

console.log('🎉 PWA Icon Set Generated Successfully!');

