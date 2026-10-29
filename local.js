'use strict';
// Музыка с компа: поиск файлов в папках и чтение тегов (mp3 / flac / wav) без сторонних библиотек.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXT = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.opus', '.aac']);
const MIME = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.aac': 'audio/aac',
};
const idOf = (p) => crypto.createHash('sha1').update(p.toLowerCase()).digest('hex').slice(0, 20);

function readHead(file, len) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(len);
    const n = fs.readSync(fd, buf, 0, len, 0);
    return buf.subarray(0, n);
  } finally { fs.closeSync(fd); }
}
function readAt(file, pos, len) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(len);
    const n = fs.readSync(fd, buf, 0, len, pos);
    return buf.subarray(0, n);
  } finally { fs.closeSync(fd); }
}

// ---------- текст в тегах ID3 ----------
function decodeText(b, enc) {
  if (!b.length) return '';
  let s;
  if (enc === 0) s = b.toString('latin1');
  else if (enc === 3) s = b.toString('utf8');
  else if (enc === 1) {
    if (b[0] === 0xff && b[1] === 0xfe) s = b.subarray(2).toString('utf16le');
    else if (b[0] === 0xfe && b[1] === 0xff) s = swap16(b.subarray(2)).toString('utf16le');
    else s = b.toString('utf16le');
  } else if (enc === 2) s = swap16(b).toString('utf16le');
  else s = b.toString('latin1');
  return s.replace(/\u0000+$/g, '').split('\u0000')[0].trim();
}
function swap16(b) { const c = Buffer.from(b.subarray(0, b.length - (b.length % 2))); c.swap16(); return c; }
const synchsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

// разбирает тег ID3v2; withPicture — вернуть картинку
function parseId3(buf, withPicture) {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return null;
  const ver = buf[3];
  const size = synchsafe(buf, 6);
  const out = { tagSize: size + 10, hasPicture: false };
  let o = 10;
  if (buf[5] & 0x40 && ver >= 3) { const ext = ver === 4 ? synchsafe(buf, 10) : buf.readUInt32BE(10) + 4; o += ext; }
  const end = Math.min(buf.length, size + 10);
  while (o + (ver === 2 ? 6 : 10) <= end) {
    let id, fsz, hdr;
    if (ver === 2) { id = buf.toString('latin1', o, o + 3); fsz = buf.readUIntBE(o + 3, 3); hdr = 6; }
    else { id = buf.toString('latin1', o, o + 4); fsz = ver === 4 ? synchsafe(buf, o + 4) : buf.readUInt32BE(o + 4); hdr = 10; }
    if (!/^[A-Z0-9]{3,4}$/.test(id) || fsz <= 0) break;
    const d = buf.subarray(o + hdr, Math.min(o + hdr + fsz, buf.length));
    o += hdr + fsz;
    const enc = d[0];
    switch (id) {
      case 'TIT2': case 'TT2': out.title = decodeText(d.subarray(1), enc); break;
      case 'TPE1': case 'TP1': out.artist = decodeText(d.subarray(1), enc); break;
      case 'TALB': case 'TAL': out.album = decodeText(d.subarray(1), enc); break;
      case 'TLEN': case 'TLE': { const ms = Number(decodeText(d.subarray(1), enc)); if (ms > 0) out.duration = ms; break; }
      case 'APIC': case 'PIC': {
        out.hasPicture = true;
        if (!withPicture || out.picture) break;
        let p = 1, mime;
        if (id === 'PIC') { mime = 'image/' + d.toString('latin1', 1, 4).toLowerCase().replace('jpg', 'jpeg'); p = 4; }
        else { const z = d.indexOf(0, 1); mime = d.toString('latin1', 1, z) || 'image/jpeg'; p = z + 1; }
        p += 1; // тип картинки
        // описание до нуля (в UTF-16 — до двух нулей)
        if (enc === 1 || enc === 2) { while (p + 1 < d.length && !(d[p] === 0 && d[p + 1] === 0)) p += 2; p += 2; }
        else { while (p < d.length && d[p] !== 0) p++; p += 1; }
        if (!mime.includes('/')) mime = 'image/jpeg';
        out.picture = { mime, data: d.subarray(p) };
        break;
      }
    }
  }
  return out;
}

// ---------- длительность mp3 ----------
const BR = {
  // [версия][слой] -> битрейты, кбит/с
  1: { 1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] },
  2: { 1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] },
};
const SR = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] };
function mp3Duration(file, start, fileSize) {
  const buf = readAt(file, start, 64 * 1024);
  for (let i = 0; i + 4 < buf.length; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const vBits = (buf[i + 1] >> 3) & 3, lBits = (buf[i + 1] >> 1) & 3;
    const bi = buf[i + 2] >> 4, si = (buf[i + 2] >> 2) & 3;
    if (vBits === 1 || lBits === 0 || bi === 0 || bi === 15 || si === 3) continue;
    const ver = vBits === 3 ? 1 : vBits === 2 ? 2 : 25;
    const layer = 4 - lBits;
    const kbps = BR[ver === 1 ? 1 : 2][layer][bi];
    const sr = SR[ver][si];
    const spf = layer === 1 ? 384 : layer === 2 ? 1152 : ver === 1 ? 1152 : 576;
    const mono = ((buf[i + 3] >> 6) & 3) === 3;
    // заголовок Xing/Info (VBR) — точное число кадров
    const xo = i + 4 + (ver === 1 ? (mono ? 17 : 32) : (mono ? 9 : 17));
    const tag = buf.toString('latin1', xo, xo + 4);
    if ((tag === 'Xing' || tag === 'Info') && buf[xo + 7] & 1) {
      const frames = buf.readUInt32BE(xo + 8);
      if (frames > 0) return Math.round((frames * spf / sr) * 1000);
    }
    const vbri = buf.toString('latin1', i + 36, i + 40);
    if (vbri === 'VBRI') { const frames = buf.readUInt32BE(i + 36 + 14); if (frames > 0) return Math.round((frames * spf / sr) * 1000); }
    if (kbps) return Math.round(((fileSize - start - i) * 8) / kbps);
    return 0;
  }
  return 0;
}

// ---------- flac ----------
function parseFlac(file, withPicture) {
  const head = readHead(file, withPicture ? 8 * 1024 * 1024 : 512 * 1024);
  if (head.toString('latin1', 0, 4) !== 'fLaC') return null;
  const out = { hasPicture: false };
  let o = 4;
  while (o + 4 <= head.length) {
    const last = head[o] & 0x80, type = head[o] & 0x7f, len = head.readUIntBE(o + 1, 3);
    const d = head.subarray(o + 4, o + 4 + len);
    if (type === 0 && d.length >= 18) {
      const sr = (d[10] << 12) | (d[11] << 4) | (d[12] >> 4);
      const total = (d[13] & 0x0f) * 2 ** 32 + d.readUInt32BE(14);
      if (sr) out.duration = Math.round((total / sr) * 1000);
    } else if (type === 4 && d.length > 8) {
      let p = 4 + d.readUInt32LE(0);
      const n = d.readUInt32LE(p); p += 4;
      for (let k = 0; k < n && p + 4 <= d.length; k++) {
        const l = d.readUInt32LE(p); p += 4;
        const kv = d.toString('utf8', p, p + l); p += l;
        const eq = kv.indexOf('=');
        const key = kv.slice(0, eq).toUpperCase(), val = kv.slice(eq + 1).trim();
        if (key === 'TITLE' && !out.title) out.title = val;
        else if (key === 'ARTIST' && !out.artist) out.artist = val;
        else if (key === 'ALBUM' && !out.album) out.album = val;
      }
    } else if (type === 6) {
      out.hasPicture = true;
      if (withPicture && !out.picture && d.length > 32) {
        let p = 4;
        const ml = d.readUInt32BE(p); p += 4;
        const mime = d.toString('latin1', p, p + ml) || 'image/jpeg'; p += ml;
        const dl = d.readUInt32BE(p); p += 4 + dl + 16;
        const sz = d.readUInt32BE(p); p += 4;
        out.picture = { mime, data: d.subarray(p, p + sz) };
      }
    }
    o += 4 + len;
    if (last) break;
  }
  return out;
}

// ---------- wav ----------
function parseWav(file, size) {
  const head = readHead(file, 256 * 1024);
  if (head.toString('latin1', 0, 4) !== 'RIFF' || head.toString('latin1', 8, 12) !== 'WAVE') return null;
  const out = {};
  let o = 12, byteRate = 0, dataSize = 0;
  while (o + 8 <= head.length) {
    const id = head.toString('latin1', o, o + 4), len = head.readUInt32LE(o + 4);
    if (id === 'fmt ') byteRate = head.readUInt32LE(o + 16);
    else if (id === 'data') { dataSize = Math.min(len, size - o - 8); break; }
    else if (id === 'LIST' && head.toString('latin1', o + 8, o + 12) === 'INFO') {
      let p = o + 12;
      while (p + 8 <= o + 8 + len && p + 8 <= head.length) {
        const sid = head.toString('latin1', p, p + 4), sl = head.readUInt32LE(p + 4);
        const v = head.toString('utf8', p + 8, p + 8 + sl).replace(/\u0000+$/, '').trim();
        if (sid === 'INAM') out.title = v; else if (sid === 'IART') out.artist = v; else if (sid === 'IPRD') out.album = v;
        p += 8 + sl + (sl & 1);
      }
    }
    o += 8 + len + (len & 1);
  }
  if (byteRate && dataSize) out.duration = Math.round((dataSize / byteRate) * 1000);
  return out;
}

// ---------- общий разбор файла ----------
function readTags(file, stat) {
  const ext = path.extname(file).toLowerCase();
  let t = null;
  try {
    if (ext === '.mp3') {
      const head = readHead(file, 10);
      let tagSize = 0;
      if (head.toString('latin1', 0, 3) === 'ID3') {
        tagSize = synchsafe(head, 6) + 10;
        t = parseId3(readHead(file, Math.min(tagSize, 1024 * 1024)), false) || {};
      } else t = {};
      if (!t.duration) t.duration = mp3Duration(file, tagSize, stat.size);
    } else if (ext === '.flac') t = parseFlac(file, false);
    else if (ext === '.wav') t = parseWav(file, stat.size);
  } catch { t = null; }
  t = t || {};
  // название из имени файла: «Артист - Трек.mp3»
  const base = path.basename(file, ext).replace(/_/g, ' ').trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!t.title) t.title = m ? m[2] : base;
  if (!t.artist) t.artist = m ? m[1] : path.basename(path.dirname(file));
  return { title: t.title, artist: t.artist, album: t.album || '', duration: t.duration || 0, hasPicture: !!t.hasPicture };
}
function readPicture(file) {
  const ext = path.extname(file).toLowerCase();
  try {
    if (ext === '.mp3') {
      const head = readHead(file, 10);
      if (head.toString('latin1', 0, 3) !== 'ID3') return null;
      const size = synchsafe(head, 6) + 10;
      const t = parseId3(readHead(file, Math.min(size, 16 * 1024 * 1024)), true);
      return t && t.picture;
    }
    if (ext === '.flac') { const t = parseFlac(file, true); return t && t.picture; }
  } catch {}
  return null;
}

// ---------- поиск файлов ----------
function walk(dir, out, depth = 0) {
  if (depth > 6 || out.length >= 8000) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('$')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (e.isFile() && EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
    if (out.length >= 8000) return;
  }
}

class Library {
  constructor(cacheFile) {
    this.cacheFile = cacheFile;
    try { this.cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { this.cache = {}; }
    this.byId = new Map();
    this.scannedAt = 0;
    this.tracks = [];
  }
  scan(folders) {
    const files = [];
    for (const f of folders) walk(f, files);
    const fresh = {};
    const tracks = [];
    this.byId.clear();
    for (const file of files) {
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      const key = `${file}|${st.size}|${Math.round(st.mtimeMs)}`;
      const meta = this.cache[key] || readTags(file, st);
      fresh[key] = meta;
      const id = idOf(file);
      this.byId.set(id, { file, hasPicture: meta.hasPicture });
      tracks.push({ src: 'local', id, title: meta.title, artist: meta.artist, album: meta.album, duration: meta.duration, hasPicture: meta.hasPicture, at: Math.round(st.mtimeMs) });
    }
    this.cache = fresh;
    try { fs.writeFileSync(this.cacheFile, JSON.stringify(fresh)); } catch {}
    this.tracks = tracks;
    this.scannedAt = Date.now();
    return tracks;
  }
  file(id) { const e = this.byId.get(id); return e ? e.file : null; }
}

module.exports = { Library, readPicture, readTags, parseId3, MIME, EXT };
