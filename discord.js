'use strict';
// Статус в Discord («Слушает …») через локальный канал Discord (Rich Presence, IPC).
const net = require('net');
const crypto = require('crypto');

class DiscordPresence {
  constructor(log) {
    this.log = log;
    this.sock = null;
    this.ready = false;
    this.clientId = '';
    this.enabled = false;
    this.pending = null;     // активность, ждущая подключения
    this.lastSent = '';
    this.retryAt = 0;
    this.timer = null;
    this.status = 'выключено';
    this.buf = Buffer.alloc(0);
  }
  configure(enabled, clientId) {
    const changed = clientId !== this.clientId;
    this.enabled = !!enabled && /^\d{15,25}$/.test(String(clientId || ''));
    this.clientId = String(clientId || '');
    if (!this.enabled) { this.status = enabled ? 'нужен Application ID' : 'выключено'; this.disconnect(); return; }
    if (changed) this.disconnect();
    this.retryAt = 0;
    this.connect();
  }
  disconnect() {
    if (this.sock) { try { this.sock.destroy(); } catch {} }
    this.sock = null; this.ready = false; this.lastSent = ''; this.buf = Buffer.alloc(0);
  }
  pipePath(i) { return process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${i}` : `${process.env.XDG_RUNTIME_DIR || '/tmp'}/discord-ipc-${i}`; }
  connect(i = 0) {
    if (!this.enabled || this.sock || Date.now() < this.retryAt) return;
    if (i > 9) { this.status = 'Discord не запущен'; this.retryAt = Date.now() + 30000; return; }
    const sock = net.createConnection(this.pipePath(i));
    let opened = false;
    sock.once('connect', () => {
      opened = true;
      this.sock = sock;
      this.status = 'подключаюсь…';
      this.send(0, { v: 1, client_id: this.clientId });
    });
    sock.on('data', (d) => this.onData(d));
    sock.on('error', () => { if (!opened) { sock.destroy(); this.connect(i + 1); } });
    sock.on('close', () => {
      if (!opened) return;
      if (this.sock === sock) { this.sock = null; this.ready = false; this.lastSent = ''; this.status = 'Discord закрыт'; this.retryAt = Date.now() + 15000; }
    });
  }
  send(op, obj) {
    if (!this.sock) return;
    const json = Buffer.from(JSON.stringify(obj), 'utf8');
    const h = Buffer.alloc(8);
    h.writeInt32LE(op, 0);
    h.writeInt32LE(json.length, 4);
    try { this.sock.write(Buffer.concat([h, json])); } catch {}
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0), len = this.buf.readInt32LE(4);
      if (len < 0 || len > 1e6) { this.log('discord: странный ответ, отключаюсь'); this.disconnect(); this.retryAt = Date.now() + 60000; return; }
      if (this.buf.length < 8 + len) break;
      let msg = {};
      try { msg = JSON.parse(this.buf.toString('utf8', 8, 8 + len)); } catch {}
      this.buf = this.buf.subarray(8 + len);
      if (op === 1 && msg.evt === 'READY') {
        this.ready = true;
        this.status = 'подключено' + (msg.data && msg.data.user ? ` (${msg.data.user.username})` : '');
        if (this.pending !== null) this.flush();
      } else if (op === 2) {
        this.status = 'Discord отказал: ' + ((msg && msg.message) || 'проверь Application ID');
        this.log('discord:', this.status);
        this.disconnect();
        this.retryAt = Date.now() + 60000;
      } else if (msg.evt === 'ERROR') {
        this.log('discord ошибка:', msg.data && msg.data.message);
      }
    }
  }
  // state: { hasTrack, title, artist, album, art, url, playing, time, dur }
  update(state) {
    if (!this.enabled) return;
    let activity = null;
    if (state && state.hasTrack && state.playing) {
      const start = Date.now() - (state.time || 0);
      activity = {
        type: 2,
        details: String(state.title || '').slice(0, 120) || 'Трек',
        state: String(state.artist || '').slice(0, 120) || '—',
        timestamps: state.dur ? { start, end: start + state.dur } : { start },
        instance: false,
      };
      if (/^https:\/\//.test(state.art || '')) {
        activity.assets = { large_image: state.art, large_text: String(state.album || state.title || 'Sonara').slice(0, 120) };
      }
      if (/^https:\/\//.test(state.url || '')) {
        activity.buttons = [{ label: state.src === 'sp' ? 'Слушать в Spotify' : 'Слушать на SoundCloud', url: state.url }];
      }
    }
    this.pending = activity;
    clearTimeout(this.timer);
    // Discord разрешает обновлять статус не чаще ~5 раз за 20 секунд
    this.timer = setTimeout(() => this.flush(), 1500);
  }
  flush() {
    if (!this.enabled) return;
    if (!this.sock) { this.connect(); return; }
    if (!this.ready) return;
    const key = JSON.stringify(this.pending && { ...this.pending, timestamps: this.pending.timestamps && Math.round(this.pending.timestamps.start / 5000) });
    if (key === this.lastSent) return;
    this.lastSent = key;
    this.send(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: this.pending }, nonce: crypto.randomUUID() });
  }
}

module.exports = { DiscordPresence };
