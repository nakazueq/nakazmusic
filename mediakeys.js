'use strict';
// Глобальные медиаклавиши Windows (play/pause, следующий, предыдущий, стоп), которые работают при свёрнутом окне и в трее.
// У Node нет доступа к RegisterHotKey, поэтому запускаем крошечного помощника. Лучше всего маленький нативный exe (assets/mkhelper.exe,
// собирается из native/MediaKeys.cs при сборке: антивирусы такое не трогают). Если его нет, запасной путь: скрытый PowerShell с тем же C#-классом.
// Помощник сообщает о нажатиях строками «KEY play|next|prev|stop», а мы пишем ему «on» и «off»:
// клавиши занимаем только пока у плеера есть трек, иначе их забрали бы у других программ (Spotify, браузер).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let psCache = null;
function psScript() {
  if (psCache) return psCache;
  const cs = fs.readFileSync(path.join(__dirname, 'native', 'MediaKeys.cs'), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  psCache = ["$ProgressPreference = 'SilentlyContinue'", 'Add-Type -AssemblyName System.Windows.Forms', "$cs = @'", cs, "'@", 'Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Windows.Forms -Language CSharp', '[MKWin]::Run()'].join('\r\n');
  return psCache;
}

class MediaKeys {
  // helperExe: путь к готовому mkhelper.exe или '' (тогда PowerShell)
  constructor(onKey, log, helperExe) {
    this.onKey = onKey;
    this.log = log || (() => {});
    this.helperExe = helperExe || '';
    this.child = null;
    this.ready = false;
    this.want = false;
    this.sent = null;
    this.reg = {};          // имя клавиши -> true (занята нами) или false (занята другой программой)
    this.starts = 0;
    this.mode = '';         // 'exe' или 'powershell'
  }
  start() {
    if (this.child || process.platform !== 'win32' || this.starts >= 4) return;
    this.starts++;
    const useExe = !!this.helperExe && this.starts <= 2 && fs.existsSync(this.helperExe);
    let c;
    try {
      c = useExe
        ? spawn(this.helperExe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
        : spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(psScript(), 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { this.log('медиаклавиши не запустились', e.message); if (useExe) { this.child = null; this.start(); } return; }
    this.mode = useExe ? 'exe' : 'powershell';
    this.child = c;
    process.once('exit', () => { try { c.kill(); } catch {} });   // при выходе помощник не должен остаться висеть
    let buf = '';
    c.stdout.setEncoding('utf8');
    c.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) this._line(line); }
    });
    c.stderr.on('data', (d) => { const s = String(d).trim(); if (s && !/^#< CLIXML|^<Objs/.test(s)) this.log('медиаклавиши:', s.slice(0, 200)); });
    c.stdin.on('error', () => {});
    c.on('error', (e) => this.log('медиаклавиши', e.message));
    c.on('exit', () => {
      if (this.child !== c) return;
      const neverReady = !this.ready;
      this.child = null; this.ready = false; this.sent = null; this.reg = {};
      // exe не заработал (антивирус, повреждён): переходим на запасной PowerShell
      if (useExe && neverReady) { this.log('mkhelper.exe не стартовал, запускаю через PowerShell'); this.starts = 2; this.start(); }
    });
  }
  _line(line) {
    if (line === 'READY') { this.ready = true; this._push(); return; }
    const m = line.match(/^(OK|FAIL|OFF|KEY) (\w+)$/);
    if (!m) return;
    if (m[1] === 'KEY') { try { this.onKey(m[2]); } catch (e) { this.log('медиаклавиша', e.message); } return; }
    if (m[1] === 'OFF') { delete this.reg[m[2]]; return; }
    this.reg[m[2]] = m[1] === 'OK';
    if (m[1] === 'FAIL') this.log(`медиаклавиша ${m[2]} занята другой программой`);
  }
  _push() {
    if (!this.ready || !this.child || this.sent === this.want) return;
    this.sent = this.want;
    try { this.child.stdin.write(this.want ? 'on\n' : 'off\n'); } catch {}
  }
  // клавиши нужны, только пока у плеера есть трек
  setActive(on) { this.want = !!on; this._push(); }
  stop() {
    const c = this.child;
    this.child = null;
    this.ready = false;
    if (c) { try { c.stdin.end(); } catch {} setTimeout(() => { try { c.kill(); } catch {} }, 800).unref(); }
  }
  status() { return { running: !!this.child && this.ready, active: this.sent === true, keys: { ...this.reg }, mode: this.mode }; }
}

module.exports = { MediaKeys };
