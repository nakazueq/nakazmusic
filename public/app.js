'use strict';
/* ===== Sonara: лайки Spotify + SoundCloud в одном окне ===== */
const $ = (id) => document.getElementById(id);
// Эти настройки дублируются в программу (%LOCALAPPDATA%\MyPlayer\store.json),
// чтобы не вводить их заново после обновления или смены окна
const SYNC_KEYS = new Set(['sp_client_id', 'sp_token', 'sc_user', 'ui', 'volume', 'shuffle', 'repeat', 'wallImg', 'playlists']);
const storeQueue = {};
let storeTimer = 0;
function storeSync(k, v) {
  if (!SYNC_KEYS.has(k)) return;
  storeQueue[k] = v;
  clearTimeout(storeTimer);
  storeTimer = setTimeout(() => {
    const body = JSON.stringify(storeQueue);
    for (const key of Object.keys(storeQueue)) delete storeQueue[key];
    fetch('/api/app/store', { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 }).catch(() => {});
  }, 400);
}
const LS = {
  get(k, d = '') { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { storeSync(k, v); try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { storeSync(k, null); try { localStorage.removeItem(k); } catch {} },
  json(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
};
// первый запуск версии с хранилищем: отправляем в программу то, что уже есть в окне
try {
  const have = new Set(window.__storeKeys || []);
  for (const k of SYNC_KEYS) { const v = localStorage.getItem(k); if (v != null && !have.has(k)) storeSync(k, v); }
} catch {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SPEAKER = '<path d="M3.5 9.2h3.3l4.4-3.7v13l-4.4-3.7H3.5z" fill="currentColor"/>';
const ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M7.5 5.2v13.6a1 1 0 0 0 1.53.85l10.9-6.8a1 1 0 0 0 0-1.7L9.03 4.35A1 1 0 0 0 7.5 5.2z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4.2" height="15" rx="1.3" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" fill="currentColor"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12.5v1a4 4 0 0 1-4 4H4"/></svg>',
  repeat1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5 20 6.5l-3 3M4 11.5v-1a4 4 0 0 1 4-4h12M7 20.5l-3-3 3-3M20 12.5v1a4 4 0 0 1-4 4H4"/><path d="M11 10.6l1.4-.9v4.8" stroke-width="1.7"/></svg>',
  vol: `<svg viewBox="0 0 24 24">${SPEAKER}<path d="M14.8 9a4.2 4.2 0 0 1 0 6M17.5 6.3a8 8 0 0 1 0 11.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  volLow: `<svg viewBox="0 0 24 24">${SPEAKER}<path d="M14.8 9a4.2 4.2 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  mute: `<svg viewBox="0 0 24 24">${SPEAKER}<path d="M15 9.5l5 5M20 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 5-4.5 3.5 3 2.5-2 4 3.5"/></svg>',
  disc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M9 17.5V6.6l10-2.4v10.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.6" cy="17.6" r="2.6" fill="currentColor"/><circle cx="16.6" cy="15.1" r="2.6" fill="currentColor"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24"><path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z" fill="currentColor"/><path d="M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 15 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M5 19v-6M10 19V9M15 19v-9M20 19V5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  radio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 18.7a9.5 9.5 0 0 1 0-13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h11M4 12h11M4 17h7"/><circle cx="18" cy="16.5" r="2.2"/><path d="M20.2 16.5V7.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M4 11h12M4 16h7"/><path d="m15 14 5 3-5 3z" fill="currentColor"/></svg>',
};

/* ===================== Оформление ===================== */
const WALLS = {
  mist: { name: 'Туман', css: 'radial-gradient(55% 60% at 12% 18%, #cdd6e4 0%, transparent 70%), radial-gradient(50% 55% at 88% 12%, #e3d8e7 0%, transparent 70%), radial-gradient(60% 60% at 82% 92%, #d0dbe6 0%, transparent 70%), radial-gradient(50% 55% at 8% 88%, #e7e0d4 0%, transparent 70%), linear-gradient(160deg, #e9eaee, #dadde4)' },
  silver: { name: 'Серебро', css: 'radial-gradient(60% 60% at 20% 15%, #f6f6f8 0%, transparent 70%), radial-gradient(55% 60% at 85% 85%, #c2c5cd 0%, transparent 70%), radial-gradient(40% 45% at 75% 20%, #dcdde2 0%, transparent 70%), linear-gradient(150deg, #e6e7eb, #cdd0d6)' },
  ocean: { name: 'Океан', css: 'radial-gradient(55% 60% at 15% 20%, #b9d3f0 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #cbe7f1 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #d3d2f2 0%, transparent 70%), linear-gradient(160deg, #e3ebf5, #d2dff0)' },
  sakura: { name: 'Сакура', css: 'radial-gradient(55% 60% at 15% 20%, #f6d4e2 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #eadff3 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #fbe4d8 0%, transparent 70%), linear-gradient(160deg, #f6eef2, #efe3ea)' },
  mint: { name: 'Мята', css: 'radial-gradient(55% 60% at 15% 20%, #cbe9dc 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #d7ecf1 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #e5f1d6 0%, transparent 70%), linear-gradient(160deg, #ecf3ef, #dfece6)' },
  night: { name: 'Ночь', css: 'radial-gradient(55% 60% at 15% 20%, #3b3272 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #173e64 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #4a2352 0%, transparent 70%), linear-gradient(160deg, #13141f, #1b1d2b)' },
  sunset: { name: 'Закат', css: 'radial-gradient(55% 60% at 15% 20%, #7a2e50 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #8a4b22 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #352d6c 0%, transparent 70%), linear-gradient(160deg, #1f1520, #191526)' },
  plain: { name: 'Однотонный' },
  cover: { name: 'Обложка' },
  custom: { name: 'Своя' },
};
const DARK_WALLS = new Set(['night', 'sunset']);
const PV_LIGHT =['rgba(236,237,241,.78)', 'rgba(251,251,253,.88)'];
const PV_DARK = ['rgba(38,38,42,.8)', 'rgba(26,26,29,.86)'];
const PRESETS = [
  { id: 'glass', name: 'Стекло', mode: 'light', accent: '#007AFF', wall: 'mist', alpha: 45 },
  { id: 'graphite', name: 'Графит', mode: 'light', accent: '#8E8E93', wall: 'silver', alpha: 40 },
  { id: 'ocean', name: 'Океан', mode: 'light', accent: '#30B0C7', wall: 'ocean', alpha: 50 },
  { id: 'sakura', name: 'Сакура', mode: 'light', accent: '#FF2D55', wall: 'sakura', alpha: 50 },
  { id: 'mint', name: 'Мята', mode: 'light', accent: '#34C759', wall: 'mint', alpha: 50 },
  { id: 'night', name: 'Ночь', mode: 'dark', accent: '#0A84FF', wall: 'night', alpha: 50 },
  { id: 'sunset', name: 'Закат', mode: 'dark', accent: '#FF9F0A', wall: 'sunset', alpha: 50 },
  { id: 'cover', name: 'Обложка', mode: 'dark', accent: '#FA2D48', wall: 'cover', alpha: 55 },
];
const ACCENTS = [
  ['Синий', '#007AFF'], ['Фиолетовый', '#AF52DE'], ['Розовый', '#FF2D55'], ['Красный', '#FF3B30'],
  ['Оранжевый', '#FF9500'], ['Жёлтый', '#FFCC00'], ['Зелёный', '#34C759'], ['Бирюзовый', '#30B0C7'], ['Графит', '#8E8E93'],
];
const DEFAULT_UI = { preset: 'glass', mode: 'light', accent: '#007AFF', wall: 'mist', alpha: 45, blur: 40, lite: false, compact: false, tray: true };
const ui = { ...DEFAULT_UI, ...LS.json('ui', {}) };
const saveUI = () => LS.set('ui', JSON.stringify(ui));
const mq = matchMedia('(prefers-color-scheme: dark)');

function isLightColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.45;
}
function currentMode() { return ui.mode === 'auto' ? (mq.matches ? 'dark' : 'light') : ui.mode; }

function applyUI() {
  const r = document.documentElement;
  r.dataset.theme = currentMode();
  r.dataset.lite = ui.lite ? '1' : '0';
  r.dataset.compact = ui.compact ? '1' : '0';
  r.style.setProperty('--accent', ui.accent);
  r.style.setProperty('--on-accent', isLightColor(ui.accent) ? '#1d1d1f' : '#ffffff');
  r.style.setProperty('--op', (0.96 - (ui.alpha / 100) * 0.76).toFixed(3));
  r.style.setProperty('--blur', ui.blur + 'px');
  applyWall();
  const old = rowH;
  readRowH();
  if (old !== rowH) vlReset();
  syncSettingsUI();
  pushTheme();
}
// заголовок родного окна Windows: светлый или тёмный под тему
let pushedTheme = null;
function pushTheme() {
  if (typeof appInfo === 'undefined' || !appInfo.native) return;
  const m = currentMode();
  if (m === pushedTheme) return;
  pushedTheme = m;
  appCmd('theme', '?mode=' + m);
}
let lastWallBg = null;
function applyWall() {
  const el = $('wall');
  let cls = 'wall';
  let bg = '';
  const w = ui.wall;
  if (w === 'custom') {
    const img = LS.get('wallImg');
    if (img) { bg = `url("${img}")`; cls += ' img'; } else cls += ' plain';
  } else if (w === 'cover') {
    const a = state.cur && (state.cur.art || state.cur.cover);
    if (a && !released) { bg = `url("${a}")`; cls += ' cover'; } else bg = (currentMode() === 'dark' ? WALLS.night : WALLS.mist).css;
  } else if (w === 'plain') {
    cls += ' plain';
  } else {
    bg = (WALLS[w] || WALLS.mist).css;
    cls += DARK_WALLS.has(w) ? ' darkwall' : ' lightwall';
  }
  if (el.className !== cls) el.className = cls;
  if (lastWallBg !== bg) { el.style.backgroundImage = bg || 'none'; lastWallBg = bg; }
}
mq.addEventListener('change', () => { if (ui.mode === 'auto') applyUI(); });

/* ===================== Состояние ===================== */
const state = {
  lib: { sp: LS.json('sp_lib', []), sc: [], local: [] },
  localFolders: [],
  statsRange: 'week',
  all: [],
  recs: [],
  recsSeeds: 0,
  recsAt: 0,
  recsLoading: false,
  recsError: '',
  radio: { seed: null, tracks: [], loading: false, more: false },
  queueKind: 'list',
  loading: { sp: false, sc: false },
  view: 'all',
  query: '',
  list: [],
  queue: [],
  order: [],
  pos: -1,
  cur: null,
  playing: false,
  shuffle: LS.get('shuffle') === '1',
  repeat: LS.get('repeat', 'off'),
  time: 0,
  dur: 0,
  volume: Math.max(0, Math.min(100, Number(LS.get('volume', '70')) || 0)),
  lastVolume: 70,
  seeking: false,
  token: 0,
  fails: 0,
};
{
  const rc = LS.json('recs', null);
  if (rc && Array.isArray(rc.tracks)) { state.recs = rc.tracks; state.recsSeeds = rc.seeds || 0; state.recsAt = rc.at || 0; }
}

/* ===================== Утилиты ===================== */
function fmt(ms) {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
function fmtTotal(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  return `${h} ч ${min % 60} мин`;
}
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
const TRACKS = ['трек', 'трека', 'треков'];
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\b(feat|ft)\b.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function trackKey(t) {
  const title = String(t.title || '').includes(' - ') ? String(t.title).split(' - ').slice(1).join(' - ') : t.title;
  return norm(String(t.artist || '').split(',')[0]) + '|' + norm(title);
}
function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
let lastToast = '';
function toast(msg, ms = 3800) {
  if (!msg || msg === lastToast) return;
  lastToast = msg;
  setTimeout(() => { if (lastToast === msg) lastToast = ''; }, 1500);
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}
async function api(url, opts) {
  const r = await fetch(url, opts);
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((j && j.error) || `Ошибка ${r.status}`); e.status = r.status; throw e; }
  return j;
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не загрузился ' + src));
    document.head.appendChild(s);
  });
}
function fatal(msg) { const e = new Error(msg); e.fatal = true; return e; }
function setFill(el) {
  const min = Number(el.min) || 0, max = Number(el.max) || 100;
  el.style.setProperty('--fill', ((Number(el.value) - min) / (max - min)) * 100 + '%');
}

/* ===================== Spotify: вход ===================== */
const REDIRECT_URI = location.origin + '/callback';
const SP_SCOPES = 'streaming user-read-email user-read-private user-library-read user-read-playback-state user-modify-playback-state';
const WIDEVINE_MSG = 'Spotify не может играть в этом браузере. В Brave открой brave://settings/extensions, включи Widevine и перезапусти браузер.';
let leavingForAuth = false;

function b64url(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function randomString(n = 64) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); }

async function spLogin() {
  const clientId = $('sp-client').value.trim();
  if (!/^[0-9a-f]{32}$/i.test(clientId)) { setAccState('sp', 'Client ID выглядит неправильно (32 символа)', 'err'); return; }
  LS.set('sp_client_id', clientId);
  const verifier = randomString(96);
  LS.set('sp_verifier', verifier);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const p = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: REDIRECT_URI, scope: SP_SCOPES, code_challenge_method: 'S256', code_challenge: challenge });
  leavingForAuth = true;
  location.href = 'https://accounts.spotify.com/authorize?' + p;
}
async function spTokenRequest(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || `Spotify ${r.status}`);
  const prev = LS.json('sp_token', {});
  LS.set('sp_token', JSON.stringify({ access: j.access_token, refresh: j.refresh_token || prev.refresh, exp: Date.now() + j.expires_in * 1000 }));
}
async function spHandleCallback() {
  const q = new URLSearchParams(location.search);
  history.replaceState({}, '', '/');
  if (q.get('error')) { toast('Spotify: вход отменён'); return; }
  if (!q.get('code')) return;
  try {
    await spTokenRequest({ client_id: LS.get('sp_client_id'), grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT_URI, code_verifier: LS.get('sp_verifier') });
    LS.del('sp_verifier');
    toast('Spotify подключён');
  } catch (e) { toast('Не получилось войти в Spotify: ' + e.message); }
}
let refreshing = null;
async function spRefresh() {
  if (refreshing) return refreshing;
  const t = LS.json('sp_token', {});
  if (!t.refresh) throw fatal('Войди в Spotify в настройках');
  refreshing = spTokenRequest({ client_id: LS.get('sp_client_id'), grant_type: 'refresh_token', refresh_token: t.refresh })
    .finally(() => { refreshing = null; });
  return refreshing;
}
async function spToken() {
  const t = LS.json('sp_token', {});
  if (!t.access) throw fatal('Spotify не подключён');
  if (Date.now() < t.exp - 60000) return t.access;
  await spRefresh();
  return LS.json('sp_token', {}).access;
}
async function spApi(p, opts = {}, tries = 0) {
  const token = await spToken();
  const r = await fetch(p.startsWith('http') ? p : 'https://api.spotify.com/v1' + p, {
    ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 429 && tries < 4) { await sleep(2000 * (tries + 1)); return spApi(p, opts, tries + 1); }
  if (r.status === 401 && tries < 1) { await spRefresh(); return spApi(p, opts, tries + 1); }
  if (r.status === 204 || r.status === 202) return null;
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    const e = new Error((j && j.error && (j.error.message || j.error)) || `Spotify ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return j;
}
function spMap(t, addedAt) {
  const imgs = (t.album && t.album.images) || [];
  return {
    src: 'sp', id: t.id, uri: t.uri, title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(', '),
    album: (t.album && t.album.name) || '',
    cover: (imgs[imgs.length - 1] || {}).url || '',
    art: (imgs[1] || imgs[0] || {}).url || '',
    big: (imgs[0] || {}).url || '',
    duration: t.duration_ms || 0,
    at: Date.parse(addedAt) || 0,
  };
}
async function spLoadLikes() {
  if (state.loading.sp) return;
  state.loading.sp = true;
  setAccState('sp', 'Загружаю лайки…');
  renderHead(); renderEmpty();
  try {
    const out = [];
    let url = '/me/tracks?limit=50';
    while (url) {
      const j = await spApi(url);
      for (const it of (j && j.items) || []) {
        const t = it.track;
        if (t && t.id && !t.is_local) out.push(spMap(t, it.added_at));
      }
      url = j && j.next;
      if (url) setAccState('sp', `Загружено ${out.length}…`);
    }
    state.lib.sp = out;
    LS.set('sp_lib', JSON.stringify(out));
    setAccState('sp', `${out.length} ${plural(out.length, TRACKS)}`, 'ok');
    rebuildAll();
  } catch (e) {
    setAccState('sp', e.message, 'err');
    toast('Spotify: ' + e.message);
  } finally {
    state.loading.sp = false;
    render();
  }
}
async function spMe() {
  try { const me = await spApi('/me'); if (me) $('sp-state').dataset.name = me.display_name || me.id || ''; } catch {}
}
function spLogout() {
  LS.del('sp_token'); LS.del('sp_lib');
  state.lib.sp = [];
  if (sp.player) { try { sp.player.disconnect(); } catch {} }
  sp.player = null; sp.device = null; sp.ready = null;
  if (state.cur && state.cur.src === 'sp') { state.cur = null; state.playing = false; updatePlayer(); }
  setAccState('sp', 'Не подключён');
  rebuildAll();
  syncAccounts();
}

/* ===================== Spotify: плеер ===================== */
const sp = { player: null, device: null, ready: null, last: { pos: 0, at: 0 }, endGuard: null };
function spInit() {
  if (sp.ready) return sp.ready;
  sp.ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(fatal('Spotify-плеер не запустился. Проверь интернет и Widevine.')), 20000);
    const fail = (e) => { clearTimeout(timer); reject(e); };
    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new Spotify.Player({
        name: 'Sonara',
        getOAuthToken: (cb) => spToken().then(cb, () => cb('')),
        volume: gain(),
      });
      p.addListener('ready', ({ device_id }) => { sp.device = device_id; clearTimeout(timer); resolve(p); });
      p.addListener('not_ready', () => { sp.device = null; });
      p.addListener('initialization_error', () => { const e = fatal(WIDEVINE_MSG); e.widevine = true; fail(e); });
      p.addListener('authentication_error', () => fail(fatal('Spotify: войди заново в настройках')));
      p.addListener('account_error', () => fail(fatal('Spotify: для плеера нужен Premium')));
      p.addListener('playback_error', ({ message }) => { if (state.cur && state.cur.src === 'sp') toast('Spotify: ' + message); });
      p.addListener('player_state_changed', spOnState);
      sp.player = p;
      p.connect().then((ok) => { if (!ok) fail(fatal(WIDEVINE_MSG)); });
    };
    if (window.Spotify && window.Spotify.Player) window.onSpotifyWebPlaybackSDKReady();
    else loadScript('https://sdk.scdn.co/spotify-player.js').catch(() => fail(fatal('Не загрузился Spotify. Есть интернет?')));
  });
  sp.ready.catch(() => { sp.ready = null; });
  return sp.ready;
}
function spOnState(st) {
  if (!st || !state.cur || state.cur.src !== 'sp') return;
  const t = st.track_window && st.track_window.current_track;
  if (t && t.id && t.id !== state.cur.id && !(t.linked_from && t.linked_from.id === state.cur.id)) return;
  sp.last = { pos: st.position, at: performance.now() };
  state.playing = !st.paused;
  state.time = st.position;
  state.dur = st.duration || state.dur;
  const ended = st.paused && st.position === 0 &&
    (st.track_window.previous_tracks || []).some((x) => x.id === state.cur.id || (x.linked_from && x.linked_from.id === state.cur.id));
  if (ended && sp.endGuard !== state.token) { sp.endGuard = state.token; next(true); return; }
  updatePlayer();
}
async function spPlay(t, token) {
  if ((await spGetMode()) === 'connect') return spcPlay(t, token);
  let p;
  try { p = await spInit(); }
  catch (e) {
    if (!e.widevine) throw e;
    spMode = 'connect';
    return spcPlay(t, token);
  }
  if (token !== state.token) return;
  try { await p.activateElement(); } catch {}
  for (let i = 0; ; i++) {
    try {
      await spApi(`/me/player/play?device_id=${encodeURIComponent(sp.device)}`, { method: 'PUT', body: JSON.stringify({ uris: [t.uri] }) });
      break;
    } catch (e) {
      if ((e.status === 404 || e.status === 502) && i < 3) { await sleep(1000); continue; }
      if (e.status === 403) throw fatal('Spotify не даёт включить трек (нужен Premium на аккаунте).');
      throw e;
    }
  }
  sp.last = { pos: 0, at: performance.now() };
}

/* ---------- Spotify через приложение Spotify на компе ----------
   В родном окне Windows нет защищённого воспроизведения (Widevine), поэтому
   звук идёт из официального приложения Spotify, а плеер им управляет. */
let spMode = null; // 'sdk' — играет внутри окна, 'connect' — через приложение Spotify
const spc = { device: null, timer: 0, endTimer: 0, volTimer: 0, seenOurs: false, foreign: false, waits: 0, volSynced: false };
async function hasWidevine() {
  if (!navigator.requestMediaKeySystemAccess) return false;
  try {
    await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{ initDataTypes: ['cenc'], audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }] }]);
    return true;
  } catch { return false; }
}
async function spGetMode() {
  if (!spMode) spMode = (await hasWidevine()) ? 'sdk' : 'connect';
  return spMode;
}
const isSpConnect = () => spMode === 'connect';
async function spcDevices() { const j = await spApi('/me/player/devices'); return (j && j.devices) || []; }
function spcPick(list) {
  const ok = list.filter((d) => d.id && !d.is_restricted);
  const host = String(appInfo.hostname || '').toLowerCase();
  return ok.find((d) => d.type === 'Computer' && host && String(d.name).toLowerCase() === host)
    || ok.find((d) => d.is_active)
    || ok.find((d) => d.type === 'Computer')
    || ok[0] || null;
}
async function spcEnsureDevice(token) {
  let d = spcPick(await spcDevices());
  if (d) return d;
  toast('Запускаю Spotify…');
  appCmd('spotify-launch');
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    if (token !== state.token) return null;
    d = spcPick(await spcDevices().catch(() => []));
    if (d) {
      // приложение появилось в списке раньше, чем готово принимать команды: даём ему догрузиться
      await sleep(2500);
      return d;
    }
  }
  throw fatal('Не вижу приложение Spotify. Открой его и войди в тот же аккаунт, что и тут.');
}
function spcQuery(q) { return spc.device ? `${q}${q.includes('?') ? '&' : '?'}device_id=${encodeURIComponent(spc.device)}` : q; }
// служебные ошибки Spotify (ещё не загрузился, нет активного трека) не показываем
const SPC_QUIET = /no list was loaded|no active device|restriction violated|not found/i;
function spcCmd(q, body, loud = false) {
  return spApi(spcQuery(q), { method: 'PUT', body }).then(() => true, (e) => {
    if (loud && e.status !== 403 && e.status !== 404 && !SPC_QUIET.test(e.message)) toast('Spotify: ' + e.message);
    return false;
  });
}
function spcSession() {
  if (!appInfo.native) return;
  const t = LS.json('sp_token', {});
  appCmd('sp-session', { token: t.access || '', device: spc.device || '', playing: !!(state.playing && state.cur && state.cur.src === 'sp' && isSpConnect()) });
}
// В свёрнутом/скрытом окне движок «усыпляет» таймеры до раза в минуту.
// Поэтому кроме setTimeout помним время срабатывания и проверяем его по «тикам» от программы.
function spcStop() { clearTimeout(spc.timer); clearTimeout(spc.endTimer); spc.dueAt = 0; spc.endAt = 0; }
function spcSchedule(ms) {
  clearTimeout(spc.timer);
  spc.dueAt = Date.now() + ms;
  spc.timer = setTimeout(() => { spc.dueAt = 0; spcPoll(); }, ms);
}
function spcEndIn(ms, token) {
  clearTimeout(spc.endTimer);
  spc.endAt = Date.now() + ms;
  spc.endToken = token;
  spc.endTimer = setTimeout(spcEndFire, ms);
}
function spcEndFire() {
  if (!spc.endAt) return;
  spc.endAt = 0;
  clearTimeout(spc.endTimer);
  if (spc.endToken === state.token && state.playing) next(true);
}
function spcTick() {
  const now = Date.now();
  if (spc.endAt && now >= spc.endAt) spcEndFire();
  if (spc.dueAt && now >= spc.dueAt) { spc.dueAt = 0; clearTimeout(spc.timer); spcPoll(); }
}
async function spcPlay(t, token) {
  spcStop();
  const d = await spcEnsureDevice(token);
  if (!d || token !== state.token) return;
  spc.device = d.id;
  const body = JSON.stringify({ uris: [t.uri] });
  try {
    await spApi(spcQuery('/me/player/play'), { method: 'PUT', body });
  } catch (e) {
    if (e.status === 404) {
      // приложение «уснуло»: будим переносом воспроизведения на него
      await spApi('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [d.id], play: false }) }).catch(() => {});
      await sleep(900);
      await spApi(spcQuery('/me/player/play'), { method: 'PUT', body });
    } else if (e.status === 403) throw fatal('Spotify не даёт включить трек (нужен Premium на аккаунте).');
    else throw e;
  }
  if (token !== state.token) return;
  spc.seenOurs = false; spc.foreign = false; spc.waits = 0;
  spc.pendingBody = body;
  sp.last = { pos: 0, at: performance.now() };
  spcSchedule(700);
  spcSession();
}
// трек не пошёл: повторяем команду (Spotify иногда «проглатывает» первую после запуска)
async function spcRetry(withTransfer) {
  if (!spc.device || !spc.pendingBody) return;
  if (withTransfer) {
    await spApi('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [spc.device], play: false }) }).catch(() => {});
    await sleep(700);
  }
  await spcCmd('/me/player/play', spc.pendingBody);
}
async function spcPoll() {
  const c = state.cur;
  if (!c || c.src !== 'sp' || !isSpConnect()) return;
  const token = state.token;
  let st = null;
  try { st = await spApi('/me/player'); }
  catch { if (token === state.token) spcSchedule(4000); return; }
  if (token !== state.token) return;
  const item = st && st.item;
  const ours = !!item && (item.id === c.id || (item.linked_from && item.linked_from.id === c.id));
  if (ours) {
    if (!spc.seenOurs && !spc.volSynced) { spc.volSynced = true; spcCmd(`/me/player/volume?volume_percent=${state.volume}`); }
    spc.seenOurs = true; spc.foreign = false;
    state.dur = item.duration_ms || state.dur;
    state.time = st.progress_ms || 0;
    sp.last = { pos: state.time, at: performance.now() };
    const was = state.playing;
    state.playing = !!st.is_playing;
    if (was !== state.playing) spcSession();
    updatePlayer();
    clearTimeout(spc.endTimer); spc.endAt = 0;
    const left = state.dur - state.time;
    if (state.playing && left < 4000) {
      // трек почти закончился: сами включаем следующий, не дожидаясь автоплея Spotify
      spcEndIn(Math.max(0, left) + 250, token);
      return;
    }
    spcSchedule(state.playing ? 2000 : 4000);
  } else if (spc.seenOurs) {
    // в самом Spotify включили что-то другое
    spc.foreign = true;
    if (state.playing) { state.playing = false; updatePlayer(); spcSession(); }
    spcSchedule(5000);
  } else {
    spc.waits++;
    if (spc.waits > 14) {
      state.playing = false; updatePlayer();
      toast('Spotify не отвечает. Проверь, что приложение Spotify открыто и в нём выполнен вход.');
      return;
    }
    if (spc.waits === 2 || spc.waits === 5 || spc.waits === 9) await spcRetry(spc.waits >= 5);
    if (token === state.token) spcSchedule(800);
  }
}
function spcPause() { spcCmd('/me/player/pause', undefined, true); state.playing = false; updatePlayer(); spcSchedule(1500); spcSession(); }
function spcResume() {
  // если трек ещё не загрузился в Spotify, «продолжить» нечего — включаем заново
  if (spc.foreign || !spc.device || !spc.seenOurs) { playTrack(state.cur); return; }
  const token = state.token;
  spcCmd('/me/player/play').then((ok) => { if (!ok && token === state.token) playTrack(state.cur); });
  state.playing = true; sp.last = { pos: state.time, at: performance.now() };
  updatePlayer(); spcSchedule(1500); spcSession();
}
function spcSeek(ms) { spcCmd(`/me/player/seek?position_ms=${Math.round(ms)}`); clearTimeout(spc.endTimer); spc.endAt = 0; spcSchedule(1500); }
function spcVolume() {
  clearTimeout(spc.volTimer);
  spc.volTimer = setTimeout(() => spcCmd(`/me/player/volume?volume_percent=${state.volume}`), 350);
}

/* ---------- команды окну программы ---------- */
let appInfo = { native: false, hostname: '' };
function appCmd(name, body) {
  return fetch('/api/app/' + name + (typeof body === 'string' ? body : ''), {
    method: 'POST',
    headers: { 'X-Player': '1', 'Content-Type': 'application/json' },
    body: body && typeof body === 'object' ? JSON.stringify(body) : undefined,
  }).catch(() => {});
}

/* ===================== SoundCloud: плеер ===================== */
const audio = $('audio');
let hls = null;
let scMode = 'audio';
let scw = null;
let widgetReady = null;

function hlsCleanup() { if (hls) { try { hls.destroy(); } catch {} hls = null; } }
async function loadHls() {
  if (window.Hls) return window.Hls;
  await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js');
  return window.Hls;
}
const isScAudio = () => state.cur && (state.cur.src === 'sc' || state.cur.src === 'local') && scMode === 'audio';
const isScWidget = () => state.cur && state.cur.src === 'sc' && scMode === 'widget';

async function scPlay(t, token) {
  scMode = 'audio';
  if (scw) { try { scw.pause(); } catch {} }
  let info;
  try { info = await api('/api/sc/stream?id=' + encodeURIComponent(t.id)); }
  catch (e) {
    if (token !== state.token) return;
    if (e.status === 403) throw e;
    return scWidgetPlay(t, token);
  }
  if (token !== state.token) return;
  if (info.snipped) toast('SoundCloud отдаёт только отрывок этого трека');
  hlsCleanup();
  audio.pause();
  if (info.protocol === 'hls' && !audio.canPlayType('application/vnd.apple.mpegurl')) {
    let Hls = null;
    try { Hls = await loadHls(); } catch {}
    if (token !== state.token) return;
    if (!Hls || !Hls.isSupported()) return scWidgetPlay(t, token);
    hls = new Hls({ maxBufferLength: 20, maxMaxBufferLength: 40, backBufferLength: 10 });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal || token !== state.token) return;
      hlsCleanup();
      scWidgetPlay(t, token).catch((err) => playFailed(err, token));
    });
    hls.loadSource(info.url);
    hls.attachMedia(audio);
  } else {
    audio.src = info.url;
  }
  audio.volume = gain();
  try { await audio.play(); }
  catch (e) {
    if (e.name === 'NotAllowedError') { state.playing = false; updatePlayer(); return; }
    if (e.name === 'AbortError') return;
    if (token === state.token) return scWidgetPlay(t, token);
  }
}
audio.addEventListener('timeupdate', () => {
  if (!isScAudio()) return;
  state.time = audio.currentTime * 1000;
  if (isFinite(audio.duration) && audio.duration > 0) {
    state.dur = audio.duration * 1000;
    if (state.cur.src === 'local' && !state.cur.duration) state.cur.duration = Math.round(state.dur);
  }
  updateProgress();
});
audio.addEventListener('playing', () => { if (isScAudio()) { state.playing = true; updatePlayer(); } });
audio.addEventListener('pause', () => { if (isScAudio()) { state.playing = false; updatePlayer(); } });
audio.addEventListener('ended', () => { if (isScAudio()) next(true); });
audio.addEventListener('error', () => {
  if (!isScAudio() || hls || !audio.getAttribute('src')) return;
  const token = state.token;
  if (state.cur.src === 'local') { playFailed(new Error('Не получилось открыть файл: формат не поддерживается или файл перемещён'), token); return; }
  scWidgetPlay(state.cur, token).catch((e) => playFailed(e, token));
});

function ensureWidget(firstUrl) {
  if (widgetReady) return widgetReady;
  widgetReady = (async () => {
    if (!window.SC || !window.SC.Widget) await loadScript('https://w.soundcloud.com/player/api.js');
    const f = document.createElement('iframe');
    f.id = 'scw';
    f.allow = 'autoplay';
    f.title = 'SoundCloud';
    f.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(firstUrl) + '&auto_play=false&show_artwork=false&visual=false';
    document.body.appendChild(f);
    const w = SC.Widget(f);
    await new Promise((res) => w.bind(SC.Widget.Events.READY, res));
    w.bind(SC.Widget.Events.PLAY, () => { if (isScWidget()) { state.playing = true; updatePlayer(); } });
    w.bind(SC.Widget.Events.PAUSE, () => { if (isScWidget()) { state.playing = false; updatePlayer(); } });
    w.bind(SC.Widget.Events.FINISH, () => { if (isScWidget()) next(true); });
    w.bind(SC.Widget.Events.PLAY_PROGRESS, (e) => {
      if (!isScWidget()) return;
      state.time = e.currentPosition;
      updateProgress();
    });
    scw = w;
    return w;
  })();
  widgetReady.catch(() => { widgetReady = null; });
  return widgetReady;
}
async function scWidgetPlay(t, token) {
  scMode = 'widget';
  hlsCleanup();
  audio.pause();
  const w = await ensureWidget(t.url);
  if (token !== state.token) return;
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Этот трек недоступен на SoundCloud')), 15000);
    w.load(t.url, {
      auto_play: true, show_artwork: false, visual: false,
      callback: () => {
        clearTimeout(to);
        w.setVolume(gain() * 100);
        w.getDuration((d) => { if (d && token === state.token) { state.dur = d; updateProgress(); } });
        w.play();
        resolve();
      },
    });
  });
}

/* ===================== Ядро плеера ===================== */
const gain = () => (state.volume / 100) ** 2;
function shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildOrder(first) {
  const n = state.queue.length;
  const order = Array.from({ length: n }, (_, i) => i);
  if (state.shuffle && n > 1 && state.queueKind !== 'radio') {
    order.splice(first, 1);
    shuffleArr(order);
    order.unshift(first);
    state.pos = 0;
  } else state.pos = first;
  state.order = order;
}
function playFrom(list, idx, kind) {
  if (!list.length) return;
  state.queueKind = kind || (state.view === 'radio' ? 'radio' : 'list');
  state.queue = list.slice();
  buildOrder(Math.max(0, Math.min(idx, list.length - 1)));
  state.fails = 0;
  playTrack(state.queue[state.order[state.pos]]);
}
function stopOthers(src) {
  if (src === 'local' && scw) { try { scw.pause(); } catch {} }
  if (src !== 'sc' && src !== 'local') {
    audio.pause(); hlsCleanup();
    if (scw) { try { scw.pause(); } catch {} }
  }
  if (src !== 'sp' && sp.player) sp.player.pause().catch(() => {});
  if (isSpConnect()) {
    spcStop();
    if (src !== 'sp' && state.cur && state.cur.src === 'sp' && state.playing) spcCmd('/me/player/pause');
  }
}
async function playTrack(t) {
  if (!t) return;
  const token = ++state.token;
  stopOthers(t.src);
  hydrateLocal(t);
  listenStart(t);
  state.cur = t;
  state.time = 0;
  state.dur = t.duration || 0;
  state.playing = true;
  sp.last = { pos: 0, at: performance.now() };
  onTrackChanged();
  try {
    if (t.src === 'sp') await spPlay(t, token);
    else if (t.src === 'local') await localPlay(t, token);
    else await scPlay(t, token);
    if (token === state.token) state.fails = 0;
  } catch (e) {
    playFailed(e, token);
  }
}
function playFailed(e, token) {
  if (token !== state.token) return;
  console.warn(e);
  state.playing = false;
  updatePlayer();
  toast(e && e.message ? e.message : 'Не получилось включить трек', e && e.fatal ? 7000 : 3800);
  if (e && e.fatal) return;
  if (++state.fails <= 4 && state.queue.length > 1) setTimeout(() => { if (token === state.token) next('fail'); }, 1200);
}
function next(auto = false) {
  if (!state.queue.length) return;
  if (auto === true && state.repeat === 'one' && state.cur) { playTrack(state.cur); return; }
  let p = state.pos + 1;
  if (p >= state.order.length && state.queueKind === 'radio') {
    // радио бесконечное: догружаем похожие и играем дальше
    radioMore().then(() => { if (state.pos + 1 < state.order.length) { state.pos++; playTrack(state.queue[state.order[state.pos]]); } });
    return;
  }
  if (p >= state.order.length) {
    if (auto && state.repeat === 'off') { engPause(); state.playing = false; updatePlayer(); spcSession(); return; }
    if (state.shuffle) { shuffleArr(state.order); }
    p = 0;
  }
  state.pos = p;
  playTrack(state.queue[state.order[p]]);
}
function prev() {
  if (!state.queue.length) return;
  if (state.time > 3000 || state.pos <= 0) { seek(0); return; }
  state.pos -= 1;
  playTrack(state.queue[state.order[state.pos]]);
}
function engPause() {
  const c = state.cur;
  if (!c) return;
  if (c.src === 'sp') { if (isSpConnect()) spcPause(); else if (sp.player) sp.player.pause(); }
  else if (scMode === 'widget') { if (scw) scw.pause(); }
  else audio.pause();
}
function engResume() {
  const c = state.cur;
  if (!c) return;
  if (c.src === 'sp') { if (isSpConnect()) spcResume(); else if (sp.player) sp.player.resume(); else playTrack(c); }
  else if (scMode === 'widget') { if (scw) scw.play(); }
  else if (audio.getAttribute('src') || hls) audio.play().catch(() => playTrack(c));
  else playTrack(c);
}
function togglePlay() {
  if (!state.cur) { if (state.list.length) playFrom(state.list, 0); return; }
  if (state.playing) engPause(); else engResume();
}
function seek(ms) {
  const c = state.cur;
  if (!c) return;
  ms = Math.max(0, Math.min(ms, state.dur || ms));
  state.time = ms;
  if (c.src === 'sp') {
    if (isSpConnect()) spcSeek(ms); else if (sp.player) sp.player.seek(Math.round(ms));
    sp.last = { pos: ms, at: performance.now() };
  }
  else if (scMode === 'widget') { if (scw) scw.seekTo(ms); }
  else audio.currentTime = ms / 1000;
  updateProgress();
  lyFollow = true;
  lyKick();
}
function setVolume(v, save = true) {
  state.volume = Math.max(0, Math.min(100, Math.round(v)));
  if (state.volume > 0) state.lastVolume = state.volume;
  if (save) LS.set('volume', String(state.volume));
  audio.volume = gain();
  if (sp.player) sp.player.setVolume(gain()).catch(() => {});
  if (scw) { try { scw.setVolume(gain() * 100); } catch {} }
  if (save && isSpConnect() && spc.device) spcVolume();
  const vEl = $('volume');
  if (Number(vEl.value) !== state.volume) vEl.value = state.volume;
  setFill(vEl);
  $('b-mute').innerHTML = state.volume === 0 ? ICONS.mute : state.volume < 45 ? ICONS.volLow : ICONS.vol;
}
// позиция Spotify приходит редко, между событиями досчитываем сами
setInterval(() => {
  if (document.hidden || state.seeking || !state.playing || !state.cur || state.cur.src !== 'sp') return;
  state.time = Math.min(sp.last.pos + (performance.now() - sp.last.at), state.dur || Infinity);
  updateProgress();
}, 500);

/* ---------- медиа-клавиши и системная плашка ---------- */
const ms = navigator.mediaSession;
if (ms) {
  const h = (a, f) => { try { ms.setActionHandler(a, f); } catch {} };
  h('play', engResume);
  h('pause', engPause);
  h('previoustrack', prev);
  h('nexttrack', () => next(false));
  h('seekto', (d) => seek(d.seekTime * 1000));
}

/* ===================== Плеер: отрисовка ===================== */
const npTitle = $('np-title'), npArtist = $('np-artist'), npCover = $('np-cover');
const seekEl = $('seek');
let lastPlayIcon = null, lastRepeat = null;
function bigArt(t) {
  if (!t) return '';
  if (t.big) return t.big;
  const a = t.art || t.cover || '';
  return a.includes('-t300x300.') ? a.replace('-t300x300.', '-t500x500.') : a;
}
function onTrackChanged() {
  updatePlayer();
  refreshCurrentRows();
  if (ui.wall === 'cover') applyWall();
  const big = bigArt(state.cur);
  const sc = $('side-cover');
  if (big) { const img = $('side-cover-img'); if (img.getAttribute('src') !== big) img.src = big; sc.hidden = false; }
  else sc.hidden = true;
  if (lyOpen) lyTrack();
  if (state.queueKind === 'radio' && state.order.length - state.pos <= 4) radioMore();
  const t = state.cur;
  if (ms && t) {
    try { ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: t.art ? [{ src: t.art, sizes: '300x300' }] : [] }); } catch {}
  }
}
function updatePlayer() {
  const t = state.cur;
  npTitle.textContent = t ? t.title : 'Ничего не играет';
  npArtist.textContent = t ? t.artist : 'Выбери трек в списке';
  const art = t ? t.art || t.cover : '';
  if (art) { if (npCover.getAttribute('src') !== art) npCover.src = art; } else npCover.removeAttribute('src');
  const icon = state.playing ? 'pause' : 'play';
  if (lastPlayIcon !== icon) { $('b-play').innerHTML = ICONS[icon]; lastPlayIcon = icon; }
  $('b-shuffle').classList.toggle('on', state.shuffle);
  if (lastRepeat !== state.repeat) {
    $('b-repeat').innerHTML = state.repeat === 'one' ? ICONS.repeat1 : ICONS.repeat;
    $('b-repeat').classList.toggle('on', state.repeat !== 'off');
    $('b-repeat').title = state.repeat === 'off' ? 'Повтор выключен' : state.repeat === 'all' ? 'Повтор списка' : 'Повтор трека';
    lastRepeat = state.repeat;
  }
  document.body.classList.toggle('playing', state.playing);
  $('lyrics').classList.toggle('paused', !state.playing);
  lyKick();
  document.title = t ? `${state.playing ? '▶ ' : ''}${t.title} · ${t.artist}` : 'Sonara';
  if (ms) { try { ms.playbackState = t ? (state.playing ? 'playing' : 'paused') : 'none'; } catch {} }
  updateProgress();
  publishState();
}

/* ---------- состояние для мини-плеера и трея ---------- */
let pubKey = '', pubAt = 0;
function publishState(force) {
  if (!appInfo.version) return;
  const t = state.cur;
  const s = {
    hasTrack: !!t, title: t ? t.title : '', artist: t ? t.artist : '', art: t ? bigArt(t) : '', src: t ? t.src : '',
    album: t ? t.album || '' : '', url: t ? (t.src === 'sp' ? `https://open.spotify.com/track/${t.id}` : t.src === 'sc' ? t.url || '' : '') : '',
    playing: !!state.playing, time: Math.round(lyNow()), dur: Math.round(state.dur || 0), at: Date.now(),
  };
  const key = [s.title, s.artist, s.playing, s.dur].join('|');
  if (!force && key === pubKey && Date.now() - pubAt < 8000) return;
  pubKey = key; pubAt = Date.now();
  appCmd('state', s);
}

/* ---------- события от программы: команды из трея и мини-плеера, «тики» ---------- */
let events = null;
async function connectEvents() {
  let key;
  try {
    const r = await fetch('/api/app/key', { headers: { 'X-Player': '1' } });
    key = (await r.json()).key;
  } catch { setTimeout(connectEvents, 5000); return; }
  events = new EventSource(`/api/events?role=main&key=${key}`);
  events.addEventListener('cmd', (e) => {
    let d = {};
    try { d = JSON.parse(e.data); } catch {}
    if (d.cmd === 'toggle') togglePlay();
    else if (d.cmd === 'next') next(false);
    else if (d.cmd === 'prev') prev();
    else if (d.cmd === 'seek') seek(Number(d.value) || 0);
    else if (d.cmd === 'volume') setVolume(Number(d.value));
    else if (d.cmd === 'lyrics') setLyrics(true);
    setTimeout(() => publishState(true), 300);
  });
  events.addEventListener('tick', onTick);
  events.onerror = () => {
    if (events.readyState === 2) { events = null; setTimeout(connectEvents, 3000); }
  };
}
function onTick() {
  spcTick();
  listenTick();
  if (document.hidden) {
    maybeRelease();
    if (state.playing && Date.now() - pubAt > 8000) publishState(true);
  }
}

/* ---------- экономия памяти: в скрытом окне выгружаем картинки и тяжёлый фон ---------- */
let hiddenAt = 0, released = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); setTimeout(maybeRelease, 20000); }
  else { hiddenAt = 0; if (released) restoreVisible(); }
});
function maybeRelease() {
  if (!document.hidden || released || !hiddenAt || Date.now() - hiddenAt < 19000) return;
  released = true;
  for (const el of pool) el.remove();
  pool.length = 0;
  $('wall').style.backgroundImage = 'none';
  lastWallBg = null;
  $('side-cover-img').removeAttribute('src');
  lyEl.style.setProperty('--ly-img', 'none');
  $('ly-cover').removeAttribute('src');
}
function restoreVisible() {
  released = false;
  applyWall();
  vlReset();
  const big = bigArt(state.cur);
  if (big) $('side-cover-img').src = big;
  if (lyOpen) lyTrack();
  updatePlayer();
}
function updateProgress() {
  if (document.hidden) return;
  $('t-cur').textContent = fmt(state.time);
  $('t-dur').textContent = fmt(state.dur);
  if (!state.seeking) {
    const v = state.dur ? Math.round((state.time / state.dur) * 1000) : 0;
    if (Number(seekEl.value) !== v) seekEl.value = v;
    setFill(seekEl);
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateProgress(); });

/* ===================== Библиотека и виды ===================== */
const VIEW_TITLES = { all: 'Вся музыка', sp: 'Spotify', sc: 'SoundCloud', local: 'С компа', recs: 'Для тебя', radio: 'Радио', stats: 'Статистика' };
const curPl = () => (state.view.startsWith('pl:') ? plGet(state.view.slice(3)) : null);
function viewTitle() {
  if (state.view.startsWith('pl:')) { const p = curPl(); return p ? p.name : 'Плейлист'; }
  if (state.view === 'radio' && state.radio.seed) return 'Радио: ' + state.radio.seed.title;
  return VIEW_TITLES[state.view] || 'Sonara';
}
function rebuildAll() {
  state.all = [...state.lib.sp, ...state.lib.sc, ...state.lib.local].sort((a, b) => (b.at || 0) - (a.at || 0));
  render();
}
function viewSource() {
  if (state.view === 'sp') return state.lib.sp;
  if (state.view === 'sc') return state.lib.sc;
  if (state.view === 'local') return state.lib.local;
  if (state.view === 'stats') return [];
  if (state.view === 'recs') return state.recs;
  if (state.view === 'radio') return state.radio.tracks;
  if (state.view.startsWith('pl:')) { const p = curPl(); return p ? p.tracks.map(hydrateLocal) : []; }
  return state.all;
}
function filtered(list) {
  const q = norm(state.query);
  if (!q) return list;
  const words = q.split(' ');
  return list.filter((t) => {
    const k = t._k || (t._k = norm(t.title + ' ' + t.artist));
    return words.every((w) => k.includes(w));
  });
}
function render() {
  const nsp = state.lib.sp.length, nsc = state.lib.sc.length;
  $('cnt-all').textContent = nsp + nsc || '';
  $('cnt-sp').textContent = nsp || '';
  $('cnt-sc').textContent = nsc || '';
  $('cnt-local').textContent = state.lib.local.length || '';
  $('cnt-all').textContent = nsp + nsc + state.lib.local.length || '';
  state.list = filtered(viewSource());
  renderHead();
  renderEmpty();
  vlReset();
}
function renderHead() {
  $('view-title').textContent = viewTitle();
  const n = state.list.length;
  let sub = '';
  const isPl = state.view.startsWith('pl:');
  const loading = state.view === 'all' ? state.loading.sp || state.loading.sc
    : state.view === 'recs' ? state.recsLoading
    : state.view === 'radio' ? state.radio.loading || state.radio.more
    : isPl ? false : state.loading[state.view];
  if (state.view === 'radio') {
    sub = state.radio.loading ? 'Подбираю похожие треки…' : n ? `${n} ${plural(n, TRACKS)} · бесконечно, похожие подгружаются сами` : '';
  } else if (state.view === 'recs') {
    sub = state.recsLoading ? 'Подбираю треки по твоим лайкам…'
      : n ? `${n} ${plural(n, TRACKS)} с SoundCloud · на основе ${state.recsSeeds} ${plural(state.recsSeeds, ['лайка', 'лайков', 'лайков'])}` : '';
  } else if (state.query) {
    sub = `Найдено: ${n}`;
  } else if (n) {
    const total = state.list.reduce((s, t) => s + (t.duration || 0), 0);
    sub = `${n} ${plural(n, TRACKS)} · ${fmtTotal(total)}${loading ? ' · обновляю…' : ''}`;
  } else if (loading) sub = 'Загружаю лайки…';
  $('view-sub').textContent = sub;
  $('col3').textContent = state.view === 'recs' ? 'Похоже на' : 'Источник';
  const isStats = state.view === 'stats';
  document.querySelector('.cols').hidden = isStats;
  document.querySelector('.head-actions').hidden = isStats;
  if (isStats) sub = 'Сколько и что ты слушаешь. Трек засчитывается после 30 секунд';
  if (state.view === 'local' && !n && !state.query) sub = state.localFolders.length ? 'В папках не нашлось музыки' : '';
  $('view-sub').textContent = sub;
  $('act-play').disabled = !n;
  $('act-shuffle').disabled = !n || state.view === 'radio';
  $('act-refresh').classList.toggle('spin', !!loading);
  $('act-refresh').hidden = isPl;
  $('act-rename').hidden = !isPl;
  $('act-delete').hidden = !isPl;
  $('act-refresh').title = state.view === 'recs' ? 'Подобрать заново' : state.view === 'radio' ? 'Подгрузить ещё' : 'Обновить лайки';
}
function emptyCard(icon, title, text, buttons = '') {
  return `<div class="empty-card"><div class="brand-icon big">${icon}</div><h2>${title}</h2><p>${text}</p><div class="btns-row">${buttons}</div></div>`;
}
function renderEmpty() {
  const el = $('empty');
  if (state.list.length) { el.hidden = true; el.innerHTML = ''; return; }
  const hasAny = state.lib.sp.length || state.lib.sc.length;
  const btnSp = '<button class="pill accent" data-acc="sp">Подключить Spotify</button>';
  const btnSc = '<button class="pill" data-acc="sc">Подключить SoundCloud</button>';
  let html;
  if (state.query) html = emptyCard(ICONS.search, 'Ничего не нашлось', `По запросу «${escapeHtml(state.query)}» в этом разделе пусто.`);
  else if (state.view.startsWith('pl:')) html = emptyCard(ICONS.note, 'Плейлист пустой', 'Добавляй треки через ⋯ справа у трека или правой кнопкой мыши. Можно мешать Spotify и SoundCloud.');
  else if (state.view === 'radio') {
    html = state.radio.loading ? '<div class="empty-card"><div class="loader"></div><p>Настраиваю радио…</p></div>'
      : emptyCard(ICONS.radio, 'Радио по треку', 'Нажми ⋯ у любого трека и выбери «Радио по треку»: дальше будут бесконечно играть похожие.');
  } else if (state.view === 'recs') {
    if (state.recsLoading) html = '<div class="empty-card"><div class="loader"></div><p>Ищу похожие треки…</p></div>';
    else if (!hasAny) html = emptyCard(ICONS.sparkle, 'Подборка по твоим лайкам', 'Подключи Spotify или SoundCloud, и тут появятся похожие треки, которых у тебя ещё нет.', btnSp + btnSc);
    else html = emptyCard(ICONS.sparkle, 'Подборка по твоим лайкам', state.recsError || 'Нажми, и я найду похожие треки, которых у тебя ещё нет.', '<button class="pill accent" data-act="recs">Подобрать</button>');
  } else if (state.loading.sp || state.loading.sc) html = '<div class="empty-card"><div class="loader"></div><p>Загружаю лайки…</p></div>';
  else if (state.view === 'sp') html = emptyCard(ICONS.note, 'Spotify', LS.get('sp_token') ? 'Лайкнутых треков пока нет.' : 'Подключи аккаунт, и тут появятся твои лайки.', LS.get('sp_token') ? '' : btnSp);
  else if (state.view === 'stats') { el.hidden = true; el.innerHTML = ''; return; }
  else if (state.view === 'local') html = emptyCard(ICONS.folder, 'Музыка с компа', 'Добавь папку с mp3, wav или flac, например со своими битами. Подпапки тоже читаются.', '<button class="pill accent" data-acc="local">Добавить папку</button>');
  else if (state.view === 'sc') html = emptyCard(ICONS.note, 'SoundCloud', LS.get('sc_user') ? 'Лайков не нашлось. Проверь, что они открыты в профиле.' : 'Впиши свой ник, и тут появятся твои лайки.', btnSc.replace('class="pill"', 'class="pill accent"'));
  else html = emptyCard(ICONS.note, 'Подключи музыку', 'Твои лайки из Spotify и SoundCloud соберутся в одном списке.', btnSp + btnSc);
  el.innerHTML = html;
  el.hidden = false;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('empty').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.acc) { openSettings('acc'); setTimeout(() => $(b.dataset.acc === 'sp' ? 'sp-client' : b.dataset.acc === 'local' ? 'lc-path' : 'sc-user').focus(), 50); }
  if (b.dataset.act === 'recs') loadRecs(true);
});

function setView(v) {
  setLyrics(false);
  state.view = v;
  document.querySelectorAll('.nav[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  scroller.scrollTop = 0;
  render();
  $('stats').hidden = v !== 'stats';
  listEl.hidden = v === 'stats';
  if (v === 'stats') renderStats();
  if (v === 'local') loadLocal(false);
  if (v === 'recs' && !state.recsLoading && (!state.recs.length || Date.now() - state.recsAt > 12 * 3600e3)) {
    if (state.lib.sp.length || state.lib.sc.length) loadRecs(true);
  }
}

/* ---------- виртуальный список: в DOM только видимые строки ---------- */
const scroller = $('scroller');
const listEl = $('list');
const pool = [];
let rowH = 56;
function readRowH() { rowH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h')) || 56; }
function makeRow() {
  const el = document.createElement('div');
  el.className = 'row';
  el.draggable = true;
  el.innerHTML = '<div class="n"><span class="num"></span><span class="eq"><i></i><i></i><i></i></span><span class="hov">' + ICONS.play +
    '</span></div><div class="ti"><img class="cv" alt="" decoding="async"><div class="tx"><div class="tt"></div><div class="ar"></div></div></div><div class="c3"></div><div class="d"><span class="dur"></span><button class="more" title="Ещё">' + ICONS.more + '</button></div>';
  el._num = el.querySelector('.num');
  el._img = el.querySelector('img');
  el._tt = el.querySelector('.tt');
  el._ar = el.querySelector('.ar');
  el._c3 = el.querySelector('.c3');
  el._d = el.querySelector('.dur');
  return el;
}
// заглушка для треков без обложки: серая нота на прозрачном фоне
const NO_COVER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g transform="translate(9 9) scale(.92)" fill="none" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".7"><path d="M9 17.5V6.6l10-2.4v10.9"/><circle cx="6.6" cy="17.6" r="2.4" fill="#8e8e93"/><circle cx="16.6" cy="15.1" r="2.4" fill="#8e8e93"/></g></svg>');
const isCur = (t) => !!state.cur && state.cur.src === t.src && state.cur.id === t.id;
function fillRow(el, t, i) {
  const key = t.src + ':' + t.id + ':' + i;
  if (el._key !== key) {
    el._key = key;
    el._i = i;
    el.style.transform = `translateY(${i * rowH}px)`;
    el._num.textContent = i + 1;
    el._tt.textContent = t.title;
    el._ar.textContent = t.artist;
    const cv = t.cover || NO_COVER;
    if (el._img.getAttribute('src') !== cv) el._img.src = cv;
    if (state.view === 'recs') el._c3.textContent = t.because ? t.because : '';
    else el._c3.innerHTML = t.src === 'sp' ? '<span class="badge sp">Spotify</span>' : t.src === 'local' ? '<span class="badge lc">С компа</span>' : '<span class="badge sc">SoundCloud</span>';
    el._d.textContent = t.duration ? fmt(t.duration) : '—';
  }
  const cur = isCur(t);
  if (el._cur !== cur) { el._cur = cur; el.classList.toggle('cur', cur); }
}
function vlRender() {
  const list = state.list;
  const n = list.length;
  listEl.style.height = n * rowH + 'px';
  const top = scroller.scrollTop - listEl.offsetTop;
  const h = scroller.clientHeight;
  const start = Math.max(0, Math.floor(top / rowH) - 6);
  const end = Math.min(n, Math.ceil((top + h) / rowH) + 6);
  const need = Math.max(0, end - start);
  while (pool.length < need) { const r = makeRow(); listEl.appendChild(r); pool.push(r); }
  for (let k = 0; k < pool.length; k++) {
    const el = pool[k];
    const i = start + k;
    if (i < end) { fillRow(el, list[i], i); if (el.hidden) el.hidden = false; }
    else if (!el.hidden) { el.hidden = true; el._key = null; }
  }
}
function vlReset() { for (const el of pool) { el._key = null; el._cur = null; } vlRender(); }
function refreshCurrentRows() { for (const el of pool) if (!el.hidden && el._key) { const t = state.list[el._i]; if (t) { const c = isCur(t); if (el._cur !== c) { el._cur = c; el.classList.toggle('cur', c); } } } }
let rafPending = false;
scroller.addEventListener('scroll', () => {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    scroller.classList.toggle('scrolled', scroller.scrollTop > 8);
    vlRender();
  });
}, { passive: true });
window.addEventListener('resize', () => vlRender());
listEl.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row || !row._key) return;
  const more = e.target.closest('.more');
  if (more) { const r = more.getBoundingClientRect(); openTrackMenu(state.list[row._i], row._i, r.right, r.bottom + 4, true); return; }
  playFrom(state.list, row._i);
});
listEl.addEventListener('contextmenu', (e) => {
  const row = e.target.closest('.row');
  if (!row || !row._key) return;
  e.preventDefault();
  openTrackMenu(state.list[row._i], row._i, e.clientX, e.clientY);
});

/* ===================== SoundCloud: библиотека ===================== */
function parseScUser(v) {
  v = String(v || '').trim();
  const m = v.match(/soundcloud\.com\/([^/?#\s]+)/i);
  if (m) v = m[1];
  return v.replace(/^@/, '');
}
async function scLoadLikes(force) {
  const user = LS.get('sc_user');
  if (!user || state.loading.sc) return;
  state.loading.sc = true;
  setAccState('sc', 'Загружаю лайки…');
  renderHead(); renderEmpty();
  let stale = false;
  try {
    const r = await api(`/api/sc/likes?user=${encodeURIComponent(user)}${force ? '&force=1' : ''}`);
    state.lib.sc = r.tracks || [];
    stale = !!r.cached && Date.now() - (r.at || 0) > 30 * 60 * 1000;
    setAccState('sc', `${state.lib.sc.length} ${plural(state.lib.sc.length, TRACKS)}`, 'ok');
    rebuildAll();
  } catch (e) {
    setAccState('sc', e.message, 'err');
    toast('SoundCloud: ' + e.message);
  } finally {
    state.loading.sc = false;
    render();
  }
  if (stale) scLoadLikes(true);
}

/* ===================== Подбор треков ===================== */
async function loadRecs(force) {
  const sc = state.lib.sc, spl = state.lib.sp;
  if (!sc.length && !spl.length) { render(); return; }
  if (!force && state.recs.length && Date.now() - state.recsAt < 12 * 3600e3) return;
  if (state.recsLoading) return;
  state.recsLoading = true;
  state.recsError = '';
  if (state.view === 'recs') { state.list = []; renderHead(); renderEmpty(); vlReset(); }
  const nSc = sc.length ? (spl.length ? 8 : 14) : 0;
  const nSp = spl.length ? (sc.length ? 6 : 12) : 0;
  const seeds = [
    ...sample(sc.slice(0, 250), nSc).map((t) => ({ id: t.id, title: t.title, artist: t.artist })),
    ...sample(spl.slice(0, 250), nSp).map((t) => ({ title: t.title, artist: t.artist.split(',')[0] })),
  ];
  try {
    const r = await api('/api/recs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seeds }) });
    const likedSc = new Set(sc.map((t) => t.id));
    const likedKeys = new Set([...sc, ...spl].map(trackKey));
    const perArtist = new Map();
    const out = [];
    for (const t of r.tracks || []) {
      if (likedSc.has(t.id) || likedKeys.has(trackKey(t))) continue;
      const a = norm(t.artist);
      const c = perArtist.get(a) || 0;
      if (c >= 2) continue;
      perArtist.set(a, c + 1);
      out.push(t);
      if (out.length >= 60) break;
    }
    state.recs = out;
    state.recsSeeds = r.seeds || seeds.length;
    state.recsAt = Date.now();
    if (!out.length) state.recsError = 'Ничего нового не нашлось. Попробуй ещё раз, возьму другие лайки.';
    LS.set('recs', JSON.stringify({ at: state.recsAt, tracks: out, seeds: state.recsSeeds }));
  } catch (e) {
    state.recsError = 'Не получилось подобрать: ' + e.message;
  } finally {
    state.recsLoading = false;
    render();
  }
}

/* ===================== Диалог (имя плейлиста, подтверждение) ===================== */
function dialog({ title, text = '', value = null, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const wrap = $('dialog'), input = $('dlg-input'), okBtn = $('dlg-ok');
    $('dlg-title').textContent = title;
    $('dlg-text').textContent = text;
    $('dlg-text').hidden = !text;
    input.hidden = value === null;
    input.value = value || '';
    okBtn.textContent = ok;
    okBtn.style.background = danger ? '#ff453a' : '';
    wrap.hidden = false;
    if (value !== null) setTimeout(() => { input.focus(); input.select(); }, 30);
    else setTimeout(() => okBtn.focus(), 30);
    const done = (res) => {
      wrap.hidden = true;
      okBtn.onclick = null; $('dlg-cancel').onclick = null; input.onkeydown = null; wrap.onmousedown = null;
      resolve(res);
    };
    okBtn.onclick = () => done(value === null ? true : input.value.trim());
    $('dlg-cancel').onclick = () => done(null);
    input.onkeydown = (e) => { if (e.key === 'Enter') okBtn.click(); if (e.key === 'Escape') done(null); };
    wrap.onmousedown = (e) => { if (e.target === wrap) done(null); };
  });
}

/* ===================== Плейлисты ===================== */
let playlists = LS.json('playlists', []);
if (!Array.isArray(playlists)) playlists = [];
const plGet = (id) => playlists.find((p) => p.id === id) || null;
function savePlaylists() { LS.set('playlists', JSON.stringify(playlists)); renderSidebarPlaylists(); }
function plSlim(t) {
  const o = {};
  for (const k of ['src', 'id', 'uri', 'url', 'title', 'artist', 'album', 'cover', 'art', 'big', 'duration', 'hasPicture']) if (t[k] != null && t[k] !== '') o[k] = t[k];
  return o;
}
function renderSidebarPlaylists() {
  const box = $('pl-list');
  box.innerHTML = '';
  for (const p of playlists) {
    const b = document.createElement('button');
    b.className = 'nav' + (state.view === 'pl:' + p.id ? ' active' : '');
    b.dataset.view = 'pl:' + p.id;
    b.dataset.pl = p.id;
    b.title = p.name;
    b.innerHTML = `<i class="pl-ico">${escapeHtml((p.name.trim()[0] || '♪').toUpperCase())}</i><span class="lbl"></span><span class="cnt">${p.tracks.length || ''}</span>`;
    b.querySelector('.lbl').textContent = p.name;
    box.appendChild(b);
  }
}
async function plCreate(firstTrack) {
  const name = await dialog({ title: 'Новый плейлист', value: '', ok: 'Создать' });
  if (!name) return null;
  const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.slice(0, 60), tracks: [] };
  if (firstTrack) p.tracks.push(plSlim(firstTrack));
  playlists.push(p);
  savePlaylists();
  toast(firstTrack ? `Создал «${p.name}» и добавил трек` : `Плейлист «${p.name}» создан`);
  return p;
}
function plAdd(p, t) {
  if (p.tracks.some((x) => x.src === t.src && x.id === t.id)) { toast(`Уже есть в «${p.name}»`); return; }
  p.tracks.push(plSlim(t));
  savePlaylists();
  toast(`Добавлено в «${p.name}»`);
  if (state.view === 'pl:' + p.id) render();
}
function plRemove(p, t) {
  const i = p.tracks.findIndex((x) => x.src === t.src && x.id === t.id);
  if (i < 0) return;
  p.tracks.splice(i, 1);
  savePlaylists();
  render();
}
async function plRename(p) {
  const name = await dialog({ title: 'Переименовать плейлист', value: p.name, ok: 'Сохранить' });
  if (!name) return;
  p.name = name.slice(0, 60);
  savePlaylists();
  renderHead();
}
async function plDelete(p) {
  const ok = await dialog({ title: `Удалить «${p.name}»?`, text: 'Треки останутся в библиотеке, удалится только сам плейлист.', ok: 'Удалить', danger: true });
  if (!ok) return;
  playlists = playlists.filter((x) => x !== p);
  savePlaylists();
  setView('all');
}
$('pl-new').addEventListener('click', async () => { const p = await plCreate(null); if (p) setView('pl:' + p.id); });

// перетаскивание трека из списка на плейлист в боковой панели
listEl.addEventListener('dragstart', (e) => {
  const row = e.target.closest('.row');
  if (!row || !row._key) return;
  e.dataTransfer.setData('text/x-track', String(row._i));
  e.dataTransfer.effectAllowed = 'copy';
});
$('pl-list').addEventListener('dragover', (e) => {
  const b = e.target.closest('.nav[data-pl]');
  if (!b || !e.dataTransfer.types.includes('text/x-track')) return;
  e.preventDefault();
  document.querySelectorAll('.nav.drop').forEach((x) => x !== b && x.classList.remove('drop'));
  b.classList.add('drop');
});
$('pl-list').addEventListener('dragleave', (e) => { const b = e.target.closest('.nav[data-pl]'); if (b) b.classList.remove('drop'); });
$('pl-list').addEventListener('drop', (e) => {
  const b = e.target.closest('.nav[data-pl]');
  document.querySelectorAll('.nav.drop').forEach((x) => x.classList.remove('drop'));
  if (!b) return;
  e.preventDefault();
  const t = state.list[Number(e.dataTransfer.getData('text/x-track'))];
  const p = plGet(b.dataset.pl);
  if (t && p) plAdd(p, t);
});

/* ===================== Радио по треку ===================== */
const seedOf = (t) => (t.src === 'sc' ? { id: t.id, title: t.title, artist: t.artist } : { title: t.title, artist: String(t.artist || '').split(',')[0] });
async function fetchSimilar(seeds) {
  const r = await api('/api/recs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seeds }) });
  return (r && r.tracks) || [];
}
function addRadio(res, max) {
  const r = state.radio;
  const keys = new Set(r.tracks.map(trackKey));
  const ids = new Set(r.tracks.map((x) => x.src + ':' + x.id));
  const per = new Map();
  // не больше двух треков одного артиста среди последних 25, чтобы радио не зацикливалось
  for (const x of r.tracks.slice(-25)) { const a = norm(x.artist); per.set(a, (per.get(a) || 0) + 1); }
  const added = [];
  for (const x of res) {
    const a = norm(x.artist);
    if (ids.has('sc:' + x.id) || keys.has(trackKey(x)) || (per.get(a) || 0) >= 2) continue;
    per.set(a, (per.get(a) || 0) + 1);
    ids.add('sc:' + x.id); keys.add(trackKey(x));
    added.push(x);
    if (added.length >= max) break;
  }
  r.tracks.push(...added);
  if (state.queueKind === 'radio') {
    const base = state.queue.length;
    state.queue.push(...added);
    state.order.push(...added.map((_, i) => base + i));
  }
  return added.length;
}
async function startRadio(t) {
  closeMenu();
  const seed = plSlim(t);
  state.radio = { seed, tracks: [seed], loading: true, more: false };
  $('nav-radio').hidden = false;
  setView('radio');
  const wasCur = isCur(t);
  try {
    const res = await fetchSimilar([seedOf(t)]);
    if (state.radio.seed !== seed) return;
    addRadio(res, 25);
  } catch (e) {
    if (state.radio.seed === seed) toast('Радио: ' + e.message);
  }
  if (state.radio.seed !== seed) return;
  state.radio.loading = false;
  if (state.view === 'radio') render();
  const list = state.radio.tracks;
  if (list.length < 2) return;
  if (wasCur && state.cur) {
    // трек уже играет: просто меняем очередь на радио, без перезапуска
    state.queueKind = 'radio';
    state.queue = list.slice();
    state.queue[0] = state.cur;
    state.order = list.map((_, i) => i);
    state.pos = 0;
  } else playFrom(list, 0, 'radio');
}
async function radioMore() {
  const r = state.radio;
  if (!r.seed || r.more || r.loading) return;
  r.more = true;
  if (state.view === 'radio') renderHead();
  try {
    const around = state.queueKind === 'radio' ? state.queue.slice(Math.max(0, state.pos - 2), state.pos + 1) : r.tracks.slice(-3);
    const seeds = [...around.filter((x) => x.src === 'sc'), r.seed].slice(0, 4).map(seedOf);
    let n = addRadio(await fetchSimilar(seeds), 15);
    if (!n) n = addRadio(await fetchSimilar(sample(r.tracks.filter((x) => x.src === 'sc'), 3).map(seedOf)), 15);
  } catch (e) { console.warn(e); }
  finally {
    r.more = false;
    if (state.view === 'radio') { state.list = filtered(r.tracks); renderHead(); renderEmpty(); vlRender(); }
  }
}

/* ===================== Меню трека ===================== */
const ctxEl = $('ctx');
let ctxOpen = false;
function closeMenu() { if (!ctxOpen) return; ctxOpen = false; ctxEl.hidden = true; ctxEl.innerHTML = ''; }
function openTrackMenu(t, idx, x, y, alignRight) {
  if (!t) return;
  const items = [];
  const add = (label, icon, act, cls = '') => items.push({ label, icon, act, cls });
  add('Радио по треку', ICONS.radio, () => startRadio(t));
  if (state.cur && state.queue.length) add('Играть следующим', ICONS.queue, () => {
    state.queue.push(t);
    state.order.splice(state.pos + 1, 0, state.queue.length - 1);
    toast('Будет играть следующим');
  });
  items.push({ sep: true }, { head: 'Добавить в плейлист' });
  for (const p of playlists) add(p.name, ICONS.list, () => plAdd(p, t));
  add('Новый плейлист…', ICONS.plus, () => plCreate(t));
  const pl = curPl();
  if (pl) { items.push({ sep: true }); add('Убрать из плейлиста', ICONS.minus, () => plRemove(pl, t), 'danger'); }
  const ext = t.src === 'sp' ? `https://open.spotify.com/track/${t.id}` : t.url;
  if (ext && /^https?:/.test(ext)) { items.push({ sep: true }); add(t.src === 'sp' ? 'Открыть в Spotify' : 'Открыть на SoundCloud', ICONS.link, () => window.open(ext, '_blank')); }

  ctxEl.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'ctx-head';
  head.innerHTML = '<img alt=""><div><b></b><small></small></div>';
  head.querySelector('img').src = t.cover || NO_COVER;
  head.querySelector('b').textContent = t.title;
  head.querySelector('small').textContent = t.artist;
  ctxEl.appendChild(head);
  for (const it of items) {
    if (it.sep) { const d = document.createElement('div'); d.className = 'sep'; ctxEl.appendChild(d); continue; }
    if (it.head) { const d = document.createElement('div'); d.className = 'mh'; d.textContent = it.head; ctxEl.appendChild(d); continue; }
    const b = document.createElement('button');
    b.className = 'mi ' + it.cls;
    b.innerHTML = it.icon + '<span></span>';
    b.querySelector('span').textContent = it.label;
    b.addEventListener('click', () => { closeMenu(); it.act(); });
    ctxEl.appendChild(b);
  }
  ctxEl.hidden = false;
  ctxOpen = true;
  const w = ctxEl.offsetWidth, h = ctxEl.offsetHeight;
  let left = alignRight ? x - w : x;
  let top = y;
  if (left + w > innerWidth - 8) left = innerWidth - w - 8;
  if (top + h > innerHeight - 8) top = Math.max(8, y - h - (alignRight ? 36 : 0));
  ctxEl.style.left = Math.max(8, left) + 'px';
  ctxEl.style.top = Math.max(8, top) + 'px';
}
document.addEventListener('mousedown', (e) => { if (ctxOpen && !ctxEl.contains(e.target)) closeMenu(); }, true);
scroller.addEventListener('scroll', closeMenu, { passive: true });
window.addEventListener('blur', closeMenu);
$('player').addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.np') || !state.cur) return;
  e.preventDefault();
  openTrackMenu(state.cur, -1, e.clientX, e.clientY);
});

/* ===================== Музыка с компа ===================== */
function hydrateLocal(t) {
  if (t.src !== 'local') return t;
  const c = t.hasPicture ? `/api/local/cover?id=${encodeURIComponent(t.id)}` : '';
  t.cover = c; t.art = c; t.big = c;
  return t;
}
async function localPlay(t, token) {
  scMode = 'audio';
  hlsCleanup();
  audio.pause();
  audio.src = `/api/local/file?id=${encodeURIComponent(t.id)}`;
  audio.volume = gain();
  try { await audio.play(); }
  catch (e) {
    if (e.name === 'NotAllowedError') { state.playing = false; updatePlayer(); return; }
    if (e.name === 'AbortError' || token !== state.token) return;
    throw new Error('Не получилось открыть файл: формат не поддерживается или файл перемещён');
  }
}
let localLoading = false;
async function loadLocal(force) {
  if (localLoading) return;
  localLoading = true;
  try {
    const r = await fetch('/api/app/local' + (force ? '?force=1' : ''), { headers: { 'X-Player': '1' } }).then((x) => x.json());
    applyLocal(r);
  } catch (e) { console.warn(e); }
  finally { localLoading = false; }
}
function applyLocal(r) {
  if (!r || !Array.isArray(r.tracks)) return;
  state.lib.local = r.tracks.map(hydrateLocal);
  state.localFolders = r.folders || [];
  if (typeof r.native === 'boolean') $('lc-pick').hidden = !r.native;
  renderFolders();
  rebuildAll();
}
function renderFolders() {
  const box = $('lc-folders');
  box.innerHTML = '';
  for (const f of state.localFolders) {
    const d = document.createElement('div');
    d.className = 'folder';
    d.innerHTML = `<span></span><button title="Убрать папку">${ICONS.x}</button>`;
    d.querySelector('span').textContent = f;
    d.querySelector('span').title = f;
    d.querySelector('button').addEventListener('click', () => localCmd('remove', { path: f }));
    box.appendChild(d);
  }
  const n = state.lib.local.length;
  $('lc-state').textContent = state.localFolders.length ? `${n} ${plural(n, TRACKS)}` : 'Не добавлено';
  $('lc-state').className = 'state' + (n ? ' ok' : '');
}
async function localCmd(name, body) {
  $('lc-state').textContent = 'Читаю папки…';
  try {
    const r = await fetch('/api/app/local/' + name, { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'ошибка');
    applyLocal(j);
    if (name !== 'remove' && j.tracks) toast(`С компа: ${j.tracks.length} ${plural(j.tracks.length, TRACKS)}`);
  } catch (e) { toast(e.message); renderFolders(); }
}
$('lc-add').addEventListener('click', () => { const v = $('lc-path').value.trim(); if (v) { localCmd('add', { path: v }); $('lc-path').value = ''; } });
$('lc-path').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lc-add').click(); });
$('lc-pick').addEventListener('click', () => localCmd('pick'));

/* ===================== Учёт прослушиваний (для статистики) ===================== */
const listen = { t: null, ms: 0, last: 0 };
function listenTick() {
  const now = Date.now();
  if (listen.t && state.playing && state.cur && state.cur.src === listen.t.src && state.cur.id === listen.t.id) {
    listen.ms += Math.min(now - (listen.last || now), 65000);
  }
  listen.last = now;
}
function listenFlush(keepalive) {
  const t = listen.t;
  if (t && (listen.ms >= 30000 || (t.duration && listen.ms >= t.duration * 0.5 && listen.ms >= 10000))) {
    const body = JSON.stringify({ t: plSlim(t), ms: Math.round(listen.ms), at: Date.now() });
    fetch('/api/app/play-log', { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body, keepalive: !!keepalive }).catch(() => {});
  }
  listen.t = null;
  listen.ms = 0;
}
function listenStart(t) { listenTick(); listenFlush(); listen.t = t; listen.last = Date.now(); }
setInterval(listenTick, 1000);

/* ===================== Статистика ===================== */
async function renderStats() {
  const box = $('stats');
  const range = state.statsRange;
  let st;
  try { st = await fetch('/api/app/stats?range=' + range, { headers: { 'X-Player': '1' } }).then((r) => r.json()); }
  catch { box.innerHTML = '<p class="hint">Не получилось загрузить статистику.</p>'; return; }
  if (state.view !== 'stats') return;
  const min = Math.round(st.totalMs / 60000);
  const seg = `<div class="seg" id="st-range">${[['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']].map(([k, l]) => `<button data-r="${k}" class="${k === range ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (!st.plays) {
    box.innerHTML = seg + emptyCard(ICONS.chart, 'Пока пусто', 'Слушай музыку, и тут начнёт копиться: сколько минут, любимые треки и артисты. Трек засчитывается после 30 секунд.');
    bindStats();
    return;
  }
  const maxDay = Math.max(1, ...st.chart.map((d) => d.ms));
  const step = st.chart.length > 10 ? 5 : 1;
  const bars = st.chart.map((d, i) => {
    const [, mm, dd] = d.day.split('-');
    const h = Math.round((d.ms / maxDay) * 100);
    const label = i % step === 0 || i === st.chart.length - 1 ? `<small>${dd}.${mm}</small>` : '';
    return `<div class="st-bar${d.ms ? '' : ' zero'}" title="${dd}.${mm}: ${Math.round(d.ms / 60000)} мин"><i style="height:${Math.max(h, 2)}%"></i>${label}</div>`;
  }).join('');
  const srcTotal = Math.max(1, st.sources.sp + st.sources.sc + st.sources.local);
  const srcs = [['sp', 'Spotify', '#1ed760'], ['sc', 'SoundCloud', '#ff7700'], ['local', 'С компа', '#8e8e93']].filter(([k]) => st.sources[k] > 0);
  const maxArt = Math.max(1, ...st.topArtists.map((a) => a.count));
  box.innerHTML = seg + `
    <div class="st-cards">
      <div class="st-card"><b>${min >= 600 ? Math.round(min / 60) + ' ч' : min + ' мин'}</b><span>прослушано</span></div>
      <div class="st-card"><b>${st.plays}</b><span>${plural(st.plays, ['прослушивание', 'прослушивания', 'прослушиваний'])}</span></div>
      <div class="st-card"><b>${st.uniqueTracks}</b><span>${plural(st.uniqueTracks, ['разный трек', 'разных трека', 'разных треков'])}</span></div>
      <div class="st-card"><b>${st.uniqueArtists}</b><span>${plural(st.uniqueArtists, ['артист', 'артиста', 'артистов'])}</span></div>
    </div>
    <div class="st-chart">${bars}</div>
    <div class="st-src">${srcs.map(([k, , c]) => `<i style="width:${(st.sources[k] / srcTotal) * 100}%;background:${c}"></i>`).join('')}</div>
    <div class="st-legend">${srcs.map(([k, l, c]) => `<span style="--c:${c}">${l} · ${Math.round((st.sources[k] / srcTotal) * 100)}%</span>`).join('')}</div>
    <div class="st-cols">
      <div><h3>Любимые треки</h3><div id="st-tracks"></div></div>
      <div><h3>Любимые артисты</h3><div id="st-artists"></div></div>
    </div>`;
  const tl = $('st-tracks');
  st.topTracks.forEach((x, i) => {
    const t = hydrateLocal({ ...x.t });
    const d = document.createElement('div');
    d.className = 'st-item';
    d.innerHTML = `<span class="r">${i + 1}</span><img alt=""><div><b></b><small></small></div><span class="c">${x.count} ×</span>`;
    d.querySelector('img').src = t.cover || NO_COVER;
    d.querySelector('b').textContent = t.title;
    d.querySelector('small').textContent = t.artist;
    d.title = 'Включить';
    d.addEventListener('click', () => playFrom(st.topTracks.map((y) => hydrateLocal({ ...y.t })), i, 'list'));
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); openTrackMenu(t, -1, e.clientX, e.clientY); });
    tl.appendChild(d);
  });
  const al = $('st-artists');
  st.topArtists.forEach((a, i) => {
    const d = document.createElement('div');
    d.className = 'st-item art';
    d.innerHTML = `<span class="r">${i + 1}</span><div><b></b><div class="meter" style="width:${(a.count / maxArt) * 100}%"></div></div><span class="c">${a.count} × · ${Math.round(a.ms / 60000)} мин</span>`;
    d.querySelector('b').textContent = a.name;
    al.appendChild(d);
  });
  bindStats();
}
function bindStats() {
  const seg = $('st-range');
  if (seg) seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.statsRange = b.dataset.r; renderStats(); } });
}

/* ===================== Discord ===================== */
async function loadDiscord() {
  try {
    const r = await fetch('/api/app/discord', { headers: { 'X-Player': '1' } }).then((x) => x.json());
    showDiscord(r);
  } catch {}
}
function showDiscord(r) {
  $('dc-on').checked = !!r.on;
  if (document.activeElement !== $('dc-id')) $('dc-id').value = r.id || '';
  $('dc-state').textContent = r.on ? r.status : 'Выключено';
  $('dc-state').className = 'state' + (r.on && /подключено/.test(r.status) ? ' ok' : r.on && /отказал|нужен|не запущен/.test(r.status) ? ' err' : '');
}
async function saveDiscord() {
  const id = $('dc-id').value.trim();
  const on = $('dc-on').checked;
  if (on && !/^\d{15,25}$/.test(id)) { $('dc-state').textContent = 'Вставь Application ID (длинное число)'; $('dc-state').className = 'state err'; return; }
  $('dc-state').textContent = 'Подключаюсь…';
  try {
    const r = await fetch('/api/app/discord', { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ on, id }) }).then((x) => x.json());
    showDiscord(r);
    setTimeout(loadDiscord, 2500);
    publishState(true);
  } catch { $('dc-state').textContent = 'Ошибка'; }
}
$('dc-save').addEventListener('click', saveDiscord);
$('dc-on').addEventListener('change', saveDiscord);

/* ===================== Настройки ===================== */
function openSettings(tab = 'look') { $('settings').hidden = false; setTab(tab); syncSettingsUI(); syncAccounts(); }
function closeSettings() { $('settings').hidden = true; }
function setTab(tab) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('.sheet section').forEach((s) => { s.hidden = s.dataset.pane !== tab; });
}
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
$('open-settings').addEventListener('click', () => openSettings('look'));
$('close-settings').addEventListener('click', closeSettings);
$('settings').addEventListener('mousedown', (e) => { if (e.target === $('settings')) closeSettings(); });

function buildSettings() {
  const pBox = $('presets');
  pBox.innerHTML = '';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'preset';
    b.dataset.id = p.id;
    const pv = p.mode === 'dark' ? PV_DARK : PV_LIGHT;
    const bg = p.wall === 'cover' ? 'linear-gradient(135deg, #3a1c3f, #b33a5b 55%, #f0a35e)' : WALLS[p.wall].css;
    b.innerHTML = `<div class="pv" style="background:${bg};--pv-side:${pv[0]};--pv-main:${pv[1]};--pv-acc:${p.accent}"><div class="w"><i></i><i></i></div></div><span>${p.name}</span>`;
    b.addEventListener('click', () => {
      Object.assign(ui, { preset: p.id, mode: p.mode, accent: p.accent, wall: p.wall, alpha: p.alpha });
      saveUI(); applyUI();
    });
    pBox.appendChild(b);
  }

  const aBox = $('accents');
  aBox.innerHTML = '';
  for (const [name, c] of ACCENTS) {
    const b = document.createElement('button');
    b.className = 'sw';
    b.title = name;
    b.dataset.c = c;
    b.style.setProperty('--c', c);
    b.addEventListener('click', () => { ui.accent = c; ui.preset = null; saveUI(); applyUI(); });
    aBox.appendChild(b);
  }
  const custom = document.createElement('label');
  custom.className = 'sw sw-custom';
  custom.title = 'Свой цвет';
  custom.innerHTML = '<input type="color" id="accent-custom">';
  aBox.appendChild(custom);
  $('accent-custom').addEventListener('input', (e) => { ui.accent = e.target.value.toUpperCase(); ui.preset = null; applyUI(); });
  $('accent-custom').addEventListener('change', saveUI);

  buildWalls();

  $('mode-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ui.mode = b.dataset.mode; ui.preset = null; saveUI(); applyUI();
  });
  const bindRange = (id, key) => {
    const el = $(id);
    el.addEventListener('input', () => { ui[key] = Number(el.value); ui.preset = key === 'blur' ? ui.preset : null; setFill(el); applyUI(); });
    el.addEventListener('change', saveUI);
  };
  bindRange('opt-alpha', 'alpha');
  bindRange('opt-blur', 'blur');
  $('opt-lite').addEventListener('change', (e) => { ui.lite = e.target.checked; saveUI(); applyUI(); });
  $('opt-compact').addEventListener('change', (e) => { ui.compact = e.target.checked; saveUI(); applyUI(); });
  $('opt-tray').addEventListener('change', (e) => { ui.tray = e.target.checked; saveUI(); appCmd('settings', { closeToTray: ui.tray }); });
  $('wall-file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) onWallFile(f); e.target.value = ''; });
}
function buildWalls() {
  const wBox = $('walls');
  wBox.innerHTML = '';
  for (const [id, w] of Object.entries(WALLS)) {
    const b = document.createElement('button');
    b.className = 'wl';
    b.dataset.id = id;
    if (w.css) b.style.background = w.css;
    else if (id === 'plain') b.style.background = 'var(--plain)';
    else if (id === 'cover') b.style.background = 'linear-gradient(135deg, #3a1c3f, #b33a5b 55%, #f0a35e)';
    else if (id === 'custom') {
      const img = LS.get('wallImg');
      if (img) b.style.backgroundImage = `url("${img}")`;
      else { b.style.background = 'var(--field)'; b.innerHTML = ICONS.image; }
    }
    b.insertAdjacentHTML('beforeend', `<span>${w.name}</span>`);
    b.addEventListener('click', () => {
      if (id === 'custom' && (!LS.get('wallImg') || ui.wall === 'custom')) { $('wall-file').click(); return; }
      ui.wall = id; ui.preset = null; saveUI(); applyUI();
    });
    wBox.appendChild(b);
  }
}
async function onWallFile(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const url = c.toDataURL('image/jpeg', 0.82);
    if (!LS.set('wallImg', url)) { toast('Картинка слишком большая, выбери поменьше'); return; }
    ui.wall = 'custom'; ui.preset = null; saveUI();
    lastWallBg = null;
    buildWalls(); applyUI();
  } catch { toast('Не получилось открыть картинку'); }
}
function syncSettingsUI() {
  if ($('settings').hidden) return;
  document.querySelectorAll('.preset').forEach((b) => b.classList.toggle('on', b.dataset.id === ui.preset));
  document.querySelectorAll('#mode-seg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === ui.mode));
  let matched = false;
  document.querySelectorAll('.sw[data-c]').forEach((b) => { const on = b.dataset.c.toLowerCase() === String(ui.accent).toLowerCase(); matched = matched || on; b.classList.toggle('on', on); });
  const custom = document.querySelector('.sw-custom');
  if (custom) { custom.classList.toggle('on', !matched); custom.style.setProperty('--c', ui.accent); }
  if ($('accent-custom') && /^#[0-9a-f]{6}$/i.test(ui.accent)) $('accent-custom').value = ui.accent.toLowerCase();
  document.querySelectorAll('.wl').forEach((b) => b.classList.toggle('on', b.dataset.id === ui.wall));
  $('opt-alpha').value = ui.alpha; setFill($('opt-alpha'));
  $('opt-blur').value = ui.blur; setFill($('opt-blur'));
  $('opt-lite').checked = !!ui.lite;
  $('opt-compact').checked = !!ui.compact;
  $('opt-tray').checked = ui.tray !== false;
}

/* ---------- аккаунты ---------- */
const accState = { sp: { text: '', cls: '' }, sc: { text: '', cls: '' } };
function setAccState(src, text, cls = '') { accState[src] = { text, cls }; syncAccounts(); }
function syncAccounts() {
  const connected = !!LS.get('sp_token');
  const spEl = $('sp-state');
  const name = spEl.dataset.name;
  const s = accState.sp;
  spEl.textContent = s.cls === 'err' || !connected ? (s.text || 'Не подключён') : `${name ? name + ' · ' : ''}${s.text || 'Подключён'}`;
  spEl.className = 'state ' + (connected && s.cls !== 'err' ? 'ok' : s.cls);
  $('sp-connect').textContent = connected ? 'Переподключить' : 'Подключить';
  $('sp-logout').hidden = !connected;
  const c = accState.sc;
  $('sc-state').textContent = c.text || (LS.get('sc_user') ? '' : 'Не подключён');
  $('sc-state').className = 'state ' + c.cls;
}
$('sp-connect').addEventListener('click', spLogin);
$('sp-logout').addEventListener('click', spLogout);
$('sc-load').addEventListener('click', () => {
  const user = parseScUser($('sc-user').value);
  if (!/^[\w\-.]{1,100}$/.test(user)) { setAccState('sc', 'Впиши ник из ссылки на профиль', 'err'); return; }
  $('sc-user').value = user;
  LS.set('sc_user', user);
  scLoadLikes(true);
});
$('sc-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sc-load').click(); });
$('sp-client').addEventListener('keydown', (e) => { if (e.key === 'Enter') spLogin(); });

/* ===================== События интерфейса ===================== */
$('sidebar').addEventListener('click', (e) => { const b = e.target.closest('.nav[data-view]'); if (b) setView(b.dataset.view); });
let searchTimer = null;
$('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; scroller.scrollTop = 0; render(); }, 120);
});
$('act-play').addEventListener('click', () => {
  if (!state.list.length) return;
  playFrom(state.list, state.shuffle ? Math.floor(Math.random() * state.list.length) : 0);
});
$('act-shuffle').addEventListener('click', () => {
  if (!state.list.length) return;
  state.shuffle = true; LS.set('shuffle', '1');
  playFrom(state.list, Math.floor(Math.random() * state.list.length));
});
$('act-rename').addEventListener('click', () => { const p = curPl(); if (p) plRename(p); });
$('act-delete').addEventListener('click', () => { const p = curPl(); if (p) plDelete(p); });
$('act-refresh').addEventListener('click', () => {
  if (state.view === 'local') return loadLocal(true);
  if (state.view === 'radio') return radioMore();
  if (state.view === 'recs') return loadRecs(true);
  if ((state.view === 'all' || state.view === 'sp') && LS.get('sp_token')) spLoadLikes();
  if ((state.view === 'all' || state.view === 'sc') && LS.get('sc_user')) scLoadLikes(true);
});
$('b-play').addEventListener('click', togglePlay);
$('b-next').addEventListener('click', () => next(false));
$('b-prev').addEventListener('click', prev);
$('b-shuffle').addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  LS.set('shuffle', state.shuffle ? '1' : '0');
  if (state.queue.length) {
    const curIdx = state.order[state.pos];
    buildOrder(curIdx);
  }
  updatePlayer();
});
$('b-repeat').addEventListener('click', () => {
  state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  LS.set('repeat', state.repeat);
  updatePlayer();
});
$('b-mute').addEventListener('click', () => setVolume(state.volume > 0 ? 0 : state.lastVolume || 70));
$('volume').addEventListener('input', (e) => setVolume(Number(e.target.value)));
$('player').addEventListener('wheel', (e) => {
  if (!e.target.closest('.vol')) return;
  e.preventDefault();
  setVolume(state.volume + (e.deltaY < 0 ? 5 : -5));
}, { passive: false });
seekEl.addEventListener('input', () => {
  state.seeking = true;
  setFill(seekEl);
  $('t-cur').textContent = fmt((seekEl.value / 1000) * state.dur);
});
seekEl.addEventListener('change', () => { state.seeking = false; seek((seekEl.value / 1000) * state.dur); });
document.addEventListener('click', () => { if (sp.player) sp.player.activateElement().catch(() => {}); }, { capture: true });

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input:not([type=range]):not([type=checkbox]), textarea');
  if (e.key === 'Escape' && ctxOpen) { closeMenu(); return; }
  if (e.key === 'Escape' && !$('settings').hidden) { closeSettings(); return; }
  if (e.key === 'Escape' && lyOpen && !$('ly-dlg').hidden) { $('ly-dlg').hidden = true; return; }
  if (e.key === 'Escape' && lyOpen) { setLyrics(false); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') { e.preventDefault(); setLyrics(false); $('search').focus(); $('search').select(); return; }
  if (typing) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'KeyL' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); toggleLyrics(); }
  else if (e.ctrlKey && e.code === 'ArrowRight') { e.preventDefault(); next(false); }
  else if (e.ctrlKey && e.code === 'ArrowLeft') { e.preventDefault(); prev(); }
  else if (e.ctrlKey && e.code === 'ArrowUp') { e.preventDefault(); setVolume(state.volume + 5); }
  else if (e.ctrlKey && e.code === 'ArrowDown') { e.preventDefault(); setVolume(state.volume - 5); }
});

/* ===================== Текст песни ===================== */
const lyEl = $('lyrics');
const lyScroll = $('ly-scroll');
const lyLinesEl = $('ly-lines');
let lyOpen = false;
let lyFollow = true;          // автопрокрутка к текущей строке
let lyUserScrollAt = 0;
let lyTimer = 0;
const lyr = { key: null, status: 'idle', lines: [], plain: '', idx: -1, match: '' };
const lyCache = new Map();

function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const words = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{1,2}(?:\.\d{1,3})?>/g, '').trim();
    for (const s of stamps) out.push({ t: Number(s[1]) * 60000 + Number(String(s[2]).replace(':', '.')) * 1000, text: words });
  }
  out.sort((a, b) => a.t - b.t);
  // пустые строки подряд схлопываем в одну паузу
  return out.filter((l, i) => l.text || (i > 0 && out[i - 1].text));
}
function lyKeyOf(t) { return t ? t.src + ':' + t.id : null; }

async function lyLoad(t, refresh) {
  const key = lyKeyOf(t);
  if (!key || lyr.key === key && lyr.status !== 'error' && !refresh) return;
  lyr.key = key; lyr.idx = -1; lyr.lines = []; lyr.plain = ''; lyr.match = '';
  if (refresh) lyCache.delete(key);
  let r = lyCache.get(key);
  if (!r) {
    lyr.status = 'loading';
    lyRender();
    try {
      const q = new URLSearchParams({ artist: t.artist || '', title: t.title || '', album: t.album || '', duration: String(t.duration || 0) });
      if (refresh) q.set('refresh', '1');
      r = await api('/api/lyrics?' + q);
      lyCache.set(key, r);
    } catch (e) {
      if (lyr.key !== key) return;
      lyr.status = 'error';
      lyRender();
      return;
    }
    if (lyr.key !== key) return;
  }
  lyr.match = r.match || '';
  lyr.source = r.source || '';
  if (!r.found) lyr.status = 'none';
  else if (r.synced && (lyr.lines = parseLrc(r.synced)).length) lyr.status = 'synced';
  else if (r.plain) { lyr.status = 'plain'; lyr.plain = r.plain; }
  else if (r.instrumental) lyr.status = 'instrumental';
  else lyr.status = 'none';
  lyRender();
}

function lyState(title, text, extra = '') {
  return `<div class="ly-state">${extra}<h2>${title}</h2><p>${text}</p></div>`;
}
function lyRender() {
  lyLinesEl.className = 'ly-lines';
  lyr.idx = -1;
  if (!state.cur) { lyLinesEl.innerHTML = lyState('Тут будет текст', 'Включи любой трек, и слова пойдут строчка за строчкой под голос.'); return; }
  switch (lyr.status) {
    case 'loading':
      lyLinesEl.innerHTML = lyState('Ищу текст…', '', '<div class="loader"></div>');
      break;
    case 'synced': {
      const frag = document.createDocumentFragment();
      lyr.lines.forEach((l, i) => {
        const d = document.createElement('div');
        d.className = 'ly-line' + (l.text ? '' : ' gap');
        d.textContent = l.text || '• • •';
        d.dataset.i = i;
        frag.appendChild(d);
      });
      lyLinesEl.replaceChildren(frag);
      lyFollow = true;
      lyScroll.scrollTop = 0;
      lyKick(true);
      break;
    }
    case 'plain': {
      lyLinesEl.className = 'ly-lines plain';
      const note = document.createElement('div');
      note.className = 'ly-note';
      const srcName = { genius: 'Genius', lrclib: 'LRCLIB', lyricsovh: 'lyrics.ovh', custom: 'твой текст' }[lyr.source];
      note.textContent = (srcName ? `Текст: ${srcName} · ` : '') + 'без синхронизации, прокручивается по ходу трека';
      const frag = document.createDocumentFragment();
      frag.appendChild(note);
      for (const line of lyr.plain.split(/\r?\n/)) {
        const d = document.createElement('div');
        const sec = /^\s*\[.+\]\s*$/.test(line);
        d.className = sec ? 'ly-line ly-sec' : 'ly-line';
        d.textContent = sec ? line.trim().slice(1, -1) : line || ' ';
        frag.appendChild(d);
      }
      lyLinesEl.replaceChildren(frag);
      lyScroll.scrollTop = 0;
      lyPos = 0;
      lyUserScrollAt = 0;
      lyAutoStart();
      break;
    }
    case 'instrumental':
      lyLinesEl.innerHTML = lyState('Инструментал', 'В этом треке нет слов, просто кайфуй.');
      break;
    case 'error':
      lyLinesEl.innerHTML = lyState('Не загрузилось', 'Не получилось достать текст. Проверь интернет.', '') ;
      lyLinesEl.querySelector('.ly-state').insertAdjacentHTML('beforeend', '<button class="pill accent" id="ly-retry">Ещё раз</button>');
      break;
    default:
      lyLinesEl.innerHTML = lyState('Текста не нашлось', 'Искал на LRCLIB, NetEase, Genius и lyrics.ovh. У совсем свежих и редких треков текста часто ещё нет.');
      lyLinesEl.querySelector('.ly-state').insertAdjacentHTML('beforeend', '<button class="pill accent" id="ly-refresh">Искать заново</button><button class="pill" id="ly-custom-open">Добавить свой текст</button>');
  }
}
lyLinesEl.addEventListener('click', (e) => {
  if (e.target.id === 'ly-retry') { lyr.key = null; lyLoad(state.cur); return; }
  if (e.target.id === 'ly-refresh') { lyLoad(state.cur, true); return; }
  if (e.target.id === 'ly-custom-open') { lyDlgOpen(); return; }
  const line = e.target.closest('.ly-line[data-i]');
  if (!line || lyr.status !== 'synced') return;
  const l = lyr.lines[Number(line.dataset.i)];
  if (l) { seek(l.t); if (!state.playing) engResume(); }
});

function lyNow() {
  const c = state.cur;
  if (!c) return 0;
  if (c.src === 'sp') return state.playing ? sp.last.pos + (performance.now() - sp.last.at) : state.time;
  if (scMode === 'audio' && (audio.getAttribute('src') || hls)) return audio.currentTime * 1000;
  return state.time;
}
function lySetIdx(idx, instant) {
  const kids = lyLinesEl.children;
  const prev = lyr.idx;
  lyr.idx = idx;
  const lo = Math.max(0, Math.min(prev, idx) - 1);
  const hi = Math.min(kids.length - 1, Math.max(prev, idx) + 1);
  if (prev < 0 || Math.abs(idx - prev) > 30) {
    for (let i = 0; i < kids.length; i++) { kids[i].classList.toggle('on', i === idx); kids[i].classList.toggle('past', i < idx); }
  } else {
    for (let i = lo; i <= hi; i++) { kids[i].classList.toggle('on', i === idx); kids[i].classList.toggle('past', i < idx); }
  }
  if (lyFollow && Date.now() - lyUserScrollAt > 3500) {
    const el = kids[Math.max(0, idx)];
    if (el) {
      const top = el.offsetTop - lyScroll.clientHeight * 0.4 + el.offsetHeight / 2;
      lyScroll.scrollTo({ top: Math.max(0, top), behavior: instant || ui.lite ? 'auto' : 'smooth' });
    }
  }
}
function lyTick(instant) {
  lyTimer = 0;
  if (!lyOpen || document.hidden || lyr.status !== 'synced') return;
  const t = lyNow() + 200;
  const L = lyr.lines;
  let lo = 0, hi = L.length - 1, idx = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m].t <= t) { idx = m; lo = m + 1; } else hi = m - 1; }
  if (idx !== lyr.idx || instant === true) lySetIdx(idx, instant === true);
  if (state.playing) lyTimer = setTimeout(lyTick, 120);
}
function lyKick(instant) {
  if (!lyOpen) return;
  clearTimeout(lyTimer);
  lyTimer = setTimeout(() => lyTick(instant === true), 0);
}
['wheel', 'touchmove', 'keydown', 'mousedown'].forEach((ev) =>
  lyScroll.addEventListener(ev, () => { lyUserScrollAt = Date.now(); }, { passive: true }));

/* Текст без синхронизации: плавно едет вниз пропорционально прогрессу трека.
   Ручная прокрутка ставит автоматику на паузу на LY_PAUSE_MS, потом она плавно догоняет трек. */
const LY_PAUSE_MS = 5000;
let lyPos = 0;
let lyAutoRaf = 0;
function lyAutoStart() { if (!lyAutoRaf && lyOpen) lyAutoRaf = requestAnimationFrame(lyAutoFrame); }
function lyAutoFrame() {
  lyAutoRaf = 0;
  if (!lyOpen || lyr.status !== 'plain') return;
  lyAutoRaf = requestAnimationFrame(lyAutoFrame);
  if (document.hidden) return;
  const max = lyScroll.scrollHeight - lyScroll.clientHeight;
  if (max <= 0 || !state.dur) return;
  if (Date.now() - lyUserScrollAt < LY_PAUSE_MS) { lyPos = lyScroll.scrollTop; return; }
  // первые и последние секунды не двигаем: вступление и затухание
  const p = Math.min(1, Math.max(0, (lyNow() - state.dur * 0.04) / (state.dur * 0.88)));
  lyPos += (p * max - lyPos) * (ui.lite ? 0.25 : 0.06);
  if (Math.abs(lyScroll.scrollTop - lyPos) >= 0.5) lyScroll.scrollTop = lyPos;
}

/* Свой текст: .lrc из файла или вставленный вручную */
const lyDlg = $('ly-dlg');
function lyDlgOpen() {
  if (!state.cur) return;
  $('ly-dlg-text').value = '';
  lyDlg.hidden = false;
  $('ly-dlg-text').focus();
}
async function lyCustomPost(body) {
  const t = state.cur;
  if (!t) return;
  const r = await api('/api/lyrics/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artist: t.artist || '', title: t.title || '', duration: t.duration || 0, ...body }),
  });
  lyCache.set(lyKeyOf(t), r);
  lyDlg.hidden = true;
  lyr.key = null;   // перерисовать из кэша
  lyLoad(t);
}
$('ly-custom-btn').addEventListener('click', lyDlgOpen);
$('ly-dlg-cancel').addEventListener('click', () => { lyDlg.hidden = true; });
lyDlg.addEventListener('mousedown', (e) => { if (e.target === lyDlg) lyDlg.hidden = true; });
$('ly-dlg-file').addEventListener('click', () => $('ly-dlg-input').click());
$('ly-dlg-input').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  $('ly-dlg-text').value = (await f.text()).replace(/^﻿/, '');
});
$('ly-dlg-save').addEventListener('click', async () => {
  const text = $('ly-dlg-text').value.trim();
  if (!text) { $('ly-dlg-text').focus(); return; }
  try { await lyCustomPost({ text }); } catch (e) { alert(e.message); }
});
$('ly-dlg-reset').addEventListener('click', async () => {
  const t = state.cur;
  if (!t) return;
  lyCache.delete(lyKeyOf(t));
  try { await lyCustomPost({ reset: true }); } catch (e) { alert(e.message); }
});

function lyTrack() {
  const t = state.cur;
  const big = bigArt(t);
  lyEl.style.setProperty('--ly-img', big ? `url("${big}")` : 'none');
  const img = $('ly-cover');
  if (big) { if (img.getAttribute('src') !== big) img.src = big; } else img.removeAttribute('src');
  $('ly-title').textContent = t ? t.title : '';
  $('ly-artist').textContent = t ? t.artist : '';
  $('ly-src').innerHTML = t ? (t.src === 'sp' ? '<span class="badge sp">Spotify</span>' : '<span class="badge sc">SoundCloud</span>') : '';
  if (t) lyLoad(t); else { lyr.key = null; lyRender(); }
}
function setLyrics(open) {
  if (open === lyOpen) return;
  lyOpen = open;
  lyEl.hidden = !open;
  document.body.classList.toggle('ly-mode', open);
  $('b-lyrics').classList.toggle('on', open);
  if (open) { lyr.key = null; lyTrack(); lyKick(true); }
  else clearTimeout(lyTimer);
}
const toggleLyrics = () => setLyrics(!lyOpen);
$('b-lyrics').addEventListener('click', toggleLyrics);
$('b-mini').addEventListener('click', () => appCmd('mini'));
$('np-cover-btn').addEventListener('click', toggleLyrics);
$('side-cover').addEventListener('click', () => setLyrics(true));
$('ly-close').addEventListener('click', () => setLyrics(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) lyKick(true); });

/* ---------- связь с программой: пока окно открыто, сервер работает ---------- */
const ping = () => fetch('/api/ping', { cache: 'no-store' }).catch(() => {});
setInterval(ping, 20000);
window.addEventListener('pagehide', () => { listenTick(); listenFlush(true); if (!leavingForAuth) { try { navigator.sendBeacon('/api/bye'); } catch {} } });

/* ===================== Старт ===================== */
(async function init() {
  $('redirect-uri').textContent = REDIRECT_URI;
  $('sp-client').value = LS.get('sp_client_id');
  $('sc-user').value = LS.get('sc_user');
  readRowH();
  buildSettings();
  applyUI();
  setVolume(state.volume, false);
  updatePlayer();
  ping();
  api('/api/info').then((i) => {
    appInfo = i;
    $('ver').textContent = 'v' + i.version;
    $('log-path').textContent = i.logFile;
    connectEvents();
    if (i.native) {
      $('b-mini').hidden = false;
      $('row-tray').hidden = false;
      appCmd('settings', { closeToTray: ui.tray !== false });
      publishState(true);
      $('hint-sp-play').innerHTML = 'Треки Spotify звучат через <b>приложение Spotify</b> на компе: если оно закрыто, плеер запустит его сам. Войди в нём в тот же аккаунт.';
      pushTheme();
    }
  }).catch(() => {});

  if (location.pathname === '/callback') await spHandleCallback();

  renderSidebarPlaylists();
  rebuildAll();
  if (LS.get('sp_token')) {
    setAccState('sp', state.lib.sp.length ? `${state.lib.sp.length} ${plural(state.lib.sp.length, TRACKS)}` : '', 'ok');
    spLoadLikes();
    spMe().then(syncAccounts);
  }
  if (LS.get('sc_user')) scLoadLikes(false);
  loadLocal(false);
  loadDiscord();
})();
