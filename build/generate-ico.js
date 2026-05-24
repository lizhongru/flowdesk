const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIco() {
  const iconPath = path.join(__dirname, '..', 'resources', 'icon.png');
  const sizes = [16, 32, 48, 256];
  const images = [];

  for (const size of sizes) {
    const pngBuf = await sharp(iconPath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    images.push({ size, data: pngBuf });
  }

  // ICO format:
  // ICONDIR: 6 bytes
  // ICONDIRENTRY: 16 bytes each
  // Image data follows

  const headerSize = 6;
  const entrySize = 16;
  const totalHeaderSize = headerSize + entrySize * images.length;

  // Calculate offsets
  let dataOffset = totalHeaderSize;
  for (const img of images) {
    img.offset = dataOffset;
    dataOffset += img.data.length;
  }

  const totalSize = dataOffset;
  const buf = Buffer.alloc(totalSize);

  // ICONDIR header
  buf.writeUInt16LE(0, 0);  // reserved
  buf.writeUInt16LE(1, 2);  // type: 1 = icon
  buf.writeUInt16LE(images.length, 4);  // number of images

  // ICONDIRENTRY for each image
  let pos = headerSize;
  for (const img of images) {
    const dim = img.size === 256 ? 0 : img.size; // 0 means 256
    buf.writeUInt8(dim, pos);        // width
    buf.writeUInt8(dim, pos + 1);    // height
    buf.writeUInt8(0, pos + 2);      // color palette
    buf.writeUInt8(0, pos + 3);      // reserved
    buf.writeUInt16LE(1, pos + 4);   // color planes
    buf.writeUInt16LE(32, pos + 6);  // bits per pixel
    buf.writeUInt32LE(img.data.length, pos + 8);  // data size
    buf.writeUInt32LE(img.offset, pos + 12);      // data offset
    pos += entrySize;
  }

  // Write image data
  for (const img of images) {
    img.data.copy(buf, img.offset);
  }

  const outPath = path.join(__dirname, 'installerHeaderIcon.ico');
  fs.writeFileSync(outPath, buf);
  console.log(`Generated installerHeaderIcon.ico (${images.length} sizes: ${sizes.join(', ')})`);
}

generateIco().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
