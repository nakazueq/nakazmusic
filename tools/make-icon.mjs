// assets/icon.svg -> assets/icon.ico (16..256) и сырые RGBA для окна и трея
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
const rgba = async (svg, size) => (await sharp(svg, { density: 384 }).resize(size, size).ensureAlpha().raw().toBuffer());

export async function makeIcons() {
  const svg = readFileSync(join(root, 'assets', 'icon.svg'));
  const images = await Promise.all(ICO_SIZES.map((s) => png(svg, s)));

  // ICO с PNG внутри каждого размера
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach((img, i) => {
    const s = ICO_SIZES[i], o = 6 + 16 * i;
    head[o] = s === 256 ? 0 : s; head[o + 1] = s === 256 ? 0 : s;
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(img.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += img.length;
  });
  writeFileSync(join(root, 'assets', 'icon.ico'), Buffer.concat([head, ...images]));

  writeFileSync(join(root, 'assets', 'icon-256.rgba'), await rgba(svg, 256));
  writeFileSync(join(root, 'assets', 'icon-32.rgba'), await rgba(svg, 32));
  return join(root, 'assets', 'icon.ico');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('иконка:', await makeIcons());
}
