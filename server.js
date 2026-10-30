'use strict';
// тот же exe в роли сторожа окна: сервер и интерфейс не поднимаем (см. watchdog.js)
if (process.env.NAKAZMUSIC_WATCH_PID) { require('./watchdog.js'); return; }
// Локальный сервер плеера «nakazmusic».
// Работает как обычный node-скрипт (node server.js) и как собранный nakazmusic.exe.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { spawn, execFile } = require('child_process');
const { Library, readPicture, MIME: AUDIO_MIME } = require('./local');
const { DiscordPresence } = require('./discord');
const { MediaKeys } = require('./mediakeys');

const APP_ID = 'nakazmusic';
const VERSION = require('./package.json').version;
const PORT = Number(process.env.PLAYER_PORT) || 3000;
const HOST = '127.0.0.1';
const URL_APP = `http://${HOST}:${PORT}`;
const IS_EXE = !!process.pkg;
const IS_WIN = process.platform === 'win32';
// У exe нет консоли: любая запись в неё (например, системное предупреждение Node) могла бы уронить программу.
// Подменяем вывод на «пустой», а предупреждения пишем в лог.
if (IS_EXE) {
  const { Writable } = require('stream');
  for (const name of ['stdout', 'stderr']) {
    try { Object.defineProperty(process, name, { value: new Writable({ write(c, e, cb) { cb(); } }), configurable: true, writable: true }); } catch {}
  }
  process.emitWarning = (w) => { try { log(LT('l.emitWarning.1'), String((w && w.message) || w)); } catch {} };
}
// метки запуска: сколько мс прошло с старта процесса (в логе строки «boot …»), чтобы видеть, что тормозит окно
const BOOT = Date.now() - Math.round(process.uptime() * 1000);
const boots = [];
function mark(step) { boots.push(`${step}=${Date.now() - BOOT}`); }
mark('node-up');
const PUB = path.join(__dirname, 'public');
const BASE_DIR = IS_EXE ? path.dirname(process.execPath) : __dirname;
const DATA_DIR = path.join(process.env.LOCALAPPDATA || process.env.APPDATA || BASE_DIR, 'MyPlayer');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
const LOG_FILE = path.join(DATA_DIR, 'player.log');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const STORE_KEYS = new Set(['sp_client_id', 'sp_token', 'sc_user', 'ui', 'volume', 'shuffle', 'repeat', 'wallImg', 'playlists', 'themes', 'yt_lists', 'search_src', 'yt_cookie_fb', 'keys', 'lang']);
// запуск с --safe-css (или NAKAZMUSIC_SAFE_CSS=1) отключает свой CSS, если он сломал интерфейс
const SAFE_CSS = process.argv.includes('--safe-css') || process.env.NAKAZMUSIC_SAFE_CSS === '1' || process.env.SONARA_SAFE_CSS === '1';
const PLAYS_FILE = path.join(DATA_DIR, 'plays.jsonl');
// история прослушиваний читается целиком: если разрослась, оставляем свежие записи
try {
  if (fs.statSync(PLAYS_FILE).size > 6e6) {
    const keep = fs.readFileSync(PLAYS_FILE, 'utf8').split('\n').filter(Boolean).slice(-40000);
    fs.writeFileSync(PLAYS_FILE + '.tmp', keep.join('\n') + '\n'); fs.renameSync(PLAYS_FILE + '.tmp', PLAYS_FILE);
  }
} catch {}

// ---------- лог в файл (консоли у exe нет) ----------
try { if (fs.statSync(LOG_FILE).size > 512 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old'); } catch {}
// в лог не должны попадать токены, пароли и cookies: вычищаем типичные формы (Bearer, access_token=…, Cookie: …, ключи в ссылках)
function redact(s) {
  return s
    .replace(/(Bearer\s+)[\w.~+\/-]{8,}=*/gi, '$1***')
    .replace(/((?:access_token|refresh_token|token|client_secret|password|passwd|pwd|api[_-]?key|key|sig|signature|cookie|authorization)["']?\s*[=:]\s*["']?)[^\s"'&,;}]{6,}/gi, '$1***')
    .replace(/(Set-Cookie|Cookie)\s*:\s*[^\n]+/gi, '$1: ***');
}
let logWrites = 0;
function log(...parts) {
  let text;
  try { text = parts.map((p) => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' '); } catch { text = '(could not format the message)'; }
  const line = `[${new Date().toISOString()}] ${redact(text).slice(0, 4000)}\n`;
  try {
    // ротация и во время работы, не только при старте: один файл не больше 512 КБ, плюс один старый
    if (++logWrites % 50 === 0 && fs.statSync(LOG_FILE).size > 512 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old');
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
  if (!IS_EXE) process.stdout.write(line);
}
process.on('uncaughtException', (e) => log('uncaughtException', e));
process.on('unhandledRejection', (e) => log('unhandledRejection', e));

function readJson(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } }
// пишем через временный файл: если питание пропадёт посреди записи, старый файл останется целым
function writeJson(file, data) {
  const tmp = file + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, file); }
  catch (e) { log(LT('l.writeJson.1'), file, e); try { fs.unlinkSync(tmp); } catch {} }
}
// дочерние процессы (yt-dlp): при выходе не оставляем их висеть
const liveKids = new Set();
function trackKid(child) {
  if (child && child.pid) { liveKids.add(child); child.on('exit', () => liveKids.delete(child)); }
  return child;
}
function killKids() { try { if (splash) splash.kill(); } catch {} for (const c of liveKids) { try { c.kill(); } catch {} } liveKids.clear(); }
process.on('exit', killKids);
// настройки страницы: если файл повреждён (не JSON, не объект), откладываем его в сторону и начинаем с чистого, а не падаем
function readStore() {
  let raw;
  try { raw = fs.readFileSync(STORE_FILE, 'utf8'); } catch { return {}; }
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw.replace(/^﻿/, ''));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch {}
  try { fs.renameSync(STORE_FILE, STORE_FILE + '.broken-' + Date.now()); log(LT('l.readStore.1')); } catch {}
  return {};
}
const readCfg = () => { const v = readJson(CONFIG_FILE, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
const config = readCfg();
// язык сервера: выбранный в интерфейсе (страница присылает его при запуске и при смене), пока нет, то язык системы
const i18nCore = require('./public/locales/core.js');
const I18 = i18nCore.create({ ru: require('./public/locales/ru.js'), en: require('./public/locales/en.js') },
  config.lang || i18nCore.detect([process.env.LC_ALL, process.env.LANG, (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return ''; } })()]));
const T = (key, params) => I18.t(key, params);
const LT = (key, params) => I18.t(key, params, 'en');   // для лога: всегда английский, чтобы его можно было читать и присылать
mark('i18n-ready');
const discord = new DiscordPresence(log, T);
// подключение к Discord откладываем: см. startDeferred()
const localLib = new Library(path.join(DATA_DIR, 'local-cache.json'));
const localFolders = () => (Array.isArray(config.localFolders) ? config.localFolders : []);
function localScan() { const t = localLib.scan(localFolders()); log(LT('l.localScan.1', { length: t.length })); return t; }
// файлы и обложки с компа отдаём только своей странице (чужие сайты браузер помечает cross-site)
const sameOrigin = (req) => !['cross-site', 'same-site'].includes(String(req.headers['sec-fetch-site'] || ''));
function serveFile(req, res, file, mime) {
  let size;
  try { size = fs.statSync(file).size; } catch { return send(res, 404, { error: T('s.serveFile.1') }); }
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': mime, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
    fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': mime, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }
}
const coverCache = new Map();
function localCover(id) {
  if (coverCache.has(id)) return coverCache.get(id);
  const file = localLib.file(id);
  const pic = file ? readPicture(file) : null;
  if (coverCache.size > 300) coverCache.delete(coverCache.keys().next().value);
  coverCache.set(id, pic);
  return pic;
}

// ---------- статистика прослушиваний ----------
function statsFor(range) {
  const since = range === 'week' ? Date.now() - 7 * 864e5 : range === 'month' ? Date.now() - 30 * 864e5 : 0;
  let lines = [];
  try { lines = fs.readFileSync(PLAYS_FILE, 'utf8').split('\n'); } catch {}
  const tracks = new Map(), artists = new Map(), days = new Map(), sources = { sp: 0, sc: 0, local: 0, yt: 0 };
  let totalMs = 0, plays = 0, first = 0;
  for (const line of lines) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e || !e.t || e.at < since) continue;
    plays++; totalMs += e.ms || 0;
    if (!first || e.at < first) first = e.at;
    const k = e.t.src + ':' + e.t.id;
    const tr = tracks.get(k) || { t: e.t, count: 0, ms: 0 };
    tr.count++; tr.ms += e.ms || 0; tr.t = e.t; tracks.set(k, tr);
    const an = String(e.t.artist || '—').split(',')[0].trim() || '—';
    const ar = artists.get(an.toLowerCase()) || { name: an, count: 0, ms: 0 };
    ar.count++; ar.ms += e.ms || 0; artists.set(an.toLowerCase(), ar);
    const d = new Date(e.at); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.set(day, (days.get(day) || 0) + (e.ms || 0));
    if (sources[e.t.src] !== undefined) sources[e.t.src] += e.ms || 0;
  }
  const nDays = range === 'week' ? 7 : 30;
  const chart = [];
  for (let i = nDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    chart.push({ day, ms: days.get(day) || 0 });
  }
  const byCount = (a, b) => b.count - a.count || b.ms - a.ms;
  return {
    range, totalMs, plays, first,
    uniqueTracks: tracks.size, uniqueArtists: artists.size,
    topTracks: [...tracks.values()].sort(byCount).slice(0, 25),
    topArtists: [...artists.values()].sort(byCount).slice(0, 12),
    chart, sources,
  };
}

// ---------- поиск браузера ----------
function regValue(args) {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve(null);
    execFile('reg', ['query', ...args], { windowsHide: true, timeout: 4000 }, (err, out) => {
      if (err) return resolve(null);
      const m = String(out).match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
      resolve(m ? m[1].trim().replace(/^"|"$/g, '') : null);
    });
  });
}
// есть ли на компьютере приложение Spotify (обычное или из Microsoft Store): без него запускать нечего
async function spotifyInstalled() {
  if (!IS_WIN) return false;
  if (exists(path.join(process.env.APPDATA || '', 'Spotify', 'Spotify.exe'))) return true;
  if (await regValue(['HKCR\\spotify\\shell\\open\\command', '/ve'])) return true;
  try { if (fs.readdirSync(path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps')).some((f) => /^spotify/i.test(f))) return true; } catch {}
  return false;
}
const BROWSERS = {
  brave: { rel: 'BraveSoftware\\Brave-Browser\\Application\\brave.exe', exe: 'brave.exe' },
  chrome: { rel: 'Google\\Chrome\\Application\\chrome.exe', exe: 'chrome.exe' },
  edge: { rel: 'Microsoft\\Edge\\Application\\msedge.exe', exe: 'msedge.exe' },
  vivaldi: { rel: 'Vivaldi\\Application\\vivaldi.exe', exe: 'vivaldi.exe' },
};
function exists(p) { try { return !!p && fs.existsSync(p); } catch { return false; } }
async function findBrowser(name) {
  const b = BROWSERS[name];
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  for (const r of roots) { const p = path.join(r, b.rel); if (exists(p)) return p; }
  for (const hive of ['HKCU', 'HKLM']) {
    const p = await regValue([`${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${b.exe}`, '/ve']);
    if (exists(p)) return p;
  }
  return null;
}
async function pickBrowser() {
  if (exists(config.browser)) return config.browser;
  let preferred = null;
  const progId = (await regValue(['HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice', '/v', 'ProgId'])) || '';
  const p = progId.toLowerCase();
  if (p.includes('brave')) preferred = 'brave';
  else if (p.includes('chrome')) preferred = 'chrome';
  else if (p.includes('msedge')) preferred = 'edge';
  else if (p.includes('vivaldi')) preferred = 'vivaldi';
  for (const name of [preferred, 'brave', 'chrome', 'edge', 'vivaldi'].filter(Boolean)) {
    const found = await findBrowser(name);
    if (found) return found;
  }
  return null;
}
async function openWindow() {
  if (!IS_WIN) { log(LT('l.openWindow.1'), URL_APP); return; }
  try {
    const browser = await pickBrowser();
    log(LT('l.openWindow.2'), browser || LT('l.openWindow.3'));
    const child = browser
      ? spawn(browser, [`--app=${URL_APP}`, '--window-size=1220,800'], { detached: true, stdio: 'ignore' })
      : spawn('explorer.exe', [URL_APP], { detached: true, stdio: 'ignore' });
    child.on('error', (e) => log(LT('l.openWindow.4'), e));
    child.unref();
  } catch (e) { log(LT('l.openWindow.5'), e); }
}

// ---------- одна копия программы ----------
function isAlreadyRunning() {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: PORT, path: '/api/ping?probe=1', timeout: 1500 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body).app === APP_ID); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ---------- выключение, когда окно закрыто (режим через браузер) ----------
const startedAt = Date.now();
let lastSeen = 0;
// всё, что не нужно для показа окна, запускаем через несколько секунд после появления интерфейса
let deferredDone = false;
function startDeferred() {
  if (deferredDone) return;
  deferredDone = true;
  mark('deferred-start');
  mediaKeysApply();
  discord.configure(config.discordOn, config.discordId);
  setTimeout(() => updateCheck(false), 5000).unref();
}
let byeTimer = null;
let watchdog = null;
function touch() { if (!lastSeen) { mark('first-request'); log('boot ' + boots.join(' ')); setTimeout(startDeferred, 3000).unref(); } lastSeen = Date.now(); if (byeTimer) { clearTimeout(byeTimer); byeTimer = null; } }
let shuttingDown = false;
async function shutdown(reason) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(LT('l.shutdown.1'), reason);
  try { saveBounds(); saveMiniPos(); } catch {}
  try { mediaKeys.stop(); } catch {}
  await pauseSpotifyOnExit();
  try { if (native) native.app.exit(); } catch {}
  process.exit(0);
}
function startWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(() => {
    const now = Date.now();
    if (!lastSeen && now - startedAt > 120000) shutdown(T('s.startWatchdog.1'));
    if (lastSeen && now - lastSeen > 300000) shutdown(T('s.startWatchdog.2'));
  }, 10000);
}

// ---------- Spotify: при закрытии ставим на паузу то, что играло через приложение Spotify ----------
let spSession = { token: '', device: '', playing: false };
async function pauseSpotifyOnExit() {
  if (!spSession.playing || !spSession.token) return;
  try {
    const q = spSession.device ? `?device_id=${encodeURIComponent(spSession.device)}` : '';
    await fetch('https://api.spotify.com/v1/me/player/pause' + q, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + spSession.token }, signal: AbortSignal.timeout(2000),
    });
  } catch (e) { log(LT('l.pauseSpotifyOnExit.1'), e.message); }
}
function openExternal(url) {
  if (!/^https?:\/\//i.test(url)) return;
  try { spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { log(LT('l.openExternal.1'), e); }
}
function launchSpotifyApp() {
  if (!IS_WIN) return;
  try { spawn('explorer.exe', ['spotify:'], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { log(LT('l.launchSpotifyApp.1'), e); }
  // Spotify при запуске выскакивает поверх: возвращаем наше окно
  if (native) { setTimeout(focusApp, 3500); setTimeout(focusApp, 7000); }
}

// ---------- заставка запуска ----------
// WebView2 создаётся долго (на холодном старте до десятков секунд), и всё это время сама программа занята. Поэтому заставка это
// отдельный крошечный процесс (assets/splash.exe, без WebView2): он появляется сразу и закрывается, когда окно плеера готово.
let splash = null;
function splashStart() {
  if (!IS_EXE || !IS_WIN || process.env.PLAYER_BROWSER === '1' || config.browserMode) return;
  const exe = assetExe('splash.exe');
  if (!exe) return;
  try {
    splash = spawn(exe, [T('s.starting'), config.theme === 'light' ? 'light' : 'dark'], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: false });
    splash.on('error', () => { splash = null; });
    splash.on('exit', () => { splash = null; });
    splash.stdin.on('error', () => {});
    mark('splash');
  } catch (e) { splash = null; log('splash did not start', e.message); }
}
function splashClose() {
  const sp = splash;
  splash = null;
  if (!sp) return;
  try { sp.stdin.write('close\n'); sp.stdin.end(); } catch {}
  setTimeout(() => { try { sp.kill(); } catch {} }, 1500).unref();
}
// заглушка внутри окна: встроенная страница без запросов к API; раз в 300 мс проверяет сервер и сразу переходит на интерфейс
const escHtml = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function stubHtml() {
  const dark = config.theme !== 'light';
  const bg = dark ? '#1c1c1e' : '#f4f4f7', fg = dark ? '#f5f5f7' : '#1c1c1e', dim = dark ? '#8e8e93' : '#636366';
  return '<!doctype html><meta charset="utf-8"><title>nakazmusic</title><style>html,body{margin:0;height:100%;overflow:hidden;background:' + bg + ';color:' + fg + ';font:14px "Segoe UI",system-ui,sans-serif}'
    + 'body{display:grid;place-items:center}.b{text-align:center}svg{width:72px;height:72px}p{margin:14px 0 18px;color:' + dim + ';font-weight:600}'
    + '.sp{width:18px;height:18px;margin:0 auto;border:2.4px solid transparent;border-top-color:' + fg + ';border-radius:50%;animation:r .8s linear infinite}@keyframes r{to{transform:rotate(360deg)}}</style>'
    + '<div class="b"><svg viewBox="0 0 24 24"><path d="M9 17.5V6.6l10-2.4v10.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.6" cy="17.6" r="2.6" fill="currentColor"/><circle cx="16.6" cy="15.1" r="2.6" fill="currentColor"/></svg>'
    + '<p>' + escHtml(T('s.starting')) + '</p><div class="sp"></div></div>'
    + '<script>(function(){var u=' + JSON.stringify(URL_APP) + ',busy=false;function go(){location.replace(u+"/")}'
    + 'function tick(){if(busy)return;busy=true;var c=new AbortController(),to=setTimeout(function(){c.abort()},1500);'
    + 'fetch(u+"/locales/core.js?"+Date.now(),{mode:"no-cors",cache:"no-store",signal:c.signal}).then(function(){clearTimeout(to);go()}).catch(function(){clearTimeout(to);busy=false})}'
    + 'setInterval(tick,300);tick()})()</script>';
}

// ---------- родное окно Windows (WebView2), без браузера ----------
let native = null;
function startNative() {
  if ((!IS_WIN && !process.env.PLAYER_NATIVE_TEST) || process.env.PLAYER_BROWSER === '1' || config.browserMode) return false;
  let wv;
  mark('native-start');
  try { wv = require('@webviewjs/webview'); mark('webview-module'); }
  catch (e) { log(LT('l.startNative.1'), e); return false; }
  try {
    let ver = '';
    try { ver = wv.getWebviewVersion(); } catch (e) { log(LT('l.startNative.2'), e.message); return false; }
    if (!ver) { log(LT('l.startNative.3')); return false; }
    mark('webview2-version');
    log('WebView2', ver);
    const app = new wv.Application();
    mark('application');
    const b = config.winBounds;
    const okBounds = b && b.w >= 760 && b.h >= 560 && b.x > -100 && b.y > -50;
    const win = app.createBrowserWindow({
      title: 'nakazmusic', logical: true,
      width: okBounds ? b.w : 1180, height: okBounds ? b.h : 760,
      ...(okBounds ? { x: b.x, y: b.y } : {}),
      maximized: !!(b && b.max),
      focused: true, resizable: true,
      visible: false,   // показываем, когда внутри уже тёмная заглушка: белого окна пользователь не видит
    });
    try { win.setMinSize(760, 560, true); } catch {}
    if (!okBounds) { try { win.center(); } catch {} }
    mark('window');
    setIcons(win);
    try { win.setTheme(config.theme === 'dark' ? wv.Theme.Dark : wv.Theme.Light); } catch {}
    const ctx = app.createWebContext({ dataDirectory: path.join(DATA_DIR, 'WebView2') });
    const view = win.createWebview({
      html: stubHtml(),
      webContext: ctx,
      enableDevtools: false,
      autoplay: true,
      hotkeysZoom: false,
      newWindowHandler: (e) => { if (e && e.url) openExternal(e.url); return false; },
    });
    mark('webview-created');
    try { view.setBackgroundColor(...(config.theme === 'light' ? [244, 244, 247, 255] : [28, 28, 30, 255])); } catch {}
    native = { app, win, view, wv, ctx };
    let shown = false;
    const showMain = () => {
      if (shown) return;
      shown = true;
      mark('window-shown');
      try { win.setVisible(true); win.focus(); } catch (e) { log(LT('l.focusApp.1'), e.message); }
      splashClose();
    };
    try { view.on('page-load-finished', showMain); } catch {}
    setTimeout(showMain, 1500).unref();   // запасной вариант, если событие загрузки не пришло
    // крестик: прячем в трей, музыка играет дальше (если трей включён и создался)
    win.on('close', (e) => {
      if (tray && config.closeToTray !== false) { e.preventDefault(); hideMain(); }
      else saveBounds();
    });
    app.on('application-close-requested', () => shutdown(T('s.startNative.1')));
    app.on('custom-menu-click', (e) => { const id = e && e.customMenuEvent && e.customMenuEvent.id; if (id) onTrayMenu(id); });
    app.run({ interval: 16 });
    mark('app-run');
    setupTray();
    mark('tray');
    setImmediate(() => { mark('loop-resumed'); log('boot ' + boots.join(' ')); });
    return true;
  } catch (e) {
    log(LT('l.startNative.4'), e);
    return false;
  }
}
function setIcons(win) {
  try {
    const icon = fs.readFileSync(path.join(__dirname, 'assets', 'icon-256.rgba'));
    win.setWindowIcon(icon, 256, 256);
    win.setTaskbarIcon(icon, 256, 256);
  } catch (e) { log(LT('l.setIcons.1'), e.message); }
}
function saveBounds() {
  if (!native) return;
  try {
    const w = native.win;
    if (w.isMinimized() || !w.isVisible()) return;
    if (w.fullscreen != null) return;   // размер полноэкранного окна как обычный не запоминаем
    const max = w.isMaximized();
    const prev = config.winBounds || {};
    if (max) config.winBounds = { ...prev, max: true };
    else {
      const s = w.getOuterSize(true), p = w.getPosition(true);
      config.winBounds = { x: Math.round(p.x), y: Math.round(p.y), w: Math.round(s.width), h: Math.round(s.height), max: false };
    }
    writeJson(CONFIG_FILE, config);
  } catch (e) { log(LT('l.saveBounds.1'), e.message); }
}
function hideMain() {
  if (!native) return;
  saveBounds();
  try { native.win.setVisible(false); } catch (e) { log(LT('l.hideMain.1'), e.message); }
  updateTray();
}
function focusApp() {
  if (native) {
    try { native.win.setVisible(true); native.win.setMinimized(false); native.win.focus(); } catch (e) { log(LT('l.focusApp.1'), e.message); }
    updateTray();
  } else openWindow();
}
function setWindowTheme(mode) {
  if (config.theme !== mode) { config.theme = mode; writeJson(CONFIG_FILE, config); }
  if (!native) return;
  const t = mode === 'dark' ? native.wv.Theme.Dark : native.wv.Theme.Light;
  try { native.win.setTheme(t); } catch {}
  if (mini) { try { mini.win.setTheme(t); } catch {} }
}

// ---------- значок у часов (трей) ----------
let tray = null;
function trayMenu() {
  const playing = !!(nowState && nowState.playing);
  return {
    items: [
      { id: 'toggle', label: playing ? T('s.trayMenu.1') : T('s.trayMenu.2') },
      { id: 'next', label: T('s.trayMenu.3') },
      { id: 'prev', label: T('s.trayMenu.4') },
      ...(nowState && nowState.sleep ? [{ id: 'sleepcancel', label: T('s.trayMenu.5') }] : []),
      { role: 'separator' },
      { id: 'mini', label: mini ? T('s.trayMenu.6') : T('s.trayMenu.7') },
      { id: 'show', label: T('s.trayMenu.8') },
      { role: 'separator' },
      { id: 'quit', label: T('s.trayMenu.9') },
    ],
  };
}
function setupTray() {
  if (!native) return;
  if (!IS_WIN && !process.env.PLAYER_TRAY_TEST) return; // на Linux трею нужна системная библиотека
  try {
    const data = fs.readFileSync(path.join(__dirname, 'assets', 'icon-32.rgba'));
    tray = native.app.createTrayIcon({ id: 'main', icon: { data, width: 32, height: 32 }, tooltip: 'nakazmusic', menu: trayMenu(), menuOnLeftClick: false, menuOnRightClick: true });
    tray.on('click', () => focusApp());
    tray.on('double-click', () => focusApp());
    log(LT('l.setupTray.1'));
  } catch (e) { tray = null; log(LT('l.setupTray.2'), e.message || e); }
}
let trayKey = '';
function updateTray() {
  if (!tray) return;
  const s = nowState || {};
  const tip = s.title ? `${s.title} — ${s.artist || ''}`.slice(0, 120) : 'nakazmusic';
  const key = [tip, !!s.playing, !!mini, !!s.sleep].join('|');
  if (key === trayKey) return;
  trayKey = key;
  try { tray.setTooltip(tip); tray.setMenu(trayMenu()); } catch (e) { log(LT('l.updateTray.1'), e.message); }
}
function onTrayMenu(id) {
  if (id === 'show') return focusApp();
  if (id === 'quit') return shutdown(T('s.onTrayMenu.1'));
  if (id === 'mini') return mini ? closeMini() : openMini();
  if (['toggle', 'next', 'prev', 'sleepcancel'].includes(id)) sseSend('main', 'cmd', { cmd: id });
}

// ---------- мини-плеер: маленькое окно поверх всех ----------
let mini = null;
function openMini() {
  if (!native) return;
  if (mini) { try { mini.win.setVisible(true); mini.win.focus(); } catch {} return; }
  try {
    const W = 380, H = 104;
    let pos = config.miniPos;
    if (!pos) {
      const mon = native.win.getCurrentMonitor() || native.win.getPrimaryMonitor();
      if (mon) {
        const sf = mon.scaleFactor || 1;
        pos = { x: Math.round(mon.position.x / sf + mon.size.width / sf - W - 24), y: Math.round(mon.position.y / sf + mon.size.height / sf - H - 72) };
      }
    }
    const win = native.app.createBrowserWindow({
      title: T('s.openMini.1'), logical: true, width: W, height: H,
      ...(pos ? { x: pos.x, y: pos.y } : {}),
      alwaysOnTop: true, decorations: false, resizable: false, maximizable: false,
      windowsUndecoratedShadow: true, focused: true,
    });
    setIcons(win);
    try { win.setTheme(config.theme === 'dark' ? native.wv.Theme.Dark : native.wv.Theme.Light); } catch {}
    const view = win.createWebview({ url: URL_APP + '/mini', webContext: native.ctx, enableDevtools: false, hotkeysZoom: false, autoplay: true });
    win.on('close', () => { saveMiniPos(); mini = null; updateTray(); });
    mini = { win, view };
    hideMain();
  } catch (e) { mini = null; log(LT('l.openMini.1'), e); }
  updateTray();
}
function saveMiniPos() {
  if (!mini) return;
  try { const p = mini.win.getPosition(true); config.miniPos = { x: Math.round(p.x), y: Math.round(p.y) }; writeJson(CONFIG_FILE, config); } catch {}
}
function closeMini(showMain = false) {
  if (mini) { saveMiniPos(); const w = mini.win; mini = null; try { w.close(); } catch (e) { log(LT('l.closeMini.1'), e.message); } }
  if (showMain) focusApp();
  updateTray();
}

// ---------- связь окон: события от сервера (SSE) ----------
const SSE_KEY = crypto.randomBytes(16).toString('hex');
const sseClients = new Set();
let nowState = null;
function sseSend(role, event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) if (!role || c.role === role) { try { c.res.write(msg); } catch {} }
}
setInterval(() => sseSend('main', 'tick', { t: Date.now() }), 2000).unref();

// ---------- глобальные медиаклавиши Windows ----------
const MEDIA_CMD = { play: 'toggle', next: 'next', prev: 'prev', stop: 'pause' };
let mediaKeyAt = 0;
// готовый нативный помощник (assets/mkhelper.exe, его собирает tools/build.mjs); из exe-файла его нужно положить на диск, запустить из архива нельзя
function assetExe(name) {
  try {
    const src = path.join(__dirname, 'assets', name);
    if (!fs.existsSync(src)) return '';
    if (!IS_EXE) return src;
    const buf = fs.readFileSync(src), dest = path.join(DATA_DIR, name);
    let same = false;
    try { same = fs.readFileSync(dest).equals(buf); } catch {}
    if (!same) { fs.writeFileSync(dest + '.part', buf); fs.renameSync(dest + '.part', dest); }
    return dest;
  } catch (e) { log(LT('l.mediaHelperPath.1'), name, e.message); return ''; }
}
const mediaHelperPath = () => assetExe('mkhelper.exe');
const mediaKeys = new MediaKeys((name) => {
  const cmd = MEDIA_CMD[name];
  if (!cmd || Date.now() - mediaKeyAt < 250) return;   // одно нажатие не должно сработать дважды
  mediaKeyAt = Date.now();
  sseSend('main', 'cmd', { cmd });
}, log, '');   // путь к помощнику подставляем при первом запуске клавиш (mediaKeysApply), чтобы не тратить время на старте
// клавиши занимаем, пока включена настройка и у плеера есть трек
function mediaKeysApply() {
  if (!mediaKeys.helperExe) mediaKeys.helperExe = mediaHelperPath();
  if (config.mediaKeys === false) { mediaKeys.setActive(false); mediaKeys.stop(); return; }
  mediaKeys.start();
  mediaKeys.setActive(!!(nowState && nowState.hasTrack));
}

// ---------- SoundCloud (api-v2, без ключей разработчика) ----------
const SC_API = 'https://api-v2.soundcloud.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SC_ID_FILE = path.join(DATA_DIR, 'sc-client.json');
let scClient = readJson(SC_ID_FILE, null);
let scClientPromise = null;

async function httpText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
async function getClientId(force = false) {
  if (!force && scClient && Date.now() - scClient.at < 7 * 864e5) return scClient.id;
  if (scClientPromise) return scClientPromise;
  scClientPromise = (async () => {
    const html = await httpText('https://soundcloud.com/');
    const scripts = [...html.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map((m) => m[1]).reverse();
    for (const src of scripts) {
      try {
        const js = await httpText(src);
        const m = js.match(/client_id\s*:\s*"([0-9a-zA-Z]{32})"/) || js.match(/client_id=([0-9a-zA-Z]{32})/);
        if (m) { scClient = { id: m[1], at: Date.now() }; writeJson(SC_ID_FILE, scClient); return m[1]; }
      } catch {}
    }
    throw new Error(T('s.getClientId.1'));
  })();
  try { return await scClientPromise; } finally { scClientPromise = null; }
}
async function scGet(p, params = {}, retry = true) {
  const id = await getClientId();
  const u = new URL(p.startsWith('http') ? p : SC_API + p);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  u.searchParams.set('client_id', id);
  const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if ((r.status === 401 || r.status === 403) && retry) { await getClientId(true); return scGet(p, params, false); }
  if (r.status === 404) { const e = new Error(T('s.scGet.1')); e.status = 404; throw e; }
  if (!r.ok) throw new Error(T('s.scGet.2', { status: r.status }));
  return r.json();
}
function scArt(url, size) { return url ? url.replace('-large.', `-${size}.`) : ''; }
function scMap(t, likedAt) {
  const art = t.artwork_url || (t.user && t.user.avatar_url) || '';
  return {
    src: 'sc',
    id: String(t.id),
    title: t.title || T('s.scMap.1'),
    artist: (t.publisher_metadata && t.publisher_metadata.artist) || (t.user && t.user.username) || '',
    url: t.permalink_url,
    duration: t.full_duration || t.duration || 0,
    cover: scArt(art, 'large'),
    art: scArt(art, 't300x300'),
    at: likedAt ? Date.parse(likedAt) || 0 : 0,
  };
}

async function scLikesDirect(user) {
  const u = await scGet('/resolve', { url: `https://soundcloud.com/${user}` });
  if (!u || u.kind !== 'user') throw new Error(T('s.scLikesDirect.1'));
  const out = [];
  let next = `/users/${u.id}/likes`;
  let params = { limit: 200, linked_partitioning: 1 };
  for (let page = 0; next && page < 60; page++) {
    const data = await scGet(next, params);
    params = {};
    for (const it of data.collection || []) if (it && it.track) out.push(scMap(it.track, it.created_at));
    next = data.next_href || null;
  }
  return out;
}
function scLikesYtdlp(user) {
  const exe = ytdlpExe();
  if (!exe) return Promise.reject(new Error(T('s.scLikesYtdlp.1')));
  return new Promise((resolve, reject) => {
    trackKid(execFile(exe, ['--flat-playlist', '-J', '--no-warnings', `https://soundcloud.com/${user}/likes`],
      { maxBuffer: 256 * 1024 * 1024, timeout: 5 * 60 * 1000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(String(stderr || err.message).slice(0, 300)));
        try {
          const data = JSON.parse(stdout);
          resolve((data.entries || []).filter((e) => e && e.id).map((e) => ({
            src: 'sc', id: String(e.id), title: e.title || T('s.scLikesYtdlp.2'), artist: e.uploader || '',
            url: e.webpage_url || e.url, duration: e.duration ? Math.round(e.duration * 1000) : 0,
            cover: '', art: '', at: 0,
          })));
        } catch { reject(new Error(T('s.scLikesYtdlp.3'))); }
      }));
  });
}
async function scLikes(user, force) {
  const file = path.join(DATA_DIR, `sc-likes-${user.toLowerCase()}.json`);
  const cached = readJson(file, null);
  if (!force && cached) return { ...cached, cached: true };
  let tracks;
  try { tracks = await scLikesDirect(user); }
  catch (e) {
    log(LT('l.scLikes.1'), e.message);
    try { tracks = await scLikesYtdlp(user); } catch (e2) { log(LT('l.scLikes.2'), e2.message); throw e; }
  }
  const res = { at: Date.now(), tracks };
  writeJson(file, res);
  return res;
}

async function scStream(id) {
  const t = await scGet(`/tracks/${id}`);
  const list = ((t.media && t.media.transcodings) || []).filter((x) => x && x.url && x.format);
  const okProto = (x) => x.format.protocol === 'progressive' || x.format.protocol === 'hls';
  const rank = (x) =>
    (x.snipped ? 100 : 0) +
    (x.format.protocol === 'progressive' ? 0 : 10) +
    (/mpeg/.test(x.format.mime_type || '') ? 0 : 1);
  const pick = list.filter(okProto).sort((a, b) => rank(a) - rank(b))[0];
  if (!pick) { const e = new Error(T('s.scStream.1')); e.status = 403; throw e; }
  const s = await scGet(pick.url, { track_authorization: t.track_authorization });
  if (!s || !s.url) throw new Error(T('s.scStream.2'));
  return { url: s.url, protocol: pick.format.protocol, mime: pick.format.mime_type, snipped: !!pick.snipped || t.policy === 'SNIP' };
}

// ---------- подбор треков ----------
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\b(feat|ft)\b.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k]); } catch (e) { log(LT('l.mapLimit.1'), e.message); out[k] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}
const recsCache = new Map();
async function recommend(seeds) {
  const key = JSON.stringify(seeds);
  const hit = recsCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;

  const resolved = (await mapLimit(seeds, 4, async (s) => {
    if (s.id && /^\d+$/.test(String(s.id))) return { id: String(s.id), title: s.title, artist: s.artist };
    const want = norm(String(s.title).split(' - ').pop());
    const artist = norm(String(s.artist).split(',')[0]);
    if (!want) return null;
    const r = await scGet('/search/tracks', { q: `${s.artist} ${s.title}`.slice(0, 120), limit: 5 });
    const found = (r.collection || []).find((t) => {
      const hay = norm(`${t.title} ${(t.user && t.user.username) || ''} ${(t.publisher_metadata && t.publisher_metadata.artist) || ''}`);
      return hay.includes(want) && (!artist || hay.includes(artist));
    });
    return found ? { id: String(found.id), title: s.title, artist: s.artist } : null;
  })).filter(Boolean);
  if (!resolved.length) throw new Error(T('s.recommend.1'));

  const seedIds = new Set(resolved.map((s) => s.id));
  const scores = new Map();
  const lists = await mapLimit(resolved, 4, async (seed) => {
    const r = await scGet(`/tracks/${seed.id}/related`, { limit: 20 });
    return { seed, items: (r.collection || []).filter((t) => t && t.kind === 'track') };
  });
  for (const l of lists) {
    if (!l) continue;
    l.items.forEach((t, i) => {
      const id = String(t.id);
      if (seedIds.has(id)) return;
      const cur = scores.get(id) || { track: scMap(t), score: 0, because: `${l.seed.artist} — ${l.seed.title}` };
      cur.score += 1 + (20 - i) / 40;
      scores.set(id, cur);
    });
  }
  const tracks = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 150)
    .map((x) => ({ ...x.track, because: x.because }));
  const data = { tracks, seeds: resolved.length };
  recsCache.set(key, { at: Date.now(), data });
  return data;
}

// ---------- тексты песен (LRCLIB: открытая база, синхронные тексты) ----------
const LYR_DIR = path.join(DATA_DIR, 'lyrics');
try { fs.mkdirSync(LYR_DIR, { recursive: true }); } catch {}
async function lrclib(p, params) {
  const u = new URL('https://lrclib.net/api' + p);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': `nakazmusic/${VERSION} (personal music player)` }, signal: AbortSignal.timeout(12000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(T('s.lrclib.1', { status: r.status }));
  return r.json();
}
// чистим мусор из названий: feat., Remastered, Official Video, скобки, лишние пробелы
const JUNK_WORDS = 'feat|ft|featuring|prod|official|video|audio|lyrics?|visuali[sz]er|remaster(?:ed)?|clip|hd|hq|4k|explicit|премьера|клип|текст|слова'; // i18n-ignore: русские слова-мусор для очистки названий
const JUNK_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${JUNK_WORDS})(?![\\p{L}\\p{N}])`, 'iu');
const JUNK_TAIL_RE = new RegExp(`\\s+[-–—]\\s+[^-–—]*(?<![\\p{L}\\p{N}])(?:remaster(?:ed)?|official|video|audio|lyrics?|visuali[sz]er|version|mono|stereo|clip|клип)(?![\\p{L}\\p{N}]).*$`, 'iu'); // i18n-ignore: русские слова-мусор для очистки названий
function cleanTitle(s) {
  return String(s || '')
    .replace(/[_ ​]+/g, ' ')
    .replace(/\s*[([{][^)\]}]*[)\]}]/g, (m) => (JUNK_RE.test(m) || /\b(?:19|20)\d{2}\b/.test(m) ? '' : m))
    .replace(JUNK_TAIL_RE, '')
    .replace(/\s+(?:feat\.?|ft\.?|featuring)\s.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—|,.]+|[\s\-–—|,]+$/g, '')
    .trim();
}
const stripBrackets = (s) => s.replace(/\s*[([{][^)\]}]*[)\]}]/g, '').replace(/\s{2,}/g, ' ').trim();
// варианты (исполнитель, название) от самого точного к самому грубому
function lyricVariants(q) {
  const a1 = cleanTitle(String(q.artist || '').split(',')[0]);
  const a2 = cleanTitle(String(q.artist || '').split(/\s*(?:,|&|×|\/|\bfeat\.?|\bft\.?|\bx\b|\bи\b)\s*/i)[0]);
  const title = cleanTitle(q.title);
  const out = [], seen = new Set();
  const add = (artist, t) => {
    t = cleanTitle(t);
    const k = norm(artist) + '|' + norm(t);
    if (!t || seen.has(k)) return;
    seen.add(k);
    out.push({ artist: artist || '', title: t });
  };
  add(a1, title);
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const rest = parts.slice(1).join(' - ');
    if (a1 && norm(parts[0]) === norm(a1)) add(a1, rest);      // «Артист - Название» в названии
    else add(parts[0], rest);                                  // артист и название перепутаны местами
  }
  add(a2, title);
  add(cleanTitle(q.artist), title);                            // «Earth, Wind & Fire» целиком
  add(a1, stripBrackets(title));
  add('', title);                                              // последний шанс: только название
  return out;
}
const hasText = (x) => x && (x.syncedLyrics || x.plainLyrics || x.instrumental);
async function findLyrics(q) {
  const dur = Math.round((Number(q.duration) || 0) / 1000);
  const variants = lyricVariants(q);
  const main = variants[0] || { artist: '', title: '' };

  // подходящий по названию, исполнителю и длительности (±6 с), предпочитаем синхронный и ближайший по времени
  const pick = (list) => {
    const scored = (Array.isArray(list) ? list : []).filter(hasText)
      .filter((x) => variants.some((v) => {
        const a = norm(x.trackName), b = norm(v.title);
        if (!(a && b && (a.includes(b) || b.includes(a)))) return false;
        const who = norm(v.artist), got = norm(x.artistName);
        return !who || !got || got.includes(who) || who.includes(got);
      }))
      .map((x) => ({ x, d: dur && x.duration ? Math.abs(x.duration - dur) : 0 }))
      .filter((o) => !dur || !o.x.duration || o.d <= 6)
      .sort((a, b) => Math.round(a.d / 3) - Math.round(b.d / 3) || (b.x.syncedLyrics ? 1 : 0) - (a.x.syncedLyrics ? 1 : 0) || a.d - b.d);
    return scored.length ? scored[0].x : null;
  };

  if (q.album && dur && main.artist && main.title) {
    try { const r = await lrclib('/get', { track_name: main.title, artist_name: main.artist, album_name: q.album, duration: dur }); if (hasText(r)) return r; } catch (e) { log('lrclib get:', e.message); }
  }
  for (const v of variants) {
    const list = v.artist
      ? await lrclib('/search', { track_name: v.title, artist_name: v.artist })
      : await lrclib('/search', { q: `${main.artist} ${v.title}`.trim() });
    const hit = pick(list);
    if (hit) return hit;
  }
  return pick(await lrclib('/search', { q: `${main.artist} ${main.title}`.trim() }));
}
// ---------- Genius: тексты без таймингов, зато много андерграунда ----------
function splitArtists(s) {
  return String(s || '').split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bи\b|\/)\s*/i).map(norm).filter((a) => a.length > 1);
}
function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return Object.prototype.hasOwnProperty.call(named, e.toLowerCase()) ? named[e.toLowerCase()] : m;
  });
}
// конец <div>, который открывается на позиции start (с учётом вложенных div)
function divEnd(html, start) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) return re.lastIndex; }
    else depth++;
  }
  return -1;
}
function removeDivsWith(html, attr) {
  for (let guard = 0; guard < 50; guard++) {
    const i = html.indexOf(attr);
    if (i < 0) break;
    const start = html.lastIndexOf('<div', i);
    const end = start < 0 ? -1 : divEnd(html, start);
    if (start < 0 || end < 0) break;
    html = html.slice(0, start) + html.slice(end);
  }
  return html;
}
function geniusExtract(html) {
  const parts = [];
  let from = 0;
  for (let guard = 0; guard < 40; guard++) {
    const i = html.indexOf('data-lyrics-container="true"', from);
    if (i < 0) break;
    const start = html.lastIndexOf('<div', i);
    const end = divEnd(html, start);
    if (start < 0 || end < 0) break;
    let block = html.slice(html.indexOf('>', i) + 1, end - 6);
    block = removeDivsWith(block, 'data-exclude-from-selection="true"');
    block = block.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    parts.push(decodeEntities(block));
    from = end;
  }
  return parts.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
async function geniusLyrics(q) {
  const own = splitArtists(q.artist);
  const variants = lyricVariants(q).slice(0, 4).map((v) => ({ artists: v.artist && !own.some((a) => norm(v.artist).includes(a)) ? splitArtists(v.artist) : own, title: v.title }));

  for (const v of variants) {
    if (!v.title) continue;
    const query = `${v.artists[0] || ''} ${v.title}`.trim();
    const r = await fetch('https://genius.com/api/search/multi?per_page=5&q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(T('s.geniusLyrics.1', { status: r.status }));
    const j = await r.json();
    const hits = [];
    for (const sec of (j.response && j.response.sections) || []) {
      if (sec.type !== 'song' && sec.type !== 'top_hit') continue;
      for (const h of sec.hits || []) if (h.type === 'song' && h.result) hits.push(h.result);
    }
    const want = norm(v.title);
    const song = hits.find((s) => {
      const t = norm(s.title);
      const titleOk = t && want && (t === want || t.includes(want) || want.includes(t));
      const names = norm(`${s.artist_names || ''} ${(s.primary_artist && s.primary_artist.name) || ''}`);
      const artistOk = !v.artists.length || v.artists.some((a) => names.includes(a));
      return titleOk && artistOk && s.url && s.lyrics_state !== 'unreleased';
    });
    if (!song) continue;
    if (song.instrumental) return { instrumental: true, url: song.url, match: song.full_title || song.title };
    const page = await fetch(song.url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(15000) });
    if (!page.ok) throw new Error(T('s.geniusLyrics.2', { status: page.status }));
    const text = geniusExtract(await page.text());
    if (text) return { text, url: song.url, match: song.full_title || `${song.artist_names} — ${song.title}` };
  }
  return null;
}

// ---------- NetEase: синхронные тексты, особенно для азиатской и зарубежной музыки ----------
const NE_CREDIT_RE = /^\s*(作词|作曲|编曲|制作人?|混音|母带|词|曲|lyrics?|music|composer|arranger|producer|written)\s*[:：]/i;
async function neteaseLyrics(q) {
  const dur = Math.round((Number(q.duration) || 0) / 1000);
  const headers = { 'User-Agent': UA, Referer: 'https://music.163.com/' };
  for (const v of lyricVariants(q).slice(0, 3)) {
    if (!v.title) continue;
    const r = await fetch('https://music.163.com/api/search/get?type=1&limit=8&s=' + encodeURIComponent(`${v.artist} ${v.title}`.trim()), { headers, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(T('s.neteaseLyrics.1', { status: r.status }));
    const songs = ((await r.json()).result || {}).songs || [];
    const want = norm(v.title), who = norm(v.artist);
    const cand = songs
      .filter((s) => {
        const t = norm(s.name);
        const names = norm((s.artists || []).map((a) => a.name).join(' '));
        return t && want && (t.includes(want) || want.includes(t)) && (!who || !names || names.includes(who) || who.includes(names));
      })
      .map((s) => ({ s, d: dur && s.duration ? Math.abs(s.duration / 1000 - dur) : 0 }))
      .filter((o) => !dur || !o.s.duration || o.d <= 5)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { s } of cand) {
      const lr = await fetch(`https://music.163.com/api/song/lyric?id=${s.id}&lv=1&kv=1&tv=-1`, { headers, signal: AbortSignal.timeout(10000) });
      if (!lr.ok) continue;
      const lrc = (((await lr.json()).lrc) || {}).lyric || '';
      const lines = lrc.split(/\r?\n/).filter((l) => !NE_CREDIT_RE.test(l.replace(/\[[^\]]*\]/g, '')));
      const timed = lines.filter((l) => /^\[\d{1,3}:\d{1,2}/.test(l));
      const match = `${(s.artists || []).map((a) => a.name).join(', ')} — ${s.name}`;
      if (/纯音乐|instrumental/i.test(lrc) && timed.length < 3) return { instrumental: true, match };
      if (timed.length >= 4) return { synced: lines.join('\n'), match };
    }
  }
  return null;
}
// ---------- lyrics.ovh: запасной источник простого текста ----------
async function ovhLyrics(q) {
  for (const v of lyricVariants(q).filter((x) => x.artist && x.title).slice(0, 2)) {
    const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(v.artist)}/${encodeURIComponent(v.title)}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (r.status === 404) continue;
    if (!r.ok) throw new Error(T('s.ovhLyrics.1', { status: r.status }));
    const text = String((await r.json()).lyrics || '').replace(/\r\n?/g, '\n').replace(/^Paroles de la chanson[^\n]*\n+/i, '').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length > 40) return { plain: text, match: `${v.artist} — ${v.title}` };
  }
  return null;
}

// Порядок перебора. timed — источники с таймингами (ищем в них, пока не найдём синхронный текст);
// core — их недоступность не даёт запомнить «не найдено», запасные (optional) этого не влияют.
const LYRIC_SOURCES = [
  { id: 'lrclib', timed: true, core: true, run: async (q) => {
    const x = await findLyrics(q);
    return x && { synced: x.syncedLyrics || '', plain: x.plainLyrics || '', instrumental: !!x.instrumental, match: `${x.artistName || ''} — ${x.trackName || ''}` };
  } },
  { id: 'netease', timed: true, core: false, run: neteaseLyrics },
  { id: 'genius', timed: false, core: true, run: async (q) => {
    const g = await geniusLyrics(q);
    return g && { plain: g.text || '', instrumental: !!g.instrumental, url: g.url, match: g.match };
  } },
  { id: 'lyricsovh', timed: false, core: false, run: ovhLyrics },
];

const LRC_STAMP_RE = /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/;
function lyrKey(q) {
  const secs = Math.round((Number(q.duration) || 0) / 1000);
  return crypto.createHash('sha1').update(['v3', cleanTitle(String(q.artist || '').split(',')[0]), cleanTitle(q.title), secs].join('|').toLowerCase()).digest('hex');
}
function lyrKeyV2(q) {
  return crypto.createHash('sha1').update(['v2', q.artist, q.title, Math.round((Number(q.duration) || 0) / 1000)].join('|').toLowerCase()).digest('hex');
}

async function lyrics(q, refresh) {
  const file = path.join(LYR_DIR, lyrKey(q) + '.json');
  const cached = readJson(file, null);
  if (cached && cached.custom) return cached;   // свой текст не затираем автопоиском
  if (!refresh) {
    if (cached && (cached.found || Date.now() - cached.at < 3 * 864e5)) return cached;
    const old = readJson(path.join(LYR_DIR, lyrKeyV2(q) + '.json'), null);   // кэш прошлых версий
    if (old && old.found) return old;
  }

  let synced = null, plain = null, instr = null, coreErrors = 0, coreTotal = 0;
  for (const s of LYRIC_SOURCES) {
    if (synced) break;
    if (!s.timed && plain) continue;
    if (s.core) coreTotal++;
    let r = null;
    try { r = await s.run(q); } catch (e) { if (s.core) coreErrors++; log(s.id + ':', e.message); }
    if (!r) continue;
    const rec = { found: true, source: s.id, synced: r.synced || '', plain: r.plain || '', url: r.url, match: r.match || '' };
    if (r.synced) synced = rec;
    else if (r.plain) { if (!plain) plain = rec; }
    else if (r.instrumental && !instr) instr = { ...rec, instrumental: true };
  }
  let res = synced || plain || instr;
  if (!res) {
    if (coreErrors >= coreTotal) throw new Error(T('s.lyrics.1'));
    // если один из основных сервисов не ответил, «не найдено» не запоминаем
    if (coreErrors) return { found: false, at: Date.now() };
    res = { found: false };
  }
  res.at = Date.now();
  writeJson(file, res);
  return res;
}
function saveCustomLyrics(q, text) {
  const isLrc = (text.match(new RegExp(LRC_STAMP_RE, 'g')) || []).length >= 2;
  const plain = (isLrc ? text.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{1,2}(?:\.\d{1,3})?>/g, '') : text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const res = { found: true, custom: true, source: 'custom', synced: isLrc ? text : '', plain, match: T('s.saveCustomLyrics.1'), at: Date.now() };
  writeJson(path.join(LYR_DIR, lyrKey(q) + '.json'), res);
  return res;
}
function resetCustomLyrics(q) {
  const file = path.join(LYR_DIR, lyrKey(q) + '.json');
  const cur = readJson(file, null);
  if (cur && cur.custom) { try { fs.unlinkSync(file); } catch (e) { log(LT('l.resetCustomLyrics.1'), file, e); } }
}

// ---------- YouTube Music (через yt-dlp) ----------
// yt-dlp.exe лежит рядом с nakazmusic.exe (при запуске из исходников на уровень выше папки src)
function ytdlpExe() {
  const fromEnv = process.env.NAKAZMUSIC_YTDLP || process.env.SONARA_YTDLP;
  if (fromEnv && exists(fromEnv)) return fromEnv;
  for (const d of [BASE_DIR, path.dirname(BASE_DIR)]) {
    const f = path.join(d, 'yt-dlp.exe');
    if (exists(f)) return f;
  }
  return null;
}
const YT_DIR = IS_EXE ? BASE_DIR : path.dirname(BASE_DIR);
function ytFail(msg, status) { const e = new Error(msg); if (status) e.status = status; return e; }
// переводим ответы yt-dlp на человеческий язык
function ytError(raw) {
  const text = String(raw || '');
  const line = (text.split(/\r?\n/).reverse().find((l) => /ERROR/i.test(l)) || text.trim().split(/\r?\n/).pop() || T('s.ytError.1')).replace(/^.*?ERROR:\s*(\[[^\]]*\]\s*)?/i, '');
  if (/could not copy|database is locked|cookie/i.test(text)) return ytFail(T('s.ytError.2'), 502);
  if (/sign in|log in|login|private|members-only|confirm you.re not a bot/i.test(text)) return ytFail(T('s.ytError.3'), 403);
  if (/does not exist|not found|unavailable|404|HTTP Error 400|Bad Request/i.test(text)) return ytFail(T('s.ytError.4'), 404);
  return ytFail('YouTube: ' + line.slice(0, 220), 502);
}
function ytdlp(args, timeout = 120000) {
  const exe = ytdlpExe();
  if (!exe) return Promise.reject(ytFail(T('s.ytdlp.1'), 424));
  return new Promise((resolve, reject) => {
    trackKid(execFile(exe, args, { maxBuffer: 128 * 1024 * 1024, timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(err.killed ? ytFail(T('s.ytdlp.2'), 504) : ytError(stderr || err.message));
      resolve(stdout);
    }));
  });
}
const ytCookieArgs = (on) => (on ? ['--cookies-from-browser', 'brave'] : []);
// из ссылки на плейлист берём только id; LM это «Понравившиеся» (приватный, нужны cookies)
function ytListId(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (!/(^|\.)youtube\.com$/i.test(u.hostname) && u.hostname !== 'youtu.be') return null;
  const id = u.searchParams.get('list');
  return id && /^[\w-]{2,60}$/.test(id) ? id : null;
}
function ytMap(e, i, at) {
  const artist = String(e.uploader || e.channel || '').replace(/\s+-\s+Topic$/i, '').trim();
  let title = String(e.title || '').trim();
  // «Артист - Название» и «Название - Артист» в заголовке: лишнее убираем, артист уже отдельно
  const a = norm(artist);
  const m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m && a) {
    if (norm(m[1]) === a) title = m[2];
    else if (norm(m[2]).includes(a)) title = m[1];
  }
  return {
    src: 'yt', id: e.id, title: title || T('s.ytMap.1'), artist,
    url: `https://music.youtube.com/watch?v=${e.id}`,
    duration: e.duration ? Math.round(e.duration * 1000) : 0,
    ...ytThumbs(e.id),
    at: at - i * 1000,
  };
}
// миниатюра есть у любого ролика по id, поэтому не зависим от того, что вернул yt-dlp:
// mqdefault есть всегда (список, подбор цветов), hq720 бывает не у всех (только для большой обложки, страница откатывается сама)
function ytThumbs(id) {
  const mq = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  return { cover: mq, art: mq, big: `https://i.ytimg.com/vi/${id}/hq720.jpg` };
}
async function ytPlaylist(id, force, cookies) {
  const file = path.join(DATA_DIR, `yt-${id}.json`);
  const cached = readJson(file, null);
  if (!force && cached) return { ...cached, tracks: (cached.tracks || []).map((t) => ({ ...t, ...ytThumbs(t.id) })), cached: true };   // в старом кэше обложки были другими
  const out = await ytdlp(['--flat-playlist', '-J', '--no-warnings', '--ignore-errors', ...ytCookieArgs(cookies), `https://www.youtube.com/playlist?list=${id}`], 5 * 60 * 1000);
  let data;
  try { data = JSON.parse(out); } catch { throw ytFail(T('s.ytPlaylist.1'), 502); }
  const at = Date.now();
  const tracks = (data.entries || [])
    .filter((e) => e && /^[\w-]{11}$/.test(e.id || '') && e.title && !/^\[(private|deleted) video\]$/i.test(e.title))
    .map((e, i) => ytMap(e, i, at));
  const res = { at, name: String(data.title || '').slice(0, 80), tracks };
  writeJson(file, res);
  return res;
}
const ytUrls = new Map();   // id -> { url, at }: ссылка на звук живёт часов шесть, держим меньше
// Свежему yt-dlp для YouTube нужен JS-рантайм (deno, node или bun): без него клиент по умолчанию получает от YouTube
// «This video is not available» на многих роликах. Ищем рантайм на компьютере и отдаём его yt-dlp.
let jsRuntimeCache = { at: 0, val: null };
function findJsRuntime() {
  if (Date.now() - jsRuntimeCache.at < 60000) return jsRuntimeCache.val;
  const names = [['deno', 'deno.exe'], ['node', 'node.exe'], ['bun', 'bun.exe']];
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const pf = process.env.ProgramFiles, home = process.env.USERPROFILE;
  if (pf) dirs.push(path.join(pf, 'nodejs'));
  if (home) dirs.push(path.join(home, '.deno', 'bin'), path.join(home, '.bun', 'bin'));
  let val = null;
  for (const [name, file] of names) {
    for (const d of dirs) { const f = path.join(d, file); if (exists(f) && f !== process.execPath) { val = { name, path: f }; break; } }
    if (val) break;
  }
  jsRuntimeCache = { at: Date.now(), val };
  return val;
}
// Способы получить ссылку на звук, от самого надёжного. Клиент android отдаёт только готовый mp4 с картинкой и звуком (360p),
// зато работает без JS-рантайма; остальные клиенты нужны с рантаймом. Cookies Brave берём в последнюю очередь и только если разрешено.
let ytLastGood = '';
function ytPlan(useCookies) {
  const js = findJsRuntime();
  const jsArgs = js ? ['--js-runtimes', `${js.name}:${js.path}`] : [];
  const client = (c) => ['--extractor-args', `youtube:player_client=${c}`];
  const plan = [{ name: 'default', args: jsArgs, js: false }, { name: 'android', args: client('android') }, { name: 'mweb', args: [...jsArgs, ...client('mweb')], js: true },
    { name: 'tv_simply', args: [...jsArgs, ...client('tv_simply')], js: true }, { name: 'android_vr', args: [...jsArgs, ...client('android_vr')] }]
    .filter((p) => js || !p.js);
  const good = plan.findIndex((p) => p.name === ytLastGood);
  if (good > 0) plan.unshift(plan.splice(good, 1)[0]);   // сначала то, что сработало в прошлый раз
  if (useCookies) {
    plan.push({ name: 'cookies', args: [...ytCookieArgs(true), ...jsArgs] }, { name: 'cookies+mweb', args: [...ytCookieArgs(true), ...jsArgs, ...client('mweb')] });
  }
  return plan;
}
const ytInflight = new Map();
function ytStreamUrl(id, fresh, useCookies) {
  const hit = ytUrls.get(id);
  if (!fresh && hit && Date.now() - hit.at < 90 * 60 * 1000) return Promise.resolve(hit.url);
  const key = id + (useCookies ? ':c' : '');
  if (ytInflight.has(key)) return ytInflight.get(key);
  const job = (async () => {
    const failed = [];
    for (const step of ytPlan(useCookies)) {
      try {
        const out = await ytdlp([...step.args, '-f', 'bestaudio[ext=m4a]/bestaudio/best', '-g', '--no-playlist', '--no-warnings', `https://www.youtube.com/watch?v=${id}`], 45000);
        const url = out.trim().split(/\r?\n/)[0];
        if (!/^https:\/\/[^/]+\.googlevideo\.com\//i.test(url)) throw new Error(T('s.ytStreamUrl.1'));
        if (ytLastGood !== step.name) log(LT('l.ytStreamUrl.1', { id: id, name: step.name }));
        ytLastGood = step.name;
        ytUrls.set(id, { url, at: Date.now() });
        if (ytUrls.size > 60) ytUrls.delete(ytUrls.keys().next().value);
        return url;
      } catch (e) {
        if (e.status === 424) throw e;   // нет yt-dlp: перебирать нечего
        failed.push(step.name);
        log(LT('l.ytStreamUrl.2', { id: id, name: step.name, message: e.message }));
      }
    }
    throw ytFail(T('s.ytStreamUrl.2', { p1: failed.join(', ') }), 502);
  })();
  ytInflight.set(key, job);
  job.then(() => ytInflight.delete(key), () => ytInflight.delete(key));
  return job;
}// звук отдаём со своего адреса: добавляем нужные заголовки и поддерживаем перемотку (Range)
async function ytAudio(req, res, id, useCookies) {
  const ac = new AbortController();
  res.on('close', () => ac.abort());
  const go = async (fresh) => {
    const headers = { 'User-Agent': UA };
    if (req.headers.range) headers.Range = req.headers.range;
    return fetch(await ytStreamUrl(id, fresh, useCookies), { headers, signal: ac.signal });
  };
  let r = await go(false);
  if (r.status === 403 || r.status === 410 || r.status === 404) r = await go(true);   // ссылка протухла
  if (!r.ok && r.status !== 206) throw ytFail(T('s.ytAudio.1', { status: r.status }), 502);
  const h = { 'Content-Type': r.headers.get('content-type') || 'audio/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  for (const k of ['content-length', 'content-range']) if (r.headers.get(k)) h[k] = r.headers.get(k);
  res.writeHead(r.status, h);
  Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
}
// скачивание yt-dlp.exe с официального релиза, с проверкой SHA-256 из файла сумм того же релиза
async function ytdlpInstall() {
  const gh = { headers: { 'User-Agent': 'nakazmusic', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) };
  const rel = await (await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', gh)).json();
  const assets = Array.isArray(rel.assets) ? rel.assets : [];
  const exeAsset = assets.find((a) => a.name === 'yt-dlp.exe'), sumAsset = assets.find((a) => a.name === 'SHA2-256SUMS');
  const okUrl = (a) => a && /^https:\/\/github\.com\/yt-dlp\/yt-dlp\/releases\/download\//.test(a.browser_download_url || '');
  if (!okUrl(exeAsset) || !okUrl(sumAsset)) throw ytFail(T('s.ytdlpInstall.1'), 502);
  // уже стоит последняя версия: ничего не качаем
  if (ytdlpExe()) { let cur = ''; try { cur = (await ytdlp(['--version'], 15000)).trim(); } catch {} if (cur && cur === String(rel.tag_name || '')) return { version: cur, path: ytdlpExe(), updated: false }; }
  const sums = await (await fetch(sumAsset.browser_download_url, gh)).text();
  let want = '';
  for (const l of sums.split(/\r?\n/)) { const m = l.trim().match(/^([0-9a-f]{64})\s+\*?(\S+)$/i); if (m && m[2] === 'yt-dlp.exe') want = m[1].toLowerCase(); }
  if (!want) throw ytFail(T('s.ytdlpInstall.2'), 502);
  const r = await fetch(exeAsset.browser_download_url, { headers: { 'User-Agent': 'nakazmusic' }, signal: AbortSignal.timeout(5 * 60 * 1000) });
  if (!r.ok) throw ytFail(T('s.ytdlpInstall.3', { status: r.status }), 502);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1e6 || buf.length > 90e6) throw ytFail(T('s.ytdlpInstall.4'), 502);
  if (crypto.createHash('sha256').update(buf).digest('hex') !== want) throw ytFail(T('s.ytdlpInstall.5'), 502);
  const dest = path.join(YT_DIR, 'yt-dlp.exe'), tmp = dest + '.part';
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, dest);
  ytUrls.clear();
  log(LT('l.ytdlpInstall.1'), rel.tag_name);
  return { version: String(rel.tag_name || ''), path: dest, updated: true };
}

// ---------- глобальный поиск по SoundCloud и YouTube Music ----------
const searchCache = new Map();
async function searchTracks(src, q) {
  const key = src + '|' + q.toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < 120000) return hit.tracks;
  let tracks;
  if (src === 'sc') {
    const r = await scGet('/search/tracks', { q, limit: 25 });
    tracks = ((r && r.collection) || []).filter((t) => t && t.kind === 'track' && t.title).map((t) => scMap(t));
  } else {
    // ytsearch20: yt-dlp ищет по YouTube; длинные миксы и подкасты (дольше 20 минут) отбрасываем
    const out = await ytdlp(['--flat-playlist', '-J', '--no-warnings', `ytsearch20:${q}`], 25000);
    let data;
    try { data = JSON.parse(out); } catch { throw ytFail(T('s.searchTracks.1'), 502); }
    tracks = (data.entries || [])
      .filter((e) => e && /^[\w-]{11}$/.test(e.id || '') && e.title && (!e.duration || e.duration <= 1200))
      .map((e, i) => ({ ...ytMap(e, i, 0), at: 0 }));
  }
  searchCache.set(key, { at: Date.now(), tracks });
  if (searchCache.size > 60) searchCache.delete(searchCache.keys().next().value);
  return tracks;
}

// ---------- резервные копии библиотеки ----------
// Лайки и плейлисты живут в окне плеера, поэтому JSON копии собирает страница, а сюда присылает на запись.
// Папка Документы\nakazmusic\backup; автокопии (файлы с -auto) храним последние 5, ручные не трогаем.
// ---------- проверка обновлений ----------
// Репозиторий GitHub с релизами задаётся ТОЛЬКО здесь, в формате «владелец/репозиторий».
const UPDATE_REPO = 'nakazueq/nakazmusic';
const UPDATE_EVERY = 24 * 3600e3;
const updateRepoOk = () => /^[\w.-]+\/[\w.-]+$/.test(UPDATE_REPO) && !/^OWNER\//.test(UPDATE_REPO);
function verParts(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+(?:\.\d+){0,3})/);
  return m ? m[1].split('.').map(Number) : null;
}
function verNewer(a, b) {
  const x = verParts(a), y = verParts(b);
  if (!x || !y) return false;
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
  return false;
}
let updateBusy = false;
// Обычный GET публичной страницы релиза: ни токенов, ни данных пользователя, в запросе только версия программы
async function updateCheck(force) {
  if (!updateRepoOk() || updateBusy) return;
  if (!force && (config.updateCheck === false || Date.now() - (config.updateCheckAt || 0) < UPDATE_EVERY)) return;
  updateBusy = true;
  try {
    const r = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { 'User-Agent': `nakazmusic/${VERSION}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(T('s.updateCheck.1') + r.status);
    const j = await r.json();
    const tag = String(j.tag_name || '');
    const url = String(j.html_url || '');
    if (!verParts(tag) || !url.startsWith(`https://github.com/${UPDATE_REPO}/`)) throw new Error(T('s.updateCheck.2'));
    config.updateCheckAt = Date.now();
    config.updateLatest = { tag: tag.slice(0, 40), url };
    delete config.updateError;
  } catch (e) {
    config.updateError = String(e.message || e).slice(0, 120);
    config.updateCheckAt = Date.now() - UPDATE_EVERY + 3600e3;   // при сбое повторим через час
    log(LT('l.updateCheck.1'), config.updateError);
  } finally { updateBusy = false; writeJson(CONFIG_FILE, config); }
}
function updateStatus() {
  const l = config.updateLatest;
  return { enabled: config.updateCheck !== false, repoSet: updateRepoOk(), current: VERSION, checkedAt: config.updateCheckAt || 0, error: config.updateError || '', latest: l && verNewer(l.tag, VERSION) ? l : null };
}

const BACKUP_KEEP = 5;
const BACKUP_FILE_RE = /^(?:nakazmusic|sonara)-backup-\d{4}-\d{2}-\d{2}_\d{4}(-auto)?\.json$/;   // копии прежних версий называются sonara-backup-…
// папка в Документах: прежние версии писали в Документы\Sonara, переносим её на новое имя целиком, чтобы копии и темы не потерялись
function docsRoot() {
  const docs = path.join(require('os').homedir(), 'Documents'), now = path.join(docs, 'nakazmusic'), old = path.join(docs, 'Sonara');
  try { if (!fs.existsSync(now) && fs.existsSync(old)) fs.renameSync(old, now); } catch {}
  return fs.existsSync(now) || !fs.existsSync(old) ? now : old;
}
function backupDir(sub) {
  let dir = path.join(docsRoot(), 'backup');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { dir = path.join(DATA_DIR, 'backup'); fs.mkdirSync(dir, { recursive: true }); }
  if (sub) { dir = path.join(dir, sub); fs.mkdirSync(dir, { recursive: true }); }
  return dir;
}
function backupList() {
  const dir = backupDir();
  return fs.readdirSync(dir).filter((f) => BACKUP_FILE_RE.test(f)).map((f) => {
    const st = fs.statSync(path.join(dir, f));
    return { name: f, size: st.size, at: Math.round(st.mtimeMs), auto: /-auto\.json$/.test(f) };
  }).sort((a, b) => b.at - a.at);
}
function backupSave(json, auto) {
  if (typeof json !== 'string' || json.length > 40e6) throw ytFail(T('s.backupSave.1'), 413);
  let doc = null;
  try { doc = JSON.parse(json); } catch {}
  if (!doc || (doc.format !== 'nakazmusic-backup' && doc.format !== 'sonara-backup')) throw ytFail(T('s.backupSave.2'), 400);
  const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
  const dir = backupDir();
  const name = `nakazmusic-backup-${stamp}${auto ? '-auto' : ''}.json`;
  fs.writeFileSync(path.join(dir, name), json);
  config.backupAt = Date.now();
  writeJson(CONFIG_FILE, config);
  if (auto) for (const f of backupList().filter((x) => x.auto).slice(BACKUP_KEEP)) { try { fs.unlinkSync(path.join(dir, f.name)); } catch (e) { log(LT('l.backupSave.1'), f.name, e.message); } }
  return { name, dir };
}
const m3uSafe = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
function m3uWrite(playlists) {
  const dir = backupDir('m3u');
  const files = [];
  let tracks = 0;
  for (const pl of playlists.slice(0, 300)) {
    const base = String(pl.name || '').replace(/[^\p{L}\p{N} _.()-]+/gu, '').trim().slice(0, 60) || 'playlist';
    let file = path.join(dir, base + '.m3u8');
    for (let i = 2; files.includes(file) && i < 100; i++) file = path.join(dir, `${base} (${i}).m3u8`);
    const lines = ['#EXTM3U', '#PLAYLIST:' + m3uSafe(pl.name)];
    for (const t of (Array.isArray(pl.tracks) ? pl.tracks : []).slice(0, 50000)) {
      let loc = '';
      if (t.src === 'sp' && /^[A-Za-z0-9]{10,30}$/.test(t.id || '')) loc = `https://open.spotify.com/track/${t.id}`;
      else if (t.src === 'yt' && /^[\w-]{11}$/.test(t.id || '')) loc = `https://music.youtube.com/watch?v=${t.id}`;
      else if (t.src === 'sc' && /^https:\/\/(www\.)?soundcloud\.com\//i.test(t.url || '')) loc = t.url;
      else if (t.src === 'local') loc = localLib.file(String(t.id || '')) || '';
      if (!loc || /[\r\n]/.test(loc)) continue;
      const sec = Math.round((Number(t.duration) || 0) / 1000);
      lines.push(`#EXTINF:${sec > 0 ? sec : -1},${m3uSafe([t.artist, t.title].filter(Boolean).join(' - '))}`, loc);
      tracks++;
    }
    fs.writeFileSync(file, lines.join('\r\n') + '\r\n', 'utf8');
    files.push(file);
  }
  return { dir, files: files.length, tracks };
}

// ---------- обложки для подбора цветов ----------
// Страница читает пиксели обложки через canvas, а картинки Spotify и SoundCloud чужие и без CORS,
// поэтому отдаём их с нашего адреса. Только https и только хосты CDN обложек, остальное не качаем.
const ART_HOST_RE = /(^|\.)(scdn\.co|spotifycdn\.com|sndcdn\.com|ytimg\.com|ggpht\.com|googleusercontent\.com)$/i;
const artCache = new Map();
async function fetchArt(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch { const e = new Error('bad url'); e.status = 400; throw e; }
  if (u.protocol !== 'https:' || u.port || !ART_HOST_RE.test(u.hostname)) { const e = new Error('host not allowed'); e.status = 403; throw e; }
  const hit = artCache.get(u.href);
  if (hit) return hit;
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!r.ok) { const e = new Error(T('s.fetchArt.1', { status: r.status })); e.status = 502; throw e; }
  const type = String(r.headers.get('content-type') || '');
  if (!/^image\//i.test(type)) { const e = new Error('not an image'); e.status = 415; throw e; }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) { const e = new Error('too large'); e.status = 413; throw e; }
  const art = { type, buf };
  artCache.set(u.href, art);
  if (artCache.size > 40) artCache.delete(artCache.keys().next().value);
  return art;
}

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};
const staticCache = new Map();
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error(T('s.readBody.1'))); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const SC_USER_RE = /^[\w\-.]{1,100}$/;

const server = http.createServer(async (req, res) => {
  let u;
  try { u = new URL(req.url, URL_APP); } catch { return send(res, 400, { error: 'bad url' }); }
  const p = u.pathname;
  // защита от DNS-rebinding и чужих сайтов: обслуживаем только запросы к своему адресу, и API не отвечает на cross-site запросы
  const hostHdr = String(req.headers.host || '').toLowerCase();
  if (hostHdr !== `127.0.0.1:${PORT}` && hostHdr !== `localhost:${PORT}`) return send(res, 403, { error: 'forbidden' });
  if (p.startsWith('/api/') && !sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  if (!(p === '/api/ping' && u.searchParams.get('probe'))) touch();

  try {
    if (p === '/api/ping') return send(res, 200, { app: APP_ID, version: VERSION, seen: lastSeen > 0 });
    if (p === '/api/bye') {
      if (IS_EXE && !native) { if (byeTimer) clearTimeout(byeTimer); byeTimer = setTimeout(() => shutdown(T('s.top.1')), 12000); }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/info') return send(res, 200, { version: VERSION, logFile: LOG_FILE, dataDir: DATA_DIR, native: !!native, hostname: require('os').hostname() });
    // команды окну: только от нашей страницы (свой заголовок не даст чужим сайтам их дёрнуть)
    if (p === '/api/local/file' || p === '/api/local/cover') {
      if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
      const id = u.searchParams.get('id') || '';
      if (!localLib.file(id) && localFolders().length) localScan();
      const file = localLib.file(id);
      if (!file) return send(res, 404, { error: T('s.top.2') });
      if (p === '/api/local/file') return serveFile(req, res, file, AUDIO_MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
      const pic = localCover(id);
      if (!pic) return send(res, 404, { error: T('s.top.3') });
      res.writeHead(200, { 'Content-Type': pic.mime, 'Cache-Control': 'max-age=86400' });
      return res.end(pic.data);
    }
    if (p === '/api/events') {
      if (u.searchParams.get('key') !== SSE_KEY) return send(res, 403, { error: 'forbidden' });
      const role = u.searchParams.get('role') === 'mini' ? 'mini' : 'main';
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      const client = { res, role };
      sseClients.add(client);
      if (role === 'mini' && nowState) res.write(`event: state\ndata: ${JSON.stringify(nowState)}\n\n`);
      const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch {} }, 15000);
      req.on('close', () => { clearInterval(ka); sseClients.delete(client); });
      return;
    }
    if (p.startsWith('/api/app/')) {
      if (req.headers['x-player'] !== '1') return send(res, 403, { error: 'forbidden' });
      if (p === '/api/app/key') return send(res, 200, { key: SSE_KEY, native: !!native, tray: !!tray });
      if (p === '/api/app/local' && req.method === 'GET') {
        if (u.searchParams.get('force') === '1' || !localLib.scannedAt) localScan();
        return send(res, 200, { folders: localFolders(), tracks: localLib.tracks, native: !!native });
      }
      if (p === '/api/app/local/add' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)) || '{}');
        const dir = String(b.path || '').trim().replace(/^"|"$/g, '');
        let ok = false;
        try { ok = !!dir && fs.statSync(dir).isDirectory(); } catch {}
        if (!ok) return send(res, 400, { error: T('s.top.4') });
        const list = localFolders();
        if (!list.some((x) => x.toLowerCase() === path.resolve(dir).toLowerCase())) { list.push(path.resolve(dir)); config.localFolders = list; writeJson(CONFIG_FILE, config); }
        localScan();
        return send(res, 200, { folders: localFolders(), tracks: localLib.tracks });
      }
      if (p === '/api/app/local/remove' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)) || '{}');
        config.localFolders = localFolders().filter((x) => x !== b.path);
        writeJson(CONFIG_FILE, config);
        localScan();
        return send(res, 200, { folders: localFolders(), tracks: localLib.tracks });
      }
      if (p === '/api/app/local/pick' && req.method === 'POST') {
        if (!native) return send(res, 400, { error: T('s.top.5') });
        let files = [];
        try {
          files = native.win.openFileDialog({ multiple: true, title: T('s.top.6'), filters: [{ name: T('s.top.7'), extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'aac'] }] }) || [];
        } catch (e) { log(LT('l.top.1'), e); return send(res, 500, { error: T('s.top.8') }); }
        const list = localFolders();
        for (const f of files) {
          const dir = path.dirname(f);
          if (!list.some((x) => x.toLowerCase() === dir.toLowerCase())) list.push(dir);
        }
        config.localFolders = list; writeJson(CONFIG_FILE, config);
        if (files.length) localScan();
        return send(res, 200, { folders: localFolders(), tracks: localLib.tracks, picked: files.length });
      }
      if (p === '/api/app/play-log' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)) || '{}');
        if (b && b.t && b.t.id) {
          const t = {}; for (const k of ['src', 'id', 'uri', 'url', 'title', 'artist', 'album', 'cover', 'art', 'big', 'duration', 'hasPicture']) if (b.t[k] != null) t[k] = b.t[k];
          try { fs.appendFileSync(PLAYS_FILE, JSON.stringify({ at: Number(b.at) || Date.now(), ms: Math.round(Number(b.ms) || 0), t }) + '\n'); } catch (e) { log(LT('l.top.2'), e.message); }
        }
        return send(res, 200, { ok: true });
      }
      if (p === '/api/app/stats') return send(res, 200, statsFor(u.searchParams.get('range') || 'week'));
      if (p === '/api/app/discord') {
        if (req.method === 'POST') {
          const b = JSON.parse((await readBody(req)) || '{}');
          config.discordOn = !!b.on; config.discordId = String(b.id || '').trim();
          writeJson(CONFIG_FILE, config);
          discord.configure(config.discordOn, config.discordId);
          if (nowState) discord.update(nowState);
          await new Promise((r) => setTimeout(r, 700));
        }
        return send(res, 200, { on: !!config.discordOn, id: config.discordId || '', status: discord.status });
      }
      if (p === '/api/app/state' && req.method === 'POST') {
        nowState = JSON.parse((await readBody(req)) || '{}');
        discord.update(nowState);
        sseSend('mini', 'state', nowState);
        updateTray();
        mediaKeysApply();
        return send(res, 200, { ok: true });
      }
      if (p === '/api/app/cmd' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)) || '{}');
        if (b.cmd === 'expand') closeMini(true);
        else if (b.cmd === 'mini-close') closeMini(false);
        else if (b.cmd === 'mini-hide') { if (mini) { try { mini.win.setMinimized(true); } catch {} } }
        else sseSend('main', 'cmd', { cmd: String(b.cmd || ''), value: b.value });
        return send(res, 200, { ok: true });
      }
      if (p === '/api/app/theme/export' && req.method === 'POST') {
        // файл темы кладём в Документы\nakazmusic\themes и показываем в проводнике
        const b = JSON.parse((await readBody(req)) || '{}');
        const json = String(b.json || '');
        let doc = null;
        try { doc = JSON.parse(json); } catch {}
        if (!doc || (doc.format !== 'nakazmusic-theme' && doc.format !== 'sonara-theme') || json.length > 300000) return send(res, 400, { error: T('s.top.9') });
        const base = String(b.name || '').replace(/[^\p{L}\p{N} _.-]+/gu, '').trim().slice(0, 50) || 'theme';
        let dir = path.join(docsRoot(), 'themes');
        try { fs.mkdirSync(dir, { recursive: true }); } catch { dir = path.join(DATA_DIR, 'themes'); fs.mkdirSync(dir, { recursive: true }); }
        let file = path.join(dir, base + '.nakazmusic-theme.json');
        for (let i = 2; fs.existsSync(file) && i < 100; i++) file = path.join(dir, `${base} (${i}).nakazmusic-theme.json`);
        fs.writeFileSync(file, json);
        if (IS_WIN && process.env.NAKAZMUSIC_NO_REVEAL !== '1') { try { spawn('explorer.exe', ['/select,' + file], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { log(LT('l.top.3'), e.message); } }
        return send(res, 200, { ok: true, path: file });
      }
      if (p === '/api/app/update/status') return send(res, 200, updateStatus());
      if (p === '/api/app/update/check' && req.method === 'POST') { await updateCheck(true); return send(res, 200, updateStatus()); }
      if (p === '/api/app/update/open' && req.method === 'POST') {
        const l = updateStatus().latest;
        if (!l) return send(res, 404, { error: T('s.top.10') });
        if (process.env.NAKAZMUSIC_NO_REVEAL !== '1') openExternal(l.url);
        return send(res, 200, { ok: true, url: l.url });
      }
      if (p === '/api/app/backup/status') {
        return send(res, 200, { dir: backupDir(), auto: config.autoBackup !== false, lastAt: config.backupAt || 0, keep: BACKUP_KEEP, files: backupList().slice(0, 12) });
      }
      if (p === '/api/app/backup/save' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 45e6)) || '{}');
        return send(res, 200, backupSave(b.json, !!b.auto));
      }
      if (p === '/api/app/backup/file') {
        const name = String(u.searchParams.get('name') || '');
        if (!BACKUP_FILE_RE.test(name)) return send(res, 400, { error: T('s.top.11') });
        const file = path.join(backupDir(), name);
        if (!fs.existsSync(file) || fs.statSync(file).size > 40e6) return send(res, 404, { error: T('s.top.12') });
        return send(res, 200, fs.readFileSync(file, 'utf8'), 'application/json; charset=utf-8');
      }
      if (p === '/api/app/backup/m3u' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req, 45e6)) || '{}');
        if (!Array.isArray(b.playlists) || !b.playlists.length) return send(res, 400, { error: T('s.top.13') });
        return send(res, 200, m3uWrite(b.playlists));
      }
      if (p === '/api/app/backup/reveal' && req.method === 'POST') {
        const dir = backupDir();
        if (IS_WIN && process.env.NAKAZMUSIC_NO_REVEAL !== '1') { try { spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref(); } catch (e) { log(LT('l.top.4'), e.message); } }
        return send(res, 200, { ok: true, dir });
      }
      if (p === '/api/app/ytdlp/install' && req.method === 'POST') return send(res, 200, await ytdlpInstall());
      if (p === '/api/app/art') {
        const a = await fetchArt(u.searchParams.get('u'));
        res.writeHead(200, { 'Content-Type': a.type, 'Cache-Control': 'private, max-age=86400' });
        return res.end(a.buf);
      }
      if (p === '/api/app/fullscreen' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)) || '{}');
        if (native) { try { native.win.setFullscreen(b.on ? native.wv.FullscreenType.Borderless : null); } catch (e) { log(LT('l.top.5'), e.message); } }
        return send(res, 200, { ok: true, native: !!native });
      }
      if (p === '/api/app/mini' && req.method === 'POST') { openMini(); return send(res, 200, { ok: true, native: !!native }); }
      if (p === '/api/app/settings' && req.method === 'POST') {
        const b = JSON.parse((await readBody(req)) || '{}');
        if (typeof b.closeToTray === 'boolean' && config.closeToTray !== b.closeToTray) { config.closeToTray = b.closeToTray; writeJson(CONFIG_FILE, config); }
        if (b.lang === 'ru' || b.lang === 'en') {
          if (config.lang !== b.lang) { config.lang = b.lang; writeJson(CONFIG_FILE, config); }
          if (I18.setLang(b.lang)) { trayKey = ''; updateTray(); }   // меню трея сразу на новом языке
        }
        if (typeof b.autoBackup === 'boolean' && (config.autoBackup !== false) !== b.autoBackup) { config.autoBackup = b.autoBackup; writeJson(CONFIG_FILE, config); }
        if (typeof b.updateCheck === 'boolean' && (config.updateCheck !== false) !== b.updateCheck) { config.updateCheck = b.updateCheck; writeJson(CONFIG_FILE, config); if (b.updateCheck) updateCheck(false); }
        if (typeof b.mediaKeys === 'boolean' && (config.mediaKeys !== false) !== b.mediaKeys) { config.mediaKeys = b.mediaKeys; writeJson(CONFIG_FILE, config); mediaKeys.starts = 0; mediaKeysApply(); }
        return send(res, 200, { ok: true });
      }
      if (p === '/api/app/spotify-installed') return send(res, 200, { installed: await spotifyInstalled() });
      if (p === '/api/app/mediakeys') {
        return send(res, 200, { enabled: config.mediaKeys !== false, ...mediaKeys.status() });
      }
      if (p === '/api/app/store') {
        if (req.method === 'GET') { res.setHeader('X-Safe-Css', SAFE_CSS ? '1' : '0'); return send(res, 200, readStore()); }
        if (req.method !== 'POST') return send(res, 405, { error: 'method' });
        const patch = JSON.parse((await readBody(req)) || '{}');
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return send(res, 400, { error: T('s.top.14') });
        const store = readStore();
        for (const [k, v] of Object.entries(patch)) {
          if (!STORE_KEYS.has(k)) continue;
          if (v == null) delete store[k]; else store[k] = String(v);
        }
        const tmp = STORE_FILE + '.tmp';
        try { fs.writeFileSync(tmp, JSON.stringify(store)); fs.renameSync(tmp, STORE_FILE); } catch (e) { log(LT('l.top.6'), e); }
        return send(res, 200, { ok: true });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'method' });
      if (p === '/api/app/focus') { focusApp(); return send(res, 200, { ok: true }); }
      if (p === '/api/app/theme') { setWindowTheme(u.searchParams.get('mode') === 'dark' ? 'dark' : 'light'); return send(res, 200, { ok: true }); }
      if (p === '/api/app/spotify-launch') { launchSpotifyApp(); return send(res, 200, { ok: true }); }
      if (p === '/api/app/sp-session') {
        const b = JSON.parse((await readBody(req)) || '{}');
        spSession = { token: String(b.token || ''), device: String(b.device || ''), playing: !!b.playing };
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'not found' });
    }
    if (p === '/api/sc/likes') {
      const user = (u.searchParams.get('user') || '').trim();
      if (!SC_USER_RE.test(user)) return send(res, 400, { error: T('s.top.15') });
      return send(res, 200, await scLikes(user, u.searchParams.get('force') === '1'));
    }
    if (p === '/api/search') {
      const src = u.searchParams.get('src');
      const q = String(u.searchParams.get('q') || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 120);
      if (src !== 'sc' && src !== 'yt') return send(res, 400, { error: T('s.top.16') });
      if (!q) return send(res, 400, { error: T('s.top.17') });
      const t0 = Date.now();
      try {
        const tracks = await searchTracks(src, q);
        log(LT('l.top.7', { src: src, q: q, length: tracks.length, p4: Date.now() - t0 }));
        return send(res, 200, { tracks });
      } catch (e) { log(LT('l.top.8', { src: src, q: q, p3: Date.now() - t0 }), e.message); throw e; }
    }
    if (p === '/api/yt/status') {
      const exe = ytdlpExe();
      let version = '';
      if (exe) { try { version = (await ytdlp(['--version'], 15000)).trim(); } catch {} }
      const js = findJsRuntime();
      return send(res, 200, { installed: !!exe, version, brave: !!(await findBrowser('brave')), js: js ? js.name : null });
    }
    if (p === '/api/yt/playlist') {
      const id = ytListId('https://www.youtube.com/playlist?list=' + encodeURIComponent(u.searchParams.get('list') || ''));
      if (!id) return send(res, 400, { error: T('s.top.18') });
      return send(res, 200, await ytPlaylist(id, u.searchParams.get('force') === '1', u.searchParams.get('cookies') === '1'));
    }
    if (p === '/api/yt/parse') {
      const id = ytListId(u.searchParams.get('url'));
      if (!id) return send(res, 400, { error: T('s.top.19') });
      return send(res, 200, { id });
    }
    if (p === '/api/yt/stream' || p === '/api/yt/audio') {
      const id = u.searchParams.get('id') || '';
      if (!/^[\w-]{11}$/.test(id)) return send(res, 400, { error: 'bad id' });
      if (p === '/api/yt/audio') return await ytAudio(req, res, id, u.searchParams.get('cookies') === '1');
      await ytStreamUrl(id, false, u.searchParams.get('cookies') === '1');
      return send(res, 200, { ok: true });
    }
    if (p === '/api/sc/stream') {
      const id = u.searchParams.get('id') || '';
      if (!/^\d+$/.test(id)) return send(res, 400, { error: 'bad id' });
      return send(res, 200, await scStream(id));
    }
    if (p === '/api/lyrics') {
      const q = {
        artist: (u.searchParams.get('artist') || '').slice(0, 200),
        title: (u.searchParams.get('title') || '').slice(0, 300),
        album: (u.searchParams.get('album') || '').slice(0, 300),
        duration: Number(u.searchParams.get('duration')) || 0,
      };
      if (!q.title) return send(res, 400, { error: T('s.top.20') });
      return send(res, 200, await lyrics(q, u.searchParams.get('refresh') === '1'));
    }
    if (p === '/api/lyrics/custom' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const q = {
        artist: String(body.artist || '').slice(0, 200),
        title: String(body.title || '').slice(0, 300),
        duration: Number(body.duration) || 0,
      };
      if (!q.title) return send(res, 400, { error: T('s.top.21') });
      if (body.reset) { resetCustomLyrics(q); return send(res, 200, await lyrics(q, true)); }
      const text = String(body.text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
      if (!text) return send(res, 400, { error: T('s.top.22') });
      return send(res, 200, saveCustomLyrics(q, text));
    }
    if (p === '/api/recs' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const seeds = (Array.isArray(body.seeds) ? body.seeds : []).slice(0, 20)
        .map((s) => ({ id: s.id ? String(s.id) : '', title: String(s.title || '').slice(0, 200), artist: String(s.artist || '').slice(0, 200) }))
        .filter((s) => s.id || s.title);
      if (!seeds.length) return send(res, 400, { error: T('s.top.23') });
      return send(res, 200, await recommend(seeds));
    }
    if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });
  } catch (e) {
    log(LT('l.top.9'), p, e.message);
    if (res.headersSent) return res.destroy();
    if (e instanceof SyntaxError) return send(res, 400, { error: T('s.top.24') });
    // нет интернета или сайт молчит: вместо английского «fetch failed» говорим понятно
    const code = String((e.cause && e.cause.code) || e.code || '');
    if (e.name === 'TimeoutError' || e.name === 'AbortError' || /^(ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|UND_ERR_)/.test(code) || e.message === 'fetch failed') {
      return send(res, 504, { error: T('s.top.25') });
    }
    return send(res, e.status && e.status < 500 ? e.status : 500, { error: e.message || T('s.top.26') });
  }

  // статика; /callback — возврат после входа в Spotify
  const rel = p === '/' || p === '/callback' ? '/index.html' : p === '/mini' ? '/mini.html' : p;
  const file = path.normalize(path.join(PUB, rel));
  if (!file.startsWith(PUB + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  let buf = staticCache.get(file);
  if (!buf) {
    try { buf = fs.readFileSync(file); } catch { return send(res, 404, 'Not found', 'text/plain'); }
    if (IS_EXE) staticCache.set(file, buf);
  }
  send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
});

server.on('error', async (e) => {
  if (e.code === 'EADDRINUSE') {
    log(LT('l.top.10', { PORT: PORT }));
    process.exit(1);
  }
  log(LT('l.top.11'), e);
  process.exit(1);
});

// Иногда окно не открывается (WebView2 завис при старте). Если за 10 секунд страница не обратилась к серверу ни разу,
// перезапускаем программу (до двух раз), а если и это не помогло, открываем плеер в браузере.
const RESTARTS = Number(process.env.NAKAZMUSIC_RESTARTS) || 0;
function relaunch() {
  log(LT('l.relaunch.1', { p1: RESTARTS + 1 }));
  try {
    spawn(process.execPath, IS_EXE ? process.argv.slice(2) : process.argv.slice(1), { detached: true, stdio: 'ignore', env: { ...process.env, NAKAZMUSIC_RESTARTS: String(RESTARTS + 1) } }).unref();
  } catch (e) { log(LT('l.relaunch.2'), e); return false; }
  shuttingDown = true;
  try { mediaKeys.stop(); } catch {}
  killKids();
  setTimeout(() => process.exit(0), 200);
  return true;
}
// сторож в отдельном процессе: если зависло всё приложение (сервер тоже), изнутри этого не заметить
function spawnWatchdog() {
  if (!IS_EXE && !process.env.NAKAZMUSIC_TEST_BLOCK) return;
  try {
    spawn(process.execPath, IS_EXE ? process.argv.slice(2) : process.argv.slice(1), { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, NAKAZMUSIC_WATCH_PID: String(process.pid) } }).unref();
  } catch (e) { log('watchdog did not start', e.message); }
}
function windowGuard(isNative) {
  setTimeout(() => {
    if ((lastSeen && !process.env.NAKAZMUSIC_TEST_RELAUNCH) || shuttingDown) return;
    log(LT('l.windowGuard.1'));
    if ((isNative || process.env.NAKAZMUSIC_TEST_RELAUNCH) && RESTARTS < 2 && (IS_EXE || process.env.NAKAZMUSIC_TEST_RELAUNCH)) { if (relaunch()) return; }
    if (!isNative) { openWindow(); return; }
    if (isNative && RESTARTS >= 2) { log(LT('l.windowGuard.2')); openWindow(); startWatchdog(); }
  }, process.env.NAKAZMUSIC_TEST_RELAUNCH ? 3000 : 10000).unref();
}

if (process.env.PLAYER_TEST) {
  module.exports = { geniusExtract, cleanTitle, splitArtists, norm, decodeEntities, redact, verNewer, verParts, readStore, writeJson };
} else (async () => {
  log(LT('l.top.12', { VERSION: VERSION }), IS_EXE ? 'exe' : 'node', process.version);
  if (RESTARTS) await new Promise((r) => setTimeout(r, 1800));   // перезапуск после зависшего окна: ждём, пока старый процесс освободит порт
  if (await isAlreadyRunning()) {
    log(LT('l.top.13'));
    await new Promise((resolve) => {
      const req = http.request({ host: HOST, port: PORT, path: '/api/app/focus', method: 'POST', headers: { 'X-Player': '1' }, timeout: 2000 }, (r) => { r.resume(); r.on('end', resolve); });
      req.on('error', resolve);
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.end();
    });
    setTimeout(() => process.exit(0), 300);
    return;
  }
  splashStart();
  server.listen(PORT, HOST, () => {
    mark('listening');
    setTimeout(startDeferred, 60000).unref();   // запасной срок, если страница так и не обратится к серверу
    log(LT('l.top.14', { URL_APP: URL_APP }));
    // проверка сторожа: имитируем зависание всего приложения (только в тестах)
    if (process.env.NAKAZMUSIC_TEST_BLOCK && !RESTARTS) { spawnWatchdog(); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120000); }
    if (!IS_EXE && !process.env.PLAYER_NATIVE_TEST) return;
    if (startNative()) { log(LT('l.top.15')); windowGuard(true); spawnWatchdog(); return; }
    log(LT('l.top.16'));
    openWindow();
    startWatchdog();
    windowGuard(false);
  });
})();
