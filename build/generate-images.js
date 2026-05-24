const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const HEADER_WIDTH = 150;
const HEADER_HEIGHT = 57;
const SIDEBAR_WIDTH = 164;
const SIDEBAR_HEIGHT = 314;

// Dark theme colors
const BG_DARK = [15, 17, 23];    // #0f1117
const BG_LIGHT = [26, 27, 46];   // #1a1b2e
const ACCENT = [59, 130, 246];   // #3b82f6
const TEXT_WHITE = [255, 255, 255];
const TEXT_GRAY = [148, 163, 184]; // #94a3b8

function encodeBmp(width, height, pixels) {
  // BMP row size must be padded to 4-byte boundary
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize);

  // BMP File Header (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6); // reserved
  buf.writeUInt32LE(54, 10); // pixel data offset

  // DIB Header (BITMAPINFOHEADER, 40 bytes)
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive = bottom-up
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // compression (BI_RGB)
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38); // x pixels per meter
  buf.writeInt32LE(2835, 42); // y pixels per meter
  buf.writeUInt32LE(0, 46); // colors in table
  buf.writeUInt32LE(0, 50); // important colors

  // Write pixel data (bottom-up, BGR format)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4; // RGBA from sharp
      // BMP is bottom-up, so flip Y
      const dstRow = height - 1 - y;
      const dstIdx = 54 + dstRow * rowSize + x * 3;
      buf[dstIdx] = pixels[srcIdx + 2];     // B
      buf[dstIdx + 1] = pixels[srcIdx + 1]; // G
      buf[dstIdx + 2] = pixels[srcIdx];     // R
    }
  }

  return buf;
}

function lerpColor(c1, c2, t) {
  return c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
}

function drawRect(pixels, width, height, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && px < width && py >= 0 && py < height) {
        const idx = (py * width + px) * 4;
        pixels[idx] = color[0];
        pixels[idx + 1] = color[1];
        pixels[idx + 2] = color[2];
        pixels[idx + 3] = 255;
      }
    }
  }
}

async function generateWithSharp(svgContent, width, height) {
  return sharp(Buffer.from(svgContent))
    .resize(width, height, { fit: 'fill' })
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: false });
}

async function generateHeader() {
  const svg = `
<svg width="${HEADER_WIDTH}" height="${HEADER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1117;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1b2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${HEADER_WIDTH}" height="${HEADER_HEIGHT}" fill="url(#bg)"/>
  <text x="20" y="25" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#ffffff" dominant-baseline="middle">FlowDesk</text>
  <text x="20" y="42" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#94a3b8" dominant-baseline="middle">桌面自动化工作流引擎</text>
</svg>`;

  const rawPixels = await generateWithSharp(svg, HEADER_WIDTH, HEADER_HEIGHT);

  // Draw blue accent bar on left
  drawRect(rawPixels, HEADER_WIDTH, HEADER_HEIGHT, 0, 0, 3, HEADER_HEIGHT, ACCENT);

  const bmp = encodeBmp(HEADER_WIDTH, HEADER_HEIGHT, rawPixels);
  fs.writeFileSync(path.join(__dirname, 'installerHeader.bmp'), bmp);
  console.log('Generated installerHeader.bmp');
}

async function generateSidebar() {
  // Read and resize the app icon
  const iconPath = path.join(__dirname, '..', 'resources', 'icon.png');
  const iconPixels = await sharp(iconPath)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .ensureAlpha()
    .toBuffer();

  const svg = `
<svg width="${SIDEBAR_WIDTH}" height="${SIDEBAR_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1117;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1b2e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="line" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0" />
      <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0" />
    </linearGradient>
  </defs>
  <rect width="${SIDEBAR_WIDTH}" height="${SIDEBAR_HEIGHT}" fill="url(#bg)"/>
  <text x="${SIDEBAR_WIDTH / 2}" y="195" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">FlowDesk</text>
  <text x="${SIDEBAR_WIDTH / 2}" y="218" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle" dominant-baseline="middle">工作流自动化引擎</text>
  <rect x="40" y="278" width="${SIDEBAR_WIDTH - 80}" height="1" fill="url(#line)"/>
  <text x="${SIDEBAR_WIDTH / 2}" y="296" font-family="Segoe UI, Arial, sans-serif" font-size="8" fill="#64748b" text-anchor="middle" dominant-baseline="middle">v0.1.0</text>
</svg>`;

  const rawPixels = await generateWithSharp(svg, SIDEBAR_WIDTH, SIDEBAR_HEIGHT);

  // Draw top accent line
  drawRect(rawPixels, SIDEBAR_WIDTH, SIDEBAR_HEIGHT, 0, 0, SIDEBAR_WIDTH, 2, ACCENT);

  // Composite the icon at center
  const iconX = Math.floor((SIDEBAR_WIDTH - 64) / 2);
  const iconY = 100;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const srcIdx = (y * 64 + x) * 4;
      const alpha = iconPixels[srcIdx + 3];
      if (alpha > 0) {
        const dstIdx = ((iconY + y) * SIDEBAR_WIDTH + (iconX + x)) * 4;
        const a = alpha / 255;
        rawPixels[dstIdx] = Math.round(rawPixels[dstIdx] * (1 - a) + iconPixels[srcIdx] * a);
        rawPixels[dstIdx + 1] = Math.round(rawPixels[dstIdx + 1] * (1 - a) + iconPixels[srcIdx + 1] * a);
        rawPixels[dstIdx + 2] = Math.round(rawPixels[dstIdx + 2] * (1 - a) + iconPixels[srcIdx + 2] * a);
      }
    }
  }

  const bmp = encodeBmp(SIDEBAR_WIDTH, SIDEBAR_HEIGHT, rawPixels);
  fs.writeFileSync(path.join(__dirname, 'installerSidebar.bmp'), bmp);
  console.log('Generated installerSidebar.bmp');
}

async function main() {
  await generateHeader();
  await generateSidebar();
  console.log('All images generated!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
