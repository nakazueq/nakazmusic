'use strict';
/* ===== Sonara: лайки Spotify + SoundCloud в одном окне ===== */
const $ = (id) => document.getElementById(id);
// Эти настройки дублируются в программу (%LOCALAPPDATA%\MyPlayer\store.json),
// чтобы не вводить их заново после обновления или смены окна
const SYNC_KEYS = new Set(['sp_client_id', 'sp_token', 'sc_user', 'ui', 'volume', 'shuffle', 'repeat', 'wallImg', 'playlists', 'themes', 'yt_lists', 'search_src', 'yt_cookie_fb', 'keys', 'lang']);
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
  mist: { get name() { return T('a.const.1'); }, css: 'radial-gradient(55% 60% at 12% 18%, #cdd6e4 0%, transparent 70%), radial-gradient(50% 55% at 88% 12%, #e3d8e7 0%, transparent 70%), radial-gradient(60% 60% at 82% 92%, #d0dbe6 0%, transparent 70%), radial-gradient(50% 55% at 8% 88%, #e7e0d4 0%, transparent 70%), linear-gradient(160deg, #e9eaee, #dadde4)' },
  silver: { get name() { return T('a.const.2'); }, css: 'radial-gradient(60% 60% at 20% 15%, #f6f6f8 0%, transparent 70%), radial-gradient(55% 60% at 85% 85%, #c2c5cd 0%, transparent 70%), radial-gradient(40% 45% at 75% 20%, #dcdde2 0%, transparent 70%), linear-gradient(150deg, #e6e7eb, #cdd0d6)' },
  ocean: { get name() { return T('a.const.3'); }, css: 'radial-gradient(55% 60% at 15% 20%, #b9d3f0 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #cbe7f1 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #d3d2f2 0%, transparent 70%), linear-gradient(160deg, #e3ebf5, #d2dff0)' },
  sakura: { get name() { return T('a.const.4'); }, css: 'radial-gradient(55% 60% at 15% 20%, #f6d4e2 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #eadff3 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #fbe4d8 0%, transparent 70%), linear-gradient(160deg, #f6eef2, #efe3ea)' },
  mint: { get name() { return T('a.const.5'); }, css: 'radial-gradient(55% 60% at 15% 20%, #cbe9dc 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #d7ecf1 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #e5f1d6 0%, transparent 70%), linear-gradient(160deg, #ecf3ef, #dfece6)' },
  night: { get name() { return T('a.const.6'); }, css: 'radial-gradient(55% 60% at 15% 20%, #3b3272 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #173e64 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #4a2352 0%, transparent 70%), linear-gradient(160deg, #13141f, #1b1d2b)' },
  sunset: { get name() { return T('a.const.7'); }, css: 'radial-gradient(55% 60% at 15% 20%, #7a2e50 0%, transparent 70%), radial-gradient(50% 55% at 85% 15%, #8a4b22 0%, transparent 70%), radial-gradient(55% 60% at 80% 90%, #352d6c 0%, transparent 70%), linear-gradient(160deg, #1f1520, #191526)' },
  plain: { get name() { return T('a.const.8'); } },
  gradient: { get name() { return T('a.const.9'); } },
  cover: { get name() { return T('a.const.10'); } },
  custom: { get name() { return T('a.const.11'); } },
};
const DARK_WALLS = new Set(['night', 'sunset']);
// особые режимы фона: при переходе в них запоминаем обычный фон из темы, чтобы вернуться к нему
const SPECIAL_WALLS = new Set(['plain', 'custom', 'gradient']);

/* ---------- свой градиент для фона ---------- */
const GRAD_TYPES = ['linear', 'radial', 'conic'];
const GRAD_TYPE_NAMES = { get linear() { return T('a.const.12'); }, get radial() { return T('a.const.13'); }, get conic() { return T('a.const.14'); } };
const GRAD_MIN_STOPS = 2, GRAD_MAX_STOPS = 5;
const GRAD_PRESETS = [
  { id: 'sunset', get name() { return T('a.const.15'); }, type: 'linear', angle: 160, stops: [['#2b1055', 0], ['#b3365f', 50], ['#ff9a5a', 100]] },
  { id: 'ocean', get name() { return T('a.const.16'); }, type: 'linear', angle: 150, stops: [['#0b3c5d', 0], ['#1d7a9c', 55], ['#8fd6e8', 100]] },
  { id: 'neon', get name() { return T('a.const.17'); }, type: 'linear', angle: 135, stops: [['#12002f', 0], ['#7a1cff', 45], ['#ff2fb3', 75], ['#00e5ff', 100]] },
  { id: 'forest', get name() { return T('a.const.18'); }, type: 'linear', angle: 160, stops: [['#0b2a1c', 0], ['#1f6b43', 55], ['#a8d06a', 100]] },
  { id: 'graphite', get name() { return T('a.const.19'); }, type: 'linear', angle: 160, stops: [['#16171b', 0], ['#2c2e35', 60], ['#4a4d57', 100]] },
  { id: 'dawn', get name() { return T('a.const.20'); }, type: 'radial', angle: 0, stops: [['#ffd9a0', 0], ['#ff8fb1', 50], ['#6a5acd', 100]] },
  { id: 'lavender', get name() { return T('a.const.21'); }, type: 'linear', angle: 120, stops: [['#e9e4f7', 0], ['#c9b8ee', 55], ['#f3c6e2', 100]] },
  { id: 'fire', get name() { return T('a.const.22'); }, type: 'conic', angle: 0, stops: [['#ff3b30', 0], ['#ff9500', 35], ['#ffcc00', 65], ['#ff3b30', 100]] },
];
const gradFromPreset = (p) => ({ type: p.type, angle: p.angle, stops: p.stops.map(([c, q]) => ({ c, p: q })) });
const GRAD_DEFAULT = { type: 'linear', angle: 135, stops: [{ c: '#3a1c3f', p: 0 }, { c: '#b33a5b', p: 55 }, { c: '#f0a35e', p: 100 }] };
// приводит что угодно к допустимому градиенту: тип из списка, угол 0..360, 2..5 точек с hex-цветом и позицией 0..100
function normalizeGrad(g) {
  const out = { type: 'linear', angle: 135, stops: [] };
  if (g && typeof g === 'object') {
    if (GRAD_TYPES.includes(g.type)) out.type = g.type;
    if (typeof g.angle === 'number' && Number.isFinite(g.angle)) out.angle = Math.round(Math.min(360, Math.max(0, g.angle)));
    if (Array.isArray(g.stops)) {
      for (const s of g.stops.slice(0, GRAD_MAX_STOPS)) {
        if (s && typeof s.c === 'string' && /^#[0-9a-f]{6}$/i.test(s.c) && typeof s.p === 'number' && Number.isFinite(s.p)) out.stops.push({ c: s.c.toLowerCase(), p: Math.round(Math.min(100, Math.max(0, s.p))) });
      }
    }
  }
  if (out.stops.length < GRAD_MIN_STOPS) return { ...GRAD_DEFAULT, stops: GRAD_DEFAULT.stops.map((s) => ({ ...s })) };
  out.stops.sort((a, b) => a.p - b.p);
  return out;
}
// css-значение градиента; bar: прямая полоса слева направо для предпросмотра точек
function gradCss(g, bar) {
  const stops = g.stops.map((s) => `${s.c} ${s.p}%`).join(', ');
  if (bar) return `linear-gradient(90deg, ${stops})`;
  if (g.type === 'radial') return `radial-gradient(ellipse at 50% 50%, ${stops})`;
  if (g.type === 'conic') return `conic-gradient(from ${g.angle}deg at 50% 50%, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}
const PV_LIGHT =['rgba(236,237,241,.78)', 'rgba(251,251,253,.88)'];
const PV_DARK = ['rgba(38,38,42,.8)', 'rgba(26,26,29,.86)'];
const PRESETS = [
  { id: 'glass', get name() { return T('a.const.23'); }, mode: 'light', accent: '#007AFF', wall: 'mist', alpha: 45 },
  { id: 'graphite', get name() { return T('a.const.24'); }, mode: 'light', accent: '#8E8E93', wall: 'silver', alpha: 40 },
  { id: 'ocean', get name() { return T('a.const.25'); }, mode: 'light', accent: '#30B0C7', wall: 'ocean', alpha: 50 },
  { id: 'sakura', get name() { return T('a.const.26'); }, mode: 'light', accent: '#FF2D55', wall: 'sakura', alpha: 50 },
  { id: 'mint', get name() { return T('a.const.27'); }, mode: 'light', accent: '#34C759', wall: 'mint', alpha: 50 },
  { id: 'night', get name() { return T('a.const.28'); }, mode: 'dark', accent: '#0A84FF', wall: 'night', alpha: 50 },
  { id: 'sunset', get name() { return T('a.const.29'); }, mode: 'dark', accent: '#FF9F0A', wall: 'sunset', alpha: 50 },
  { id: 'cover', get name() { return T('a.const.30'); }, mode: 'dark', accent: '#FA2D48', wall: 'cover', alpha: 55 },
];
const ACCENTS = [
  ['@a.accent.blue', '#007AFF'], ['@a.accent.purple', '#AF52DE'], ['@a.accent.pink', '#FF2D55'], ['@a.accent.red', '#FF3B30'],
  ['@a.accent.orange', '#FF9500'], ['@a.accent.yellow', '#FFCC00'], ['@a.accent.green', '#34C759'], ['@a.accent.teal', '#30B0C7'], ['@a.accent.graphite', '#8E8E93'],
];
// тонкая настройка вида (окно «Оформление»): всё хранится внутри ui и уезжает в store.json
const DEFAULT_LOOK = { bg: null, text: null, font: '', rs: 100, cover: 100, prevWall: null, auto: false, css: '', cssOn: true };
const DEFAULT_UI = { preset: 'glass', mode: 'light', accent: '#007AFF', wall: 'mist', wallPrev: null, alpha: 45, blur: 40, lite: false, compact: false, tray: true };
// настройки из старой версии или повреждённого файла: недопустимые значения заменяем умолчаниями, лишнее не трогаем
function sanitizeUi(u) {
  const o = { ...DEFAULT_UI, ...(u && typeof u === 'object' && !Array.isArray(u) ? u : {}) };
  const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  o.alpha = num(o.alpha, 0, 100, DEFAULT_UI.alpha);
  o.blur = num(o.blur, 0, 80, DEFAULT_UI.blur);
  if (!['light', 'dark', 'auto'].includes(o.mode)) o.mode = DEFAULT_UI.mode;
  if (typeof o.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(o.accent)) o.accent = DEFAULT_UI.accent;
  for (const k of ['lite', 'compact', 'tray']) o[k] = typeof o[k] === 'boolean' ? o[k] : DEFAULT_UI[k];
  if (o.look != null && (typeof o.look !== 'object' || Array.isArray(o.look))) o.look = {};
  if (o.layout != null && (typeof o.layout !== 'object' || Array.isArray(o.layout))) o.layout = {};
  return o;
}
const ui = sanitizeUi(LS.json('ui', {}));
ui.look ={ ...DEFAULT_LOOK, ...(ui.look || {}) };
ui.grad = normalizeGrad(ui.grad);
// градиент из обложки: переключатель и последние цвета (3 hex), чтобы после запуска фон не прыгал, пока не заиграл трек
ui.gradCover = !!ui.gradCover;
ui.gradCoverLast = Array.isArray(ui.gradCoverLast) && ui.gradCoverLast.length === 3 && ui.gradCoverLast.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) ? ui.gradCoverLast.map((c) => c.toLowerCase()) : null;
if (!Object.prototype.hasOwnProperty.call(WALLS, ui.wall)) ui.wall = DEFAULT_UI.wall;
// раскладка: сайдбар слева/справа и режим окна (обычный, компактный, полноэкранный); prev нужен, чтобы выйти из полного экрана назад
const DEFAULT_LAYOUT = { mode: 'normal', side: 'left', prev: 'normal' };
ui.layout = { ...DEFAULT_LAYOUT, ...(ui.layout || {}) };
const denseUI = () => !!ui.compact || ui.layout.mode === 'compact';
// блоки интерфейса: порядок сайдбара и список выключенных. Навигация всегда включена, «Список треков» живёт в основной области
const BLOCKS = {
  search: { get name() { return T('a.const.31'); }, get desc() { return T('a.const.32'); }, side: true, sel: '.search' },
  nav: { get name() { return T('a.const.33'); }, get desc() { return T('a.const.34'); }, side: true, sel: '#side-nav', locked: true },
  cover: { get name() { return T('a.const.35'); }, get desc() { return T('a.const.36'); }, side: true, sel: '#side-cover' },
  queue: { get name() { return T('a.const.37'); }, get desc() { return T('a.const.38'); }, side: true, sel: '#blk-queue' },
  lyrics: { get name() { return T('a.const.39'); }, get desc() { return T('a.const.40'); }, side: true, sel: '#blk-lyrics' },
  list: { get name() { return T('a.const.41'); }, get desc() { return T('a.const.42'); }, side: false },
};
const DEFAULT_BLOCKS = { order: ['search', 'nav', 'cover', 'queue', 'lyrics'], off: ['queue', 'lyrics'] };
function normalizeBlocks(b) {
  const sideIds = Object.keys(BLOCKS).filter((id) => BLOCKS[id].side);
  const src = b && Array.isArray(b.order) ? b : DEFAULT_BLOCKS;
  const order = src.order.filter((id, i, a) => sideIds.includes(id) && a.indexOf(id) === i);
  for (const id of DEFAULT_BLOCKS.order) if (!order.includes(id)) order.push(id);
  const off = (Array.isArray(src.off) ? src.off : []).filter((id, i, a) => BLOCKS[id] && !BLOCKS[id].locked && a.indexOf(id) === i);
  return { order, off };
}
ui.blocks = normalizeBlocks(ui.blocks);
let qSig = '';
let lycTimer = 0;
let lycSig = '';
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
const HEX_RE = /^#[0-9a-f]{6}$/i;
// свой цвет фона сам решает, светлая тема или тёмная: иначе текст может слиться с фоном
const baseMode = () => (ui.mode === 'auto' ? (mq.matches ? 'dark' : 'light') : ui.mode);
function currentMode() {
  if (!(ui.look.auto && autoNow) && HEX_RE.test(ui.look.bg || '')) return isLightColor(ui.look.bg) ? 'light' : 'dark';
  if (gradActive()) return gradAnalyze(effGradTarget(), userOpVal()).mode;   // градиент (свой или из обложки): тема по его средней яркости
  return baseMode();   // цвета по обложке подстраиваются под выбранную светлую или тёмную тему, а не меняют её
}

/* ---------- подбор темы и контраста по яркости градиента ---------- */
// самые «опасные» панели: у светлой темы сайдбар темнее, у тёмной светлее; текст темы поверх них
const GRAD_PANEL = { light: { rgb: [236, 237, 241], text: [29, 29, 31] }, dark: { rgb: [36, 36, 40], text: [245, 245, 247] } };
const rgbLum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const rgbContrast = (a, b) => { const x = rgbLum(a), y = rgbLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexToRgb3 = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const userOpVal = () => 0.96 - (ui.alpha / 100) * 0.76;   // плотность панелей из ползунка «Прозрачность»
// точки по градиенту с весами: у радиального внешние кольца занимают больше площади
function gradSamples(g, n = 24) {
  const st = g.stops.map((s) => ({ p: s.p / 100, c: hexToRgb3(s.c) }));
  const at = (t) => {
    if (t <= st[0].p) return st[0].c;
    if (t >= st[st.length - 1].p) return st[st.length - 1].c;
    for (let i = 0; i < st.length - 1; i++) if (t <= st[i + 1].p) {
      const k = (t - st[i].p) / (st[i + 1].p - st[i].p || 1);
      return st[i].c.map((v, j) => v + (st[i + 1].c[j] - v) * k);
    }
    return st[0].c;
  };
  const out = [];
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; out.push({ c: at(t), w: g.type === 'radial' ? t : 1 }); }
  return out;
}
const gradCache = new Map();
let gradLastMode = null;
// средняя яркость градиента с учётом позиций точек -> светлая или тёмная тема; если на самых светлых или тёмных местах
// текст читается хуже 4.5:1, панели делаем плотнее (но не больше 96%)
// panel: когда включён «Подбирать по обложке», панели окрашены её палитрой, и контраст считаем уже по её фону и тексту
function gradAnalyze(g, userOp, panel) {
  const key = gradCss(g) + '|' + userOp.toFixed(3) + (panel ? '|' + panel.rgb.join() + '|' + panel.text.join() : '');
  const hit = gradCache.get(key);
  if (hit) { if (!panel) gradLastMode = hit.mode; return hit; }
  const S = gradSamples(g);
  const wsum = S.reduce((a, s) => a + s.w, 0);
  const avgLum = S.reduce((a, s) => a + s.w * rgbLum(s.c), 0) / wsum;
  const avg = [0, 1, 2].map((j) => Math.round(S.reduce((a, s) => a + s.w * s.c[j], 0) / wsum));
  const blend = (c, P, op) => { const a = Math.max(0.12, op * 0.82); return c.map((v, j) => v * (1 - a) + P.rgb[j] * a); };
  const avgContrast = (mode) => rgbContrast(GRAD_PANEL[mode].text, blend(avg, GRAD_PANEL[mode], userOp));
  const cl = avgContrast('light'), cd = avgContrast('dark');
  let mode = cl >= cd ? 'light' : 'dark';
  if (gradLastMode && Math.abs(cl - cd) < 0.3) mode = gradLastMode;   // у границы тема не должна мигать при перетаскивании
  const P = panel || GRAD_PANEL[mode];
  const worst = (op) => Math.min(...S.map((s) => rgbContrast(P.text, blend(s.c, P, op))));
  let op = userOp, contrast = worst(op);
  while (contrast < 4.5 && op < 0.96) { op = Math.min(0.96, op + 0.04); contrast = worst(op); }
  const res = { mode, op, contrast, avgLum, avg, raised: op > userOp + 0.001 };
  gradCache.set(key, res);
  if (gradCache.size > 120) gradCache.delete(gradCache.keys().next().value);
  if (!panel) gradLastMode = mode;
  return res;
}
// подбор по градиенту действует, когда выбран фон «Градиент» и не задан свой цвет фона
const gradActive = () => ui.wall === 'gradient' && !HEX_RE.test(ui.look.bg || '');
const palettePanel = () => (ui.look.auto && autoNow ? { rgb: hexToRgb3(autoNow.bg), text: hexToRgb3(autoNow.text) } : null);
const opValue = () => (gradActive() ? gradAnalyze(effGradTarget(), userOpVal(), palettePanel()).op : userOpVal());
// светлая или тёмная палитра по обложке: если фон градиентный, подстраиваемся под его яркость, чтобы они не спорили
const paletteMode = () => (gradActive() ? gradAnalyze(effGradTarget(), userOpVal()).mode : baseMode());

/* ---------- градиент из обложки ---------- */
// цвета, которые нарисованы сейчас (при переходе промежуточные), и цели: тема и контраст считаются сразу по цели
let coverNow = ui.gradCoverLast ? ui.gradCoverLast.slice() : null;
let coverTarget = coverNow;
let coverRaf = 0, coverFinal = 0;
const coverGradOf = (c) => ({ type: ui.grad.type, angle: ui.grad.angle, stops: [{ c: c[0], p: 0 }, { c: c[1], p: 50 }, { c: c[2], p: 100 }] });
// что рисуем и по чему считаем читаемость: свой градиент или градиент из цветов обложки (тип и угол всегда пользовательские)
const effGrad = () => (ui.gradCover && coverNow ? coverGradOf(coverNow) : ui.grad);
const effGradTarget = () => (ui.gradCover && (coverTarget || coverNow) ? coverGradOf(coverTarget || coverNow) : ui.grad);
function setCoverGrad(colors) {
  cancelAnimationFrame(coverRaf);
  clearTimeout(coverFinal);
  const same = coverTarget && coverTarget.every((c, i) => c === colors[i]);
  coverTarget = colors;
  ui.gradCoverLast = colors.slice();
  const from = coverNow;
  if (same && from && from.every((c, i) => c === colors[i])) return;
  saveUI();
  if (!from || ui.lite || document.hidden) { coverNow = colors.slice(); applyUI(); return; }
  liveFlush();   // тема и плотность панелей сразу по цели, а цвет фона поплывёт за 0,7 с
  const t0 = performance.now(), D = 700;
  const finish = () => { coverNow = colors.slice(); applyUI(); };
  coverFinal = setTimeout(() => { cancelAnimationFrame(coverRaf); finish(); }, D + 150);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / D), e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
    if (k >= 1) { clearTimeout(coverFinal); finish(); return; }
    coverNow = from.map((c, i) => mixHex(c, colors[i], e));
    applyGrad();
    coverRaf = requestAnimationFrame(step);
  };
  coverRaf = requestAnimationFrame(step);
}
function coverGradReset() {
  cancelAnimationFrame(coverRaf);
  clearTimeout(coverFinal);
  coverNow = coverTarget = null;
  ui.gradCover = false;
  ui.gradCoverLast = null;
}
const rgbOf = (hex) => `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
function mixHex(a, b, t) {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
const FONTS = [
  ['', '@a.font.default'],
  ['"Segoe UI"', 'Segoe UI'],
  ['Bahnschrift', 'Bahnschrift'],
  ['Calibri', 'Calibri'],
  ['Verdana', 'Verdana'],
  ['"Trebuchet MS"', 'Trebuchet MS'],
  ['Georgia, serif', '@a.font.georgia'],
  ['Cambria, serif', '@a.font.cambria'],
  ['Consolas, "Cascadia Mono", monospace', '@a.font.consolas'],
  ['"Comic Sans MS"', 'Comic Sans'],
];
const fontStack = (f) => (f ? `${f}, system-ui, sans-serif` : '');

/* ---------- цвета по обложке ---------- */
let autoNow = null;            // палитра, которая применена сейчас (во время плавного перехода промежуточная)
let autoRaf = 0, autoToken = 0;
const autoDoms = new Map();    // url обложки -> доминирующий цвет
const lumOf = (hex) => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
function contrastOf(a, b) {
  const la = lumOf(a), lb = lumOf(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
}
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// доминирующий цвет: гистограмма 16x16x16, насыщенные цвета весят больше, почти чёрное и почти белое меньше
function domColor(px) {
  const buckets = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
    let w = 0.2 + s;
    if (v < 0.12 || (v > 0.94 && s < 0.12)) w *= 0.15;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const a = buckets.get(key) || [0, 0, 0, 0];
    a[0] += r * w; a[1] += g * w; a[2] += b * w; a[3] += w;
    buckets.set(key, a);
  }
  let best = null;
  for (const a of buckets.values()) if (!best || a[3] > best[3]) best = a;
  if (!best || !best[3]) return null;
  return '#' + [0, 1, 2].map((k) => Math.round(best[k] / best[3]).toString(16).padStart(2, '0')).join('');
}
// 2-3 заметно разных доминирующих цвета: берём самые весомые корзины гистограммы и пропускаем те, что слишком похожи на уже выбранные
function domColors(px, n = 3) {
  const buckets = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
    let w = 0.2 + s;
    if (v < 0.1 || (v > 0.95 && s < 0.1)) w *= 0.15;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const a = buckets.get(key) || [0, 0, 0, 0];
    a[0] += r * w; a[1] += g * w; a[2] += b * w; a[3] += w;
    buckets.set(key, a);
  }
  const list = [...buckets.values()].filter((a) => a[3] > 0).sort((a, b) => b[3] - a[3]).map((a) => [a[0] / a[3], a[1] / a[3], a[2] / a[3]]);
  // «красное» расстояние: ближе к тому, как глаз различает цвета, чем простой RGB
  const dist = (p, q) => { const rm = (p[0] + q[0]) / 2, dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2]; return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db); };
  const picked = [];
  for (const c of list) { if (picked.every((p) => dist(p, c) >= 90)) picked.push(c); if (picked.length >= n) break; }
  return picked.map((c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''));
}
// ровно три цвета для градиента от тёмного к светлому: если на обложке только два цвета, третий берём между ними,
// если один (однотонная обложка), строим его светлый и тёмный оттенки
function coverStops(doms) {
  let c = doms.slice(0, 3);
  if (c.length === 1) {
    const [h, s, l] = hexToHsl(c[0]);
    c = [hslToHex(h, s, clampN(l - 0.22, 0.06, 0.9)), c[0], hslToHex((h + 14) % 360, s, clampN(l + 0.22, 0.1, 0.94))];
  }
  c.sort((a, b) => lumOf(a) - lumOf(b));
  if (c.length === 2) c = [c[0], mixHex(c[0], c[1], 0.5), c[1]];
  return c;
}
async function domOfArt(url) { return (await artColors(url)).dom; }
async function artColors(url) {
  if (autoDoms.has(url)) return autoDoms.get(url);
  // чужие картинки читаем через сервер плеера (там нет CORS), свои и локальные напрямую
  const remote = /^https?:/i.test(url) && new URL(url).origin !== location.origin;
  const r = await fetch(remote ? '/api/app/art?u=' + encodeURIComponent(url) : url, { headers: { 'X-Player': '1' } });
  if (!r.ok) throw new Error(T('a.artColors.1') + r.status);
  const bmp = await createImageBitmap(await r.blob());
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  const g = c.getContext('2d', { willReadFrequently: true });
  // берём центральный квадрат: у картинок 16:9 (YouTube) по бокам часто чёрные поля, в центре обложка
  const side = Math.min(bmp.width, bmp.height);
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 40, 40);
  if (bmp.close) bmp.close();
  const data = g.getImageData(0, 0, 40, 40).data;
  const res = { dom: domColor(data), doms: domColors(data, 3) };
  autoDoms.set(url, res);
  if (autoDoms.size > 60) autoDoms.delete(autoDoms.keys().next().value);
  return res;
}
// палитра под тему: фон 13% или 93% яркости, текст >= 7:1, подписи >= 4.5:1, кнопки >= 4.5:1 и заметны на фоне (>= 3:1)
function derivePalette(domHex, mode) {
  const [h, s0] = hexToHsl(domHex);
  const dark = mode === 'dark', grey = s0 < 0.12;
  const bg = hslToHex(h, grey ? s0 : clampN(s0 * (dark ? 0.55 : 0.6), dark ? 0.14 : 0.16, dark ? 0.42 : 0.5), dark ? 0.13 : 0.93);
  let acc = grey ? hexToHsl(HEX_RE.test(ui.accent) ? ui.accent : '#007aff') : [h, clampN(s0, 0.5, 0.95), dark ? 0.6 : 0.45];
  let [ah, as, al] = acc, accent = '#000000', on = '#ffffff';
  for (let i = 0; i < 40; i++) {
    accent = hslToHex(ah, as, al);
    const wc = contrastOf('#ffffff', accent), bc = contrastOf('#111111', accent);
    on = wc >= bc ? '#ffffff' : '#111111';
    if (Math.max(wc, bc) >= 4.5 && contrastOf(accent, bg) >= 3) break;
    if (Math.max(wc, bc) < 4.5) al += on === '#ffffff' ? -0.03 : 0.03;
    else al += dark ? 0.03 : -0.03;
    al = clampN(al, 0.06, 0.94);
  }
  let text = hslToHex(h, grey ? 0 : dark ? 0.25 : 0.3, dark ? 0.96 : 0.1);
  if (contrastOf(text, bg) < 7) text = dark ? '#ffffff' : '#000000';
  let t = 0.68, muted = mixHex(bg, text, t);
  while (contrastOf(muted, bg) < 4.5 && t < 0.98) { t += 0.04; muted = mixHex(bg, text, t); }
  t = 0.5; let faint = mixHex(bg, text, t);
  while (contrastOf(faint, bg) < 3 && t < 0.98) { t += 0.04; faint = mixHex(bg, text, t); }
  return { bg, accent, on, text, muted, faint, mode, dom: domHex, ratios: { text: contrastOf(text, bg), button: contrastOf(on, accent), muted: contrastOf(muted, bg) } };
}
function blendPal(a, b, k) {
  const m = {};
  for (const f of ['bg', 'accent', 'text', 'muted', 'faint']) m[f] = mixHex(a[f], b[f], k);
  return { ...b, ...m, on: k < 0.5 ? a.on : b.on };
}
let autoFinal = 0;
function autoClear() {
  cancelAnimationFrame(autoRaf);
  clearTimeout(autoFinal);
  const had = !!autoNow;
  autoNow = null;
  if (had) applyUI();
  else syncLookUI();
}
function autoApply(pal) {
  cancelAnimationFrame(autoRaf);
  clearTimeout(autoFinal);
  const from = autoNow;
  if (!from || ui.lite || document.hidden) { autoNow = pal; applyUI(); return; }
  const t0 = performance.now(), D = 700;
  // если кадры анимации встали (окно свёрнуто или перекрыто), всё равно приходим к нужным цветам
  autoFinal = setTimeout(() => { cancelAnimationFrame(autoRaf); autoNow = pal; applyLook(); syncLookUI(); }, D + 150);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / D), e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
    autoNow = k < 1 ? blendPal(from, pal, e) : pal;
    applyLook();
    if (k < 1) autoRaf = requestAnimationFrame(step); else syncLookUI();
  };
  autoRaf = requestAnimationFrame(step);
}
// вызывается при смене трека и при включении переключателя
// Подбор по обложке и градиент из обложки работают от одних и тех же цветов трека и не спорят: градиент рисует фон,
// палитра красит акцент, панели и текст, причём светлая или тёмная она по яркости градиента (paletteMode),
// а плотность панелей считается по цветам палитры поверх градиента (opValue). Если обложки нет: палитра возвращается к теме,
// а градиент остаётся последним.
async function autoCover() {
  const tok = ++autoToken;
  const t = state.cur, art = t && (t.art || t.cover);
  const wantPal = ui.look.auto, wantGrad = ui.gradCover;
  if (!wantPal && autoNow) autoClear();
  if (!wantPal && !wantGrad) return;
  if (!art) { if (autoNow) autoClear(); return; }
  let cols = null;
  try { cols = await artColors(art); } catch (e) { console.warn(e); }
  if (tok !== autoToken) return;
  if (!cols || !cols.dom) { if (autoNow) autoClear(); return; }
  if (wantGrad) setCoverGrad(coverStops(cols.doms.length ? cols.doms : [cols.dom]));
  if (wantPal) autoApply(derivePalette(cols.dom, paletteMode()));
}

/* ---------- свой CSS ---------- */
const CSS_MAX = 20000;
// возвращает текст проблемы или '' если CSS безопасен: без @import, внешних url(), HTML и старых IE-приёмов
function cssProblem(css) {
  if (css.length > CSS_MAX) return T('a.cssProblem.1', { CSS_MAX: CSS_MAX });
  // раскрываем экранирование и убираем комментарии, чтобы u\72l( и /**/ не обходили проверку
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
    .replace(/\\(.)/g, '$1');
  if (/@import/i.test(flat)) return T('a.cssProblem.2');
  if (/<\s*\/?\s*(style|script)|<!--/i.test(flat)) return T('a.cssProblem.3');
  if (/expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/i.test(flat)) return T('a.cssProblem.4');
  for (const m of flat.matchAll(/url\(\s*([^)]*)\)/gi)) {
    if (!/^["']?\s*data:image\//i.test(m[1])) return T('a.cssProblem.5');
  }
  return '';
}
const cssBalanced = (css) => {
  let d = 0;
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '')) {
    if (ch === '{') d++; else if (ch === '}' && --d < 0) return false;
  }
  return d === 0;
};
const cssActive = () => !window.__safeCss && ui.look.cssOn !== false && !!ui.look.css && !cssProblem(ui.look.css);
function applyUserCss() {
  let el = document.getElementById('user-css');
  if (!cssActive()) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('style'); el.id = 'user-css'; document.head.appendChild(el); }
  if (el.textContent !== ui.look.css) el.textContent = ui.look.css;
}
// кнопка спасения: стили инлайн с !important, поэтому пользовательский CSS её не прячет
let rescueTimer = 0;
function showCssRescue() {
  clearTimeout(rescueTimer);
  let box = document.getElementById('css-rescue');
  if (!cssActive()) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.id = 'css-rescue';
    box.style.cssText = 'all:initial!important;position:fixed!important;right:14px!important;top:14px!important;z-index:2147483647!important;display:flex!important;align-items:center!important;gap:10px!important;padding:8px 8px 8px 14px!important;border-radius:12px!important;background:#1d1d1f!important;color:#fff!important;font:13px system-ui,sans-serif!important;box-shadow:0 8px 30px rgba(0,0,0,.4)!important;opacity:1!important;visibility:visible!important;transform:none!important;pointer-events:auto!important;';
    const txt = document.createElement('span');
    txt.textContent = T('a.showCssRescue.1');
    txt.style.cssText = 'all:initial!important;color:#fff!important;font:13px system-ui,sans-serif!important;';
    const b = document.createElement('button');
    b.textContent = T('a.showCssRescue.2');
    b.style.cssText = 'all:initial!important;cursor:pointer!important;padding:5px 12px!important;border-radius:8px!important;background:#ff453a!important;color:#fff!important;font:600 13px system-ui,sans-serif!important;';
    b.addEventListener('click', () => toggleUserCss(false));
    box.append(txt, b);
    document.documentElement.appendChild(box);
  }
  rescueTimer = setTimeout(() => { const x = document.getElementById('css-rescue'); if (x) x.remove(); }, 12000);
}
function toggleUserCss(on) {
  ui.look.cssOn = on === undefined ? ui.look.cssOn === false : on;
  saveUI(); applyUI();
  if (ui.look.cssOn) showCssRescue(); else document.getElementById('css-rescue')?.remove();
  toast(window.__safeCss ? T('a.toggleUserCss.1') : ui.look.cssOn ? T('a.toggleUserCss.2') : T('a.toggleUserCss.3'));
}
// Ctrl+Shift+K работает всегда, даже если CSS спрятал интерфейс
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyK') { e.preventDefault(); e.stopPropagation(); toggleUserCss(); }
}, true);

function applyLook(live) {
  const r = document.documentElement, L = ui.look;
  applyUserCss();
  const A = L.auto ? autoNow : null;
  // переменную трогаем, только если значение действительно изменилось: лишняя запись заставляет браузер пересчитать стили всей страницы
  const set = (k, v) => {
    const cur = r.style.getPropertyValue(k);
    if (v == null || v === '') { if (cur) r.style.removeProperty(k); }
    else if (cur !== String(v)) r.style.setProperty(k, v);
  };
  set('--accent', A ? A.accent : ui.accent);
  set('--on-accent', A ? A.on : (isLightColor(ui.accent) ? '#1d1d1f' : '#ffffff'));
  const bg = A ? A.bg : L.bg;
  if (HEX_RE.test(bg || '')) {
    const light = isLightColor(bg);
    set('--plain', bg);
    set('--main-rgb', rgbOf(bg));
    set('--side-rgb', rgbOf(mixHex(bg, '#000000', light ? 0.05 : 0.18)));
    set('--bar-rgb', rgbOf(mixHex(bg, '#ffffff', light ? 0.5 : 0.07)));
    set('--solid', mixHex(bg, '#ffffff', light ? 0.6 : 0.1));
  } else {
    for (const k of ['--plain', '--main-rgb', '--side-rgb', '--bar-rgb', '--solid']) set(k, null);
  }
  if (A) {
    set('--text', A.text);
    set('--muted', A.muted);
    set('--faint', A.faint);
  } else if (HEX_RE.test(L.text || '')) {
    set('--text', L.text);
    set('--muted', `color-mix(in srgb, ${L.text} 62%, transparent)`);
    set('--faint', `color-mix(in srgb, ${L.text} 45%, transparent)`);
  } else {
    for (const k of ['--text', '--muted', '--faint']) set(k, null);
  }
  set('--font', fontStack(L.font));
  const cs = L.cover / 100;
  set('--op', opValue().toFixed(3));   // плотность панелей: из ползунка, но не меньше нужной для читаемости на градиенте
  set('--rs', L.rs / 100);
  set('--gs', ui.blur / 40);
  set('--cs', cs);
  // обложки в списке и строки под них: JS читает высоту строки для виртуального списка
  const dense = denseUI();
  const cv = Math.round((dense ? 32 : 40) * cs);
  set('--cover', cv + 'px');
  // высоту строки меняем только после перетаскивания: список позиционируется по ней из JS и пересобирается целиком
  if (!live) set('--row-h', Math.max(dense ? 44 : 56, cv + (dense ? 12 : 16)) + 'px');
  set('--np-cover', Math.round(50 * Math.min(cs, 1.25)) + 'px');
}

function applyUI() {
  const r = document.documentElement;
  r.dataset.theme = currentMode();
  r.dataset.lite = ui.lite ? '1' : '0';
  r.dataset.compact = denseUI() ? '1' : '0';
  r.dataset.layout = ui.layout.mode;
  r.dataset.side = ui.layout.side;
  r.style.setProperty('--accent', ui.accent);
  r.style.setProperty('--on-accent', isLightColor(ui.accent) ? '#1d1d1f' : '#ffffff');
  r.style.setProperty('--op', opValue().toFixed(3));
  r.style.setProperty('--blur', ui.blur + 'px');
  // сменили светлую/тёмную тему: палитру по обложке нужно собрать заново
  if (ui.look.auto && autoNow && autoNow.mode !== paletteMode()) autoCover();
  applyLook();
  applyBlocks();
  if (ui.layout.mode !== 'full') r.classList.remove('peek');
  r.dataset.theme = currentMode();
  applyGrad();
  applyWall();
  const old = rowH;
  readRowH();
  if (old !== rowH) vlReset();
  syncSettingsUI();
  syncLookUI();
  pushTheme();
}
/* ---------- живое применение при перетаскивании ползунков и палитры ----------
   input приходит чаще, чем кадры: на каждое событие только меняем значение в ui, а CSS-переменные
   обновляем один раз за кадр. Всё тяжёлое (высота строк, блоки, контраст, список тем) и запись на диск
   делаем один раз, когда отпустили или после 300 мс тишины. */
const LIVE_IDLE_MS = 300;
let liveRaf = 0, liveIdle = 0, liveWall = false;
const LK_FMT = { 'lk-rs': (v) => v + '%', 'lk-blur': (v) => v + ' px', 'lk-alpha': (v) => v + '%', 'lk-cover': (v) => v + '%' };
function lkReadout(id) { const el = document.getElementById(id), out = document.getElementById(id + '-v'); if (el && out && LK_FMT[id]) out.textContent = LK_FMT[id](Number(el.value)); }
function liveChange(opts = {}) {
  const cl = document.documentElement.classList;
  cl.add('lk-drag');
  cl.toggle('lk-drag-blur', !!opts.blur);   // двигаем сам блюр: оставляем размытие фона, чтобы его было видно
  if (opts.wall) liveWall = true;
  if (!liveRaf) liveRaf = requestAnimationFrame(liveFlush);
  clearTimeout(liveIdle);
  liveIdle = setTimeout(liveEnd, LIVE_IDLE_MS);
}
function liveFlush() {
  liveRaf = 0;
  const r = document.documentElement;
  const mode = currentMode();
  if (r.dataset.theme !== mode) r.dataset.theme = mode;
  const op = opValue().toFixed(3);
  if (r.style.getPropertyValue('--op') !== op) r.style.setProperty('--op', op);
  const blur = ui.blur + 'px';
  if (r.style.getPropertyValue('--blur') !== blur) r.style.setProperty('--blur', blur);
  applyLook(true);
  applyGrad();
  if (liveWall) { liveWall = false; applyWall(); }
  if (gradBarDirty) gradBarRefresh();
  pushTheme();
}
function liveEnd() {
  clearTimeout(liveIdle);
  liveIdle = 0;
  if (liveRaf) { cancelAnimationFrame(liveRaf); liveRaf = 0; }
  const cl = document.documentElement.classList;
  const was = cl.contains('lk-drag');
  cl.remove('lk-drag', 'lk-drag-blur');
  liveWall = false;
  applyUI();     // полная пересборка: строки списка, блоки, контраст, список тем, предпросмотр
  saveUI();      // одна запись в store.json
  return was;
}
window.__lookFlush = () => { if (liveRaf) { cancelAnimationFrame(liveRaf); liveFlush(); } };   // для замеров: кадр без ожидания rAF

// заголовок родного окна Windows: светлый или тёмный под тему
let pushedTheme = null;
function pushTheme() {
  if (typeof appInfo === 'undefined' || !appInfo.native) return;
  const m = currentMode();
  if (m === pushedTheme) return;
  pushedTheme = m;
  appCmd('theme', '?mode=' + m);
}
// градиент живёт в одной CSS-переменной: при перетаскивании точек обновляется только она
function applyGrad() {
  const r = document.documentElement;
  const css = gradCss(effGrad());
  if (r.style.getPropertyValue('--wall-grad') !== css) r.style.setProperty('--wall-grad', css);
  if (r.dataset.wall !== ui.wall) r.dataset.wall = ui.wall;
}
// смена режима фона: из обычного фона темы запоминаем его, чтобы можно было вернуться
function setWall(id) {
  if (SPECIAL_WALLS.has(id) && !SPECIAL_WALLS.has(ui.wall)) ui.wallPrev = ui.wall;
  ui.wall = id;
}
let lastWallBg = null;
function applyWall() {
  const el = $('wall');
  let cls = 'wall';
  let bg = '';
  const w = ui.wall;
  if (w === 'gradient') {
    cls += ' grad';
  } else if (w === 'custom') {
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
  lib: { sp: LS.json('sp_lib', []), sc: [], local: [], yt: [] },
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
  loading: { sp: false, sc: false, yt: false },
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
  if (min < 60) return T('a.fmtTotal.1', { min: min });
  const h = Math.floor(min / 60);
  return T('a.fmtTotal.2', { h: h, p2: min % 60 });
}
function plural(n, forms) {
  if (I18N.lang === 'en') return n === 1 ? forms[0] : forms[2];   // у английского две формы: единственное и множественное (первая и последняя в списке)
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
const trackForms = () => [T('a.track.one'), T('a.track.few'), T('a.track.many')];
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
const lbl = (s) => (typeof s === 'string' && s[0] === '@' ? T(s.slice(1)) : s);
const NET_RE = /failed to fetch|networkerror|load failed|fetch failed|network request failed|timeout|timed out/i;
const netMsg = () => T('a.net.msg');
const errText = (e) => (e && NET_RE.test(String(e.message)) ? netMsg() : (e && e.message) || T('a.errText.1'));
// сбои, до которых не дошёл свой обработчик: тихо в консоль, а про сеть говорим по-человечески
window.addEventListener('unhandledrejection', (ev) => {
  const e = ev.reason;
  console.warn(T('a.on_window_unhandledrejection.1'), e);
  ev.preventDefault();
  if (e && NET_RE.test(String(e.message))) toast(netMsg());
});
async function api(url, opts) {
  let r;
  try { r = await fetch(url, opts); }
  catch (e) { if (e && e.name === 'AbortError') throw e; throw new Error(NET_RE.test(String(e && e.message)) ? T('a.api.1') : errText(e)); }
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error((j && j.error) || T('a.api.2', { status: r.status })); e.status = r.status; throw e; }
  return j;
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(T('a.onerror.1') + src));
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
const widevineMsg = () => T('a.widevine.msg');
let leavingForAuth = false;

function b64url(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function randomString(n = 64) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); }

async function spLogin() {
  const clientId = $('sp-client').value.trim();
  if (!/^[0-9a-f]{32}$/i.test(clientId)) { setAccState('sp', T('a.spLogin.1'), 'err'); return; }
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
  if (q.get('error')) { toast(T('a.spHandleCallback.1')); return; }
  if (!q.get('code')) return;
  try {
    await spTokenRequest({ client_id: LS.get('sp_client_id'), grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT_URI, code_verifier: LS.get('sp_verifier') });
    LS.del('sp_verifier');
    toast(T('a.spHandleCallback.2'));
  } catch (e) { toast(T('a.spHandleCallback.3') + e.message); }
}
let refreshing = null;
async function spRefresh() {
  if (refreshing) return refreshing;
  const t = LS.json('sp_token', {});
  if (!t.refresh) throw fatal(T('a.spRefresh.1'));
  refreshing = spTokenRequest({ client_id: LS.get('sp_client_id'), grant_type: 'refresh_token', refresh_token: t.refresh })
    .finally(() => { refreshing = null; });
  return refreshing;
}
async function spToken() {
  const t = LS.json('sp_token', {});
  if (!t.access) throw fatal(T('a.spToken.1'));
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
  setAccState('sp', T('a.spLoadLikes.1'));
  renderHead(); renderEmpty();
  try {
    const out = [];
    // если API отвечает «Invalid limit», уменьшаем страницу (50 → 20 → 10) и запоминаем рабочее значение
    let limit = Number(LS.get('sp_likes_limit')) || 50;
    let url = null;
    const firstPage = async () => {
      for (;;) {
        try { return await spApi(`/me/tracks?limit=${limit}`); }
        catch (e) {
          if (!/limit/i.test(e.message) || limit <= 10) throw e;
          limit = limit > 20 ? 20 : 10;
          LS.set('sp_likes_limit', String(limit));
        }
      }
    };
    for (let first = true; first || url; first = false) {
      const j = first ? await firstPage() : await spApi(url);
      for (const it of (j && j.items) || []) {
        const t = it.track;
        if (t && t.id && !t.is_local) out.push(spMap(t, it.added_at));
      }
      url = j && j.next;
      if (url) setAccState('sp', T('a.spLoadLikes.2', { length: out.length }));
    }
    state.lib.sp = out;
    LS.set('sp_lib', JSON.stringify(out));
    setAccState('sp', `${out.length} ${plural(out.length, trackForms())}`, 'ok');
    rebuildAll();
  } catch (e) {
    setAccState('sp', e.message, 'err');
    toast('Spotify: ' + e.message);
  } finally {
    state.loading.sp = false;
    render();
  }
}
let spPremium = null;   // null: пока не знаем; false: аккаунт без Premium, играть из Spotify нельзя
async function spMe() {
  try {
    const me = await spApi('/me');
    if (me) {
      $('sp-state').dataset.name = me.display_name || me.id || '';
      spPremium = me.product ? me.product === 'premium' : null;
      spFreeSync();
      renderSearchChips();
      if (searchActive()) searchRefresh();
    }
  } catch {}
}
// у аккаунта без Premium Spotify играть нельзя: показываем жёлтое примечание, звук берём с YouTube или SoundCloud
function spFreeSync() {
  const el = $('sp-free-note');
  el.textContent = T('a.sp.freenote');
  el.hidden = !(LS.get('sp_token') && spPremium === false);
}
let spAltNoted = false;   // уведомление «играю с другого источника» показываем один раз за сессию
function spLogout() {
  LS.del('sp_token'); LS.del('sp_lib');
  spPremium = null;
  spFreeSync();
  state.lib.sp = [];
  if (sp.player) { try { sp.player.disconnect(); } catch {} }
  sp.player = null; sp.device = null; sp.ready = null;
  if (state.cur && state.cur.src === 'sp') { state.cur = null; state.playing = false; updatePlayer(); }
  setAccState('sp', T('a.spLogout.1'));
  rebuildAll();
  syncAccounts();
}

/* ===================== Spotify: плеер ===================== */
const sp = { player: null, device: null, ready: null, last: { pos: 0, at: 0 }, endGuard: null };
function spInit() {
  if (sp.ready) return sp.ready;
  sp.ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(fatal(T('a.spInit.1'))), 20000);
    const fail = (e) => { clearTimeout(timer); reject(e); };
    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new Spotify.Player({
        name: 'Sonara',
        getOAuthToken: (cb) => spToken().then(cb, () => cb('')),
        volume: gain(),
      });
      p.addListener('ready', ({ device_id }) => { sp.device = device_id; clearTimeout(timer); resolve(p); });
      p.addListener('not_ready', () => { sp.device = null; });
      p.addListener('initialization_error', () => { const e = fatal(widevineMsg()); e.widevine = true; fail(e); });
      p.addListener('authentication_error', () => fail(fatal(T('a.onSpotifyWebPlaybackSDKReady.1'))));
      p.addListener('account_error', () => { spPremium = false; fail(fatal(T('a.onSpotifyWebPlaybackSDKReady.2'))); });
      p.addListener('playback_error', ({ message }) => { if (state.cur && state.cur.src === 'sp') toast('Spotify: ' + message); });
      p.addListener('player_state_changed', spOnState);
      sp.player = p;
      p.connect().then((ok) => { if (!ok) fail(fatal(widevineMsg())); });
    };
    if (window.Spotify && window.Spotify.Player) window.onSpotifyWebPlaybackSDKReady();
    else loadScript('https://sdk.scdn.co/spotify-player.js').catch(() => fail(fatal(T('a.spInit.2'))));
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
      if (e.status === 403) throw fatal(T('a.spPlay.1'));
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
let spInstalled = null;
async function spAppInstalled() {
  if (spInstalled === true) return true;
  try { spInstalled = !!(await api('/api/app/spotify-installed', { headers: { 'X-Player': '1' } })).installed; } catch { spInstalled = true; }   // не смогли узнать: считаем, что есть
  return spInstalled;
}
async function spcEnsureDevice(token) {
  let d = spcPick(await spcDevices());
  if (d) return d;
  if (!(await spAppInstalled())) throw fatal(T('a.sp.noapp'));   // не установлено: запускать нечего, объясняем что делать
  toast(T('a.spcEnsureDevice.1'));
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
  throw fatal(T('a.sp.notrunning'));
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
    } else if (e.status === 403) throw fatal(T('a.spcPlay.1'));
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
      toast(T('a.spcPoll.1'));
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
  spc.volTimer = setTimeout(() => spcCmd(`/me/player/volume?volume_percent=${Math.round(state.volume * fadeMul)}`), 350);
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
// источники, которые играют через общий <audio>: SoundCloud, файлы с компа и YouTube Music
const isAudioSrc = (s) => s === 'sc' || s === 'local' || s === 'yt';
const isScAudio = () => state.cur && isAudioSrc(state.cur.src) && scMode === 'audio';
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
  if (info.snipped) toast(T('a.scPlay.1'));
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
  if (state.cur.src === 'local') { playFailed(new Error(T('a.on_audio_error.1')), token); return; }
  if (state.cur.src === 'yt') { playFailed(new Error(T('a.on_audio_error.2')), token); return; }
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
    const to = setTimeout(() => reject(new Error(T('a.scWidgetPlay.1'))), 15000);
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

// YouTube Music: сервер вынимает ссылку на звук через yt-dlp (3-5 секунд) и отдаёт его со своего адреса
async function ytPlay(t, token) {
  scMode = 'audio';
  if (scw) { try { scw.pause(); } catch {} }
  hlsCleanup();
  audio.pause();
  const cq = ytCookieFb() ? '&cookies=1' : '';
  await api('/api/yt/stream?id=' + encodeURIComponent(t.id) + cq);
  if (token !== state.token) return;
  audio.src = '/api/yt/audio?id=' + encodeURIComponent(t.id) + cq;
  audio.volume = gain();
  try { await audio.play(); }
  catch (e) {
    if (e.name === 'NotAllowedError') { state.playing = false; updatePlayer(); return; }
    if (e.name === 'AbortError') return;
    throw e;
  }
}
// у части роликов нет большой картинки hq720: откатываемся на маленькую, она есть всегда
document.addEventListener('error', (e) => {
  const i = e.target;
  if (i && i.tagName === 'IMG' && /ytimg\.com\/vi\/[\w-]+\/hq720\.jpg/.test(i.src)) i.src = i.src.replace('hq720.jpg', 'mqdefault.jpg');
}, true);

/* ===================== Ядро плеера ===================== */
// fadeMul: плавное затухание таймера сна, 1 это обычная громкость; ползунок громкости при этом не двигается
let fadeMul = 1;
const gain = () => (state.volume / 100) ** 2 * fadeMul;
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
  if ((src === 'local' || src === 'yt') && scw) { try { scw.pause(); } catch {} }
  if (!isAudioSrc(src)) {
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
    if (t.src === 'sp') {
      if (spPremium === false) throw noPremium();   // без Premium даже не пытаемся: иначе «no active device» и подобные ошибки
      await spPlay(t, token);
    }
    else if (t.src === 'local') await localPlay(t, token);
    else if (t.src === 'yt') await ytPlay(t, token);
    else await scPlay(t, token);
    if (token === state.token) state.fails = 0;
  } catch (e) {
    // трек Spotify без Premium: тот же трек на YouTube или SoundCloud
    if (token === state.token && t.src === 'sp' && spPremium === false) {
      const alt = await findAltSources(t, ytStatus.installed ? ['yt', 'sc'] : ['sc']);
      if (token !== state.token) return;
      if (alt) {
        const nxt = { ...t, src: alt.src, id: alt.id, uri: undefined, url: alt.url, duration: alt.duration || t.duration, alts: [], _altTried: true };
        const qi = state.order[state.pos];
        if (state.queue[qi] === t) state.queue[qi] = nxt;
        if (!spAltNoted) { spAltNoted = true; toast(T('a.sp.altnote', { src: alt.src === 'yt' ? 'YouTube' : SRC_NAMES[alt.src] || alt.src }), 6000); }
        return playTrack(nxt);
      }
      return playFailed(new Error(T('a.sp.noalt')), token);
    }
    // у объединённого трека есть другие источники: пробуем следующий, например YouTube, если у Spotify нет Premium
    if (token === state.token && t.alts && t.alts.length) {
      const [alt, ...rest] = t.alts;
      const nxt = { ...t, src: alt.src, id: alt.id, uri: alt.uri, url: alt.url, duration: alt.duration || t.duration, alts: rest };
      const qi = state.order[state.pos];
      if (state.queue[qi] === t) state.queue[qi] = nxt;
      toast(T('a.playTrack.1', { p1: SRC_NAMES[alt.src] || alt.src }));
      return playTrack(nxt);
    }
    // трек из YouTube не заиграл: ищем тот же на SoundCloud
    if (token === state.token && t.src === 'yt' && !t._altTried) {
      t._altTried = true;
      const alt = await findAltSource(t);
      if (token === state.token && alt) {
        const nxt = { ...t, src: alt.src, id: alt.id, uri: undefined, url: alt.url, duration: alt.duration || t.duration, alts: [], _altTried: true };
        const qi = state.order[state.pos];
        if (state.queue[qi] === t) state.queue[qi] = nxt;
        toast(T('a.playTrack.2'));
        return playTrack(nxt);
      }
    }
    playFailed(e, token);
  }
}
// тот же трек в другом источнике: для упавшего YouTube ищем на SoundCloud и принимаем только точное совпадение названия
const noPremium = () => Object.assign(new Error(T('a.sp.noalt')), { noPremium: true });
// тот же трек на первом подходящем источнике из списка
async function findAltSources(t, srcs) {
  for (const src of srcs) { const alt = await findAltSource(t, src); if (alt) return alt; }
  return null;
}
async function findAltSource(t, src = 'sc') {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 10000);
  try {
    const q = `${String(t.artist || '').split(',')[0]} ${t.title}`.trim();
    const j = await api('/api/search?src=' + src + '&q=' + encodeURIComponent(q), { signal: ctl.signal });
    const [title, artist] = dupParts(t);
    return (j.tracks || []).find((x) => { const [xt, xa] = dupParts(x); return title && xt === title && artistsOverlap(artist, xa) && durOk(t.duration, x.duration); }) || null;
  } catch { return null; } finally { clearTimeout(to); }
}
const SRC_NAMES = { sp: 'Spotify', sc: 'SoundCloud', yt: 'YouTube Music', get local() { return T('a.const.43'); } };
function playFailed(e, token) {
  if (token !== state.token) return;
  console.warn(e);
  state.playing = false;
  updatePlayer();
  const skip = !(e && e.fatal) && state.queue.length > 1 && state.fails < Math.min(8, state.queue.length);
  // если пропускаем, уведомление короткое: подробности в консоли и player.log
  const name = state.cur && state.cur.title ? `«${state.cur.title.slice(0, 40)}»` : T('a.playFailed.1');
  toast(skip ? T('a.playFailed.2', { name: name }) : e && e.message ? errText(e) : T('a.playFailed.3'), e && e.fatal ? 7000 : 3800);
  if (e && e.fatal) return;
  if (++state.fails <= Math.min(8, state.queue.length) && state.queue.length > 1) setTimeout(() => { if (token === state.token) next('fail'); }, 900);
}
function next(auto = false) {
  if (auto === true && sleepT.mode === 'track') { sleepFire(); return; }   // таймер «до конца трека»: стоп вместо следующего трека
  if (!state.queue.length) return;
  if (auto === true && state.repeat === 'one' && state.cur) { playTrack(state.cur); return; }
  let p = state.pos + 1;
  if (p >= state.order.length && state.queueKind === 'radio') {
    // радио бесконечное: догружаем похожие и играем дальше
    const token = state.token;
    radioMore().then(() => {
      if (token !== state.token) return;   // за время подбора трек уже сменили руками
      if (state.pos + 1 < state.order.length) { state.pos++; playTrack(state.queue[state.order[state.pos]]); }
      else if (!state.radio.more && !state.radio.loading) { engPause(); state.playing = false; updatePlayer(); toast(T('a.next.1')); }
    }).catch(() => {});
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
  if (ui.look.auto || ui.gradCover) autoCover();
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
  npTitle.textContent = t ? t.title : T('a.updatePlayer.1');
  npArtist.textContent = t ? t.artist : T('a.updatePlayer.2');
  const art = t ? t.art || t.cover : '';
  if (art) { if (npCover.getAttribute('src') !== art) npCover.src = art; } else npCover.removeAttribute('src');
  const icon = state.playing ? 'pause' : 'play';
  if (lastPlayIcon !== icon) { $('b-play').innerHTML = ICONS[icon]; lastPlayIcon = icon; }
  $('b-shuffle').classList.toggle('on', state.shuffle);
  if (lastRepeat !== state.repeat) {
    $('b-repeat').innerHTML = state.repeat === 'one' ? ICONS.repeat1 : ICONS.repeat;
    $('b-repeat').classList.toggle('on', state.repeat !== 'off');
    $('b-repeat').title = state.repeat === 'off' ? T('a.updatePlayer.3') : state.repeat === 'all' ? T('a.updatePlayer.4') : T('a.updatePlayer.5');
    lastRepeat = state.repeat;
  }
  document.body.classList.toggle('playing', state.playing);
  $('lyrics').classList.toggle('paused', !state.playing);
  lyKick();
  document.title = t ? `${state.playing ? '▶ ' : ''}${t.title} · ${t.artist}` : 'Sonara';
  if (ms) { try { ms.playbackState = t ? (state.playing ? 'playing' : 'paused') : 'none'; } catch {} }
  updateProgress();
  publishState();
  renderQueue();
}

/* ---------- состояние для мини-плеера и трея ---------- */
let pubKey = '', pubAt = 0;
function publishState(force) {
  if (!appInfo.version) return;
  const t = state.cur;
  const s = {
    hasTrack: !!t, title: t ? t.title : '', artist: t ? t.artist : '', art: t ? bigArt(t) : '', src: t ? t.src : '',
    album: t ? t.album || '' : '', url: t ? (t.src === 'sp' ? `https://open.spotify.com/track/${t.id}` : t.src === 'sc' || t.src === 'yt' ? t.url || '' : '') : '',
    playing: !!state.playing, time: Math.round(lyNow()), dur: Math.round(state.dur || 0), at: Date.now(), sleep: !!sleepT.mode,
  };
  const key = [s.title, s.artist, s.playing, s.dur, s.sleep].join('|');
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
    else if (d.cmd === 'pause') { if (state.playing) engPause(); }
    else if (d.cmd === 'sleepcancel') sleepCancel();
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
  sleepTick();   // тики идут и в свёрнутом окне, где обычные таймеры засыпают
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
const VIEW_TITLES = { get all() { return T('a.const.44'); }, sp: 'Spotify', sc: 'SoundCloud', yt: 'YouTube Music', get local() { return T('a.const.45'); }, get recs() { return T('a.const.46'); }, get radio() { return T('a.const.47'); }, get stats() { return T('a.const.48'); } };
const curPl = () => (state.view.startsWith('pl:') ? plGet(state.view.slice(3)) : null);
function viewTitle() {
  if (searchActive()) return T('a.viewTitle.1');
  if (state.view.startsWith('pl:')) { const p = curPl(); return p ? p.name : T('a.viewTitle.2'); }
  if (state.view === 'radio' && state.radio.seed) return T('a.viewTitle.3') + state.radio.seed.title;
  return VIEW_TITLES[state.view] || 'Sonara';
}
function rebuildAll() {
  state.all = [...state.lib.sp, ...state.lib.sc, ...state.lib.yt, ...state.lib.local].sort((a, b) => (b.at || 0) - (a.at || 0));
  if (searchActive()) searchMergeNow();
  render();
}
function viewSource() {
  if (state.view === 'sp') return state.lib.sp;
  if (state.view === 'sc') return state.lib.sc;
  if (state.view === 'yt') return state.lib.yt;
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
  $('cnt-yt').textContent = state.lib.yt.length || '';
  $('cnt-all').textContent = nsp + nsc + state.lib.yt.length + state.lib.local.length || '';
  state.list = searchActive() ? searchSt.items : filtered(viewSource());
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
    sub = state.radio.loading ? T('a.renderHead.1') : n ? T('a.renderHead.2', { n: n, p2: plural(n, trackForms()) }) : '';
  } else if (state.view === 'recs') {
    sub = state.recsLoading ? T('a.renderHead.3')
      : n ? T('a.renderHead.17', { n: n, p2: plural(n, trackForms()), recsSeeds: state.recsSeeds, p4: plural(state.recsSeeds, [T('a.renderHead.4'), T('a.renderHead.5'), T('a.renderHead.6')]) }) : '';
  } else if (searchActive()) {
    const busy = Object.values(searchSt.per).some((p) => p.st === 'loading') || (searchSt.timer && !Object.keys(searchSt.per).length);
    sub = `«${state.query.trim()}» · ${n} ${plural(n, trackForms())}${busy ? T('a.renderHead.7') : ''}`;
  } else if (n) {
    const total = state.list.reduce((s, t) => s + (t.duration || 0), 0);
    sub = `${n} ${plural(n, trackForms())} · ${fmtTotal(total)}${loading ? T('a.renderHead.8') : ''}`;
  } else if (loading) sub = T('a.renderHead.9');
  $('view-sub').textContent = sub;
  $('col3').textContent = state.view === 'recs' ? T('a.renderHead.10') : T('a.renderHead.11');
  const isStats = state.view === 'stats';
  document.querySelector('.cols').hidden = isStats;
  document.querySelector('.head-actions').hidden = isStats;
  if (isStats) sub = T('a.renderHead.12');
  if (state.view === 'local' && !n && !state.query) sub = state.localFolders.length ? T('a.renderHead.13') : '';
  $('view-sub').textContent = sub;
  $('act-play').disabled = !n;
  $('act-shuffle').disabled = !n || state.view === 'radio';
  $('act-refresh').classList.toggle('spin', !!loading);
  $('act-refresh').hidden = isPl;
  $('act-m3u').hidden = !isPl;
  $('act-rename').hidden = !isPl;
  $('act-delete').hidden = !isPl;
  $('act-refresh').title = state.view === 'recs' ? T('a.renderHead.14') : state.view === 'radio' ? T('a.renderHead.15') : T('a.renderHead.16');
}
function emptyCard(icon, title, text, buttons = '') {
  return `<div class="empty-card"><div class="brand-icon big">${icon}</div><h2>${title}</h2><p>${text}</p><div class="btns-row">${buttons}</div></div>`;
}
function renderEmpty() {
  const el = $('empty');
  if (state.list.length) { el.hidden = true; el.innerHTML = ''; return; }
  const hasAny = state.lib.sp.length || state.lib.sc.length || state.lib.yt.length;
  const btnSp = T('a.renderEmpty.1');
  const btnSc = T('a.renderEmpty.2');
  const btnYt = T('a.renderEmpty.3');
  let html;
  if (searchActive()) {
    const pers = Object.values(searchSt.per);
    const busy = pers.some((p) => p.st === 'loading') || !pers.length;
    const failed = pers.some((p) => p.st === 'err');
    html = busy ? T('a.renderEmpty.4')
      : emptyCard(ICONS.search, T('a.renderEmpty.5'), T('a.renderEmpty.31', { p1: escapeHtml(state.query.trim()), p2: failed ? T('a.renderEmpty.6') : T('a.renderEmpty.7') }));
  }
  else if (state.view.startsWith('pl:')) html = emptyCard(ICONS.note, T('a.renderEmpty.8'), T('a.renderEmpty.9'));
  else if (state.view === 'radio') {
    html = state.radio.loading ? T('a.renderEmpty.10')
      : emptyCard(ICONS.radio, T('a.renderEmpty.11'), T('a.renderEmpty.12'));
  } else if (state.view === 'recs') {
    if (state.recsLoading) html = T('a.renderEmpty.13');
    else if (!hasAny) html = emptyCard(ICONS.sparkle, T('a.renderEmpty.14'), T('a.renderEmpty.15'), btnSp + btnSc);
    else html = emptyCard(ICONS.sparkle, T('a.renderEmpty.16'), escapeHtml(state.recsError) || T('a.renderEmpty.17'), T('a.renderEmpty.18'));
  } else if (state.loading.sp || state.loading.sc || state.loading.yt) html = T('a.renderEmpty.19');
  else if (state.view === 'sp') html = emptyCard(ICONS.note, 'Spotify', LS.get('sp_token') ? T('a.renderEmpty.20') : T('a.renderEmpty.21'), LS.get('sp_token') ? '' : btnSp);
  else if (state.view === 'stats') { el.hidden = true; el.innerHTML = ''; return; }
  else if (state.view === 'local') html = emptyCard(ICONS.folder, T('a.renderEmpty.22'), T('a.renderEmpty.23'), T('a.renderEmpty.24'));
  else if (state.view === 'yt') html = emptyCard(ICONS.note, 'YouTube Music', ytLists.length ? T('a.renderEmpty.25') : T('a.renderEmpty.26'), btnYt.replace('class="pill"', 'class="pill accent"'));
  else if (state.view === 'sc') html = emptyCard(ICONS.note, 'SoundCloud', LS.get('sc_user') ? T('a.renderEmpty.27') : T('a.renderEmpty.28'), btnSc.replace('class="pill"', 'class="pill accent"'));
  else html = emptyCard(ICONS.note, T('a.renderEmpty.29'), T('a.renderEmpty.30'), btnSp + btnSc + btnYt);
  el.innerHTML = html;
  el.hidden = false;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
$('empty').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.acc) { openSettings('acc'); setTimeout(() => $(b.dataset.acc === 'sp' ? 'sp-client' : b.dataset.acc === 'local' ? 'lc-path' : b.dataset.acc === 'yt' ? 'yt-link' : 'sc-user').focus(), 50); }
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
    T('a.makeRow.1') + ICONS.more + '</button></div>';
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
const isCur = (t) => !!state.cur && (state.cur.src === t.src && state.cur.id === t.id || (t.alts || []).some((x) => state.cur.src === x.src && state.cur.id === x.id));
const SRC_BADGE = { sp: ['sp', 'Spotify'], sc: ['sc', 'SoundCloud'], yt: ['yt', 'YouTube'], local: ['lc', '@a.src.local'] };
// у объединённого трека бейджи всех источников, недоступные для воспроизведения приглушены
function srcBadges(t) {
  const list = t._srcs ? ['sp', 'sc', 'yt', 'local'].filter((s) => t._srcs.includes(s)) : [t.src];
  return list.map((s) => `<span class="badge ${SRC_BADGE[s][0]}${t._dim && t._dim.includes(s) ? ' dim' : ''}">${lbl(SRC_BADGE[s][1])}</span>`).join('');
}
function fillRow(el, t, i) {
  const key = t.src + ':' + t.id + ':' + i + ':' + (t._srcs ? t._srcs.join() + (t._dim || []).join() : '');
  if (el._key !== key) {
    el._key = key;
    el._i = i;
    el.style.transform = `translateY(${i * rowH}px)`;
    el._num.textContent = i + 1;
    el._tt.textContent = t.title;
    el._ar.textContent = t.artist;
    const cv = t.cover || NO_COVER;
    if (el._cv !== cv) { el._cv = cv; el._img.src = cv; }   // сравниваем со своим значением: запасная картинка не должна перезаписываться
    if (state.view === 'recs') el._c3.textContent = t.because ? t.because : '';
    else el._c3.innerHTML = srcBadges(t);
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
  setAccState('sc', T('a.scLoadLikes.1'));
  renderHead(); renderEmpty();
  let stale = false;
  try {
    const r = await api(`/api/sc/likes?user=${encodeURIComponent(user)}${force ? '&force=1' : ''}`);
    state.lib.sc = r.tracks || [];
    stale = !!r.cached && Date.now() - (r.at || 0) > 30 * 60 * 1000;
    setAccState('sc', `${state.lib.sc.length} ${plural(state.lib.sc.length, trackForms())}`, 'ok');
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

/* ===================== YouTube Music ===================== */
// подключаются плейлисты по ссылке (без входа в аккаунт) и «Понравившиеся» (LM) через cookies Brave
let ytLists = LS.json('yt_lists', []);
if (!Array.isArray(ytLists)) ytLists = [];
ytLists = ytLists.filter((l) => l && /^[\w-]{2,60}$/.test(l.id || '')).slice(0, 12)
  .map((l) => ({ id: l.id, name: String(l.name || '').slice(0, 80), cookies: !!l.cookies, n: Number(l.n) || 0 }));
let ytStatus = { installed: true, version: '', brave: false, js: null };
// если ролик не играет ни одним способом без входа, можно пробовать cookies Brave (по умолчанию выключено)
const ytCookieFb = () => LS.get('yt_cookie_fb') === '1';
const saveYtLists = () => { LS.set('yt_lists', JSON.stringify(ytLists)); renderYtLists(); };
async function ytCheck() {
  try { ytStatus = await api('/api/yt/status'); } catch {}
  renderYtLists();
  renderSearchChips();
}
function renderYtLists() {
  const box = $('yt-lists');
  box.innerHTML = '';
  for (const l of ytLists) {
    const d = document.createElement('div');
    d.className = 'folder';
    d.innerHTML = T('a.renderYtLists.1', { x: ICONS.x });
    d.querySelector('span').textContent = `${l.id === 'LM' ? T('a.renderYtLists.2') : l.name || l.id}${l.n ? ' · ' + l.n : ''}`;
    d.querySelector('span').title = l.id;
    d.querySelector('button').addEventListener('click', () => {
      ytLists = ytLists.filter((x) => x.id !== l.id);
      state.lib.yt = state.lib.yt.filter((t) => t._list !== l.id);
      saveYtLists();
      ytLoadAll(false);
    });
    box.appendChild(d);
  }
  const ib = $('yt-install');
  if (!ib.disabled) ib.textContent = ytStatus.installed ? T('a.renderYtLists.3') : T('a.renderYtLists.4');
  $('yt-version').textContent = !ytStatus.installed ? '' : `yt-dlp ${ytStatus.version || ''} · ${ytStatus.js ? T('a.renderYtLists.5') + ytStatus.js : T('a.renderYtLists.6')}`.trim();
  $('yt-cookie-fb').checked = ytCookieFb();
  $('yt-likes').title = ytStatus.brave ? T('a.renderYtLists.7') : T('a.renderYtLists.8');
  $('yt-likes').disabled = !ytStatus.brave;
}
async function ytLoadAll(force) {
  if (state.loading.yt) return;
  if (!ytLists.length) { state.lib.yt = []; setAccState('yt', ''); rebuildAll(); return; }
  state.loading.yt = true;
  setAccState('yt', T('a.ytLoadAll.1'));
  renderHead(); renderEmpty();
  let stale = false, errors = 0, lastError = '';
  const out = [], seen = new Set();
  for (const l of ytLists) {
    try {
      const r = await api(`/api/yt/playlist?list=${encodeURIComponent(l.id)}${l.cookies ? '&cookies=1' : ''}${force ? '&force=1' : ''}`);
      l.name = r.name || l.name;
      l.n = (r.tracks || []).length;
      stale = stale || (!!r.cached && Date.now() - (r.at || 0) > 30 * 60 * 1000);
      for (const t of r.tracks || []) if (!seen.has(t.id)) { seen.add(t.id); t._list = l.id; out.push(t); }
    } catch (e) {
      errors++; lastError = e.message;
      if (e.status === 424) { ytStatus.installed = false; }
    }
  }
  state.lib.yt = out;
  LS.set('yt_lists', JSON.stringify(ytLists));
  renderYtLists();
  if (errors && !out.length) { setAccState('yt', lastError, 'err'); toast('YouTube Music: ' + lastError, 6000); }
  else if (errors) { setAccState('yt', T('a.ytLoadAll.2', { length: out.length, p2: plural(out.length, trackForms()) }), 'err'); toast('YouTube Music: ' + lastError, 6000); }
  else setAccState('yt', `${out.length} ${plural(out.length, trackForms())}`, 'ok');
  state.loading.yt = false;
  rebuildAll();
  if (stale && !errors) ytLoadAll(true);
}
async function ytAdd(id, cookies) {
  if (ytLists.some((l) => l.id === id)) { setAccState('yt', T('a.ytAdd.1'), 'err'); return; }
  if (ytLists.length >= 12) { setAccState('yt', T('a.ytAdd.2'), 'err'); return; }
  ytLists.push({ id, name: '', cookies: !!cookies, n: 0 });
  saveYtLists();
  await ytLoadAll(true);
  const l = ytLists.find((x) => x.id === id);
  if (l && !l.n && accState.yt.cls === 'err') { ytLists = ytLists.filter((x) => x.id !== id); saveYtLists(); ytLoadAll(false); }
}
$('yt-add').addEventListener('click', async () => {
  const v = $('yt-link').value.trim();
  try {
    const r = await api('/api/yt/parse?url=' + encodeURIComponent(v));
    $('yt-link').value = '';
    ytAdd(r.id, false);
  } catch (e) { setAccState('yt', e.message, 'err'); }
});
$('yt-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('yt-add').click(); });
$('yt-likes').addEventListener('click', () => ytAdd('LM', true));
$('yt-install').addEventListener('click', async () => {
  const b = $('yt-install');
  b.disabled = true; b.textContent = T('a.on_ytinstall_click.1');
  try {
    const r = await api('/api/app/ytdlp/install', { method: 'POST', headers: { 'X-Player': '1' } });
    toast(r.updated ? T('a.on_ytinstall_click.2', { version: r.version }) : T('a.on_ytinstall_click.3', { version: r.version }));
    await ytCheck();
    if (r.updated) ytLoadAll(true);
  } catch (e) { setAccState('yt', T('a.on_ytinstall_click.4') + e.message, 'err'); }
  b.disabled = false; renderYtLists();
});
$('yt-cookie-fb').addEventListener('change', (e) => { LS.set('yt_cookie_fb', e.target.checked ? '1' : '0'); });

/* ===================== Глобальный поиск ===================== */
// Поиск идёт параллельно по включённым источникам, у каждого свой таймаут. Результаты приходят по мере готовности:
// упавший или медленный источник не мешает остальным, у него в чипсе остаётся пометка.
const SEARCH_SRCS = [['sp', 'Spotify'], ['sc', 'SoundCloud'], ['yt', 'YouTube Music']];
const SEARCH_TIMEOUT = { sp: 8000, sc: 10000, yt: 20000 };
const SEARCH_DEBOUNCE = 300;
let searchOn = { sp: true, sc: true, yt: true };
{ const saved = LS.json('search_src', {}); if (saved && typeof saved === 'object') for (const [id] of SEARCH_SRCS) if (typeof saved[id] === 'boolean') searchOn[id] = saved[id]; }
const searchSt = { token: 0, remote: { sp: [], sc: [], yt: [] }, per: {}, items: [], timer: 0 };
const searchActive = () => state.query.trim().length > 0;
function searchAvail(id) {
  if (id === 'sp') return !!LS.get('sp_token');
  if (id === 'yt') return ytStatus.installed !== false;
  return true;
}
const searchUsable = (id) => !!searchOn[id] && searchAvail(id);

function setQuery(v, from) {
  state.query = v;
  for (const id of ['gs-input', 'search']) { const el = $(id); if (el !== from && el.value !== v) el.value = v; }
  $('gs-clear').hidden = !v;
  clearTimeout(searchSt.timer);
  searchSt.timer = 0;
  scroller.scrollTop = 0;
  if (!v.trim()) {
    searchSt.token++;
    searchSt.remote = { sp: [], sc: [], yt: [] };
    searchSt.per = {};
    searchSt.items = [];
    renderSearchChips();
    render();
    return;
  }
  if (state.view === 'stats') setView('all');
  searchMergeNow();   // совпадения из своей библиотеки видны сразу, пока ждём сеть
  renderSearchChips();
  render();
  searchSt.timer = setTimeout(runSearch, SEARCH_DEBOUNCE);
}
async function runSearch() {
  searchSt.timer = 0;
  const q = state.query.trim();
  if (!q) return;
  const token = ++searchSt.token;
  const jobs = [];
  for (const [id] of SEARCH_SRCS) {
    if (!searchUsable(id)) { searchSt.per[id] = { st: searchOn[id] ? 'na' : 'off' }; continue; }
    searchSt.per[id] = { st: 'loading' };
    jobs.push(searchOne(id, q, token));
  }
  searchRefresh();
  await Promise.allSettled(jobs);
}
// Spotify принимает в поиске не больше 10 результатов за запрос (иначе «Invalid limit»): берём страницами по 10 через offset.
// Первая страница обязательна, остальные добираем, и если их не дали, остаёмся с тем, что есть.
const SP_SEARCH_PAGE = 10, SP_SEARCH_PAGES = 2;
async function spSearch(q, signal) {
  const page = async (n) => {
    const j = await spApi(`/search?type=track&limit=${SP_SEARCH_PAGE}&offset=${n * SP_SEARCH_PAGE}&q=${encodeURIComponent(q)}`, { signal });
    return ((j && j.tracks && j.tracks.items) || []).filter((t) => t && t.id && !t.is_local).map((t) => spMap(t));
  };
  const first = await page(0);
  if (first.length < SP_SEARCH_PAGE) return first;
  const rest = await Promise.allSettled(Array.from({ length: SP_SEARCH_PAGES - 1 }, (_, i) => page(i + 1)));
  const seen = new Set(first.map((t) => t.id));
  for (const r of rest) if (r.status === 'fulfilled') for (const t of r.value) if (!seen.has(t.id)) { seen.add(t.id); first.push(t); }
  return first;
}
async function searchOne(id, q, token) {
  const ctl = new AbortController();
  const ms = SEARCH_TIMEOUT[id];
  const timer = setTimeout(() => ctl.abort(), ms);
  const t0 = Date.now();
  try {
    let tracks;
    if (id === 'sp') tracks = await spSearch(q, ctl.signal);
    else {
      tracks = (await api(`/api/search?src=${id}&q=${encodeURIComponent(q)}`, { signal: ctl.signal })).tracks || [];
    }
    if (token !== searchSt.token) return;
    searchSt.remote[id] = tracks;
    searchSt.per[id] = { st: 'ok', n: tracks.length, ms: Date.now() - t0 };
  } catch (e) {
    if (token !== searchSt.token) return;
    searchSt.remote[id] = [];
    searchSt.per[id] = { st: 'err', msg: ctl.signal.aborted || e.name === 'AbortError' ? T('a.searchOne.1', { p1: Math.round(ms / 1000) }) : e.message, ms: Date.now() - t0 };
    console.warn(T('a.searchOne.2'), id, searchSt.per[id].msg);
  } finally { clearTimeout(timer); }
  searchRefresh();
}
function searchRefresh() {
  renderSearchChips();   // счётчики не зависят от слияния, поэтому рисуем их первыми
  try { searchMergeNow(); }
  catch (e) {
    // если слияние сломалось на чьих-то данных, показываем результаты как есть, без объединения дублей
    console.error(T('a.searchRefresh.1'), e);
    searchSt.items = SEARCH_SRCS.flatMap(([id]) => (searchUsable(id) ? searchSt.remote[id] || [] : []));
  }
  if (searchActive()) render();
}
function renderSearchChips() {
  const active = searchActive();
  $('gs-chips').innerHTML = SEARCH_SRCS.map(([id, name]) => {
    const per = searchSt.per[id] || {}, avail = searchAvail(id), on = !!searchOn[id] && avail;
    let tag = '';
    if (on && active) {
      if (per.st === 'loading') tag = '<i class="gs-spin"></i>';
      else if (per.st === 'ok') tag = `<b>${per.n}</b>`;
      else if (per.st === 'err') tag = '<b class="bad">!</b>';
    }
    let title = !avail ? (id === 'sp' ? T('a.renderSearchChips.1') : T('a.renderSearchChips.2')) : on ? T('a.renderSearchChips.3') : T('a.renderSearchChips.4');
    if (id === 'sp' && avail && spPremium === false) title += '. ' + T('a.sp.chipnote');
    if (on && active && per.st === 'ok') title = T('a.renderSearchChips.5', { n: per.n, p2: (per.ms / 1000).toFixed(1) });
    else if (on && active && per.st === 'err') title = T('a.renderSearchChips.6', { msg: per.msg });
    return `<button type="button" class="gs-chip ${id}${on ? ' on' : ''}${avail ? '' : ' na'}" data-src="${id}" aria-pressed="${on}" title="${title}"><span>${name}</span>${tag}</button>`;
  }).join('');
  const notes = [];
  if (active) {
    for (const [id, name] of SEARCH_SRCS) {
      const per = searchSt.per[id] || {};
      if (per.st === 'err') notes.push(`${name}: ${per.msg}`);
      else if (searchOn[id] && !searchAvail(id)) notes.push(`${name}: ${id === 'sp' ? T('a.renderSearchChips.7') : T('a.renderSearchChips.8')}`);
    }
  }
  const box = $('gs-notes');
  box.hidden = !notes.length;
  box.textContent = notes.length ? '⚠ ' + notes.join(' · ') : '';
}
// ключ для объединения одинаковых треков: название без скобок, ремастеров и «Артист - …» плюс первый артист
function dupParts(t) {
  let title = String(t.title || '');
  const artist = norm(String(t.artist || '').split(/,|&|\bfeat\b|\bft\b/i)[0]);
  const m = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m) {
    const a = norm(m[1]), b = norm(m[2]);
    if (a && artist && (a.includes(artist) || artist.includes(a))) title = m[2];
    else if (b && artist && b.includes(artist)) title = m[1];
    else title = title.replace(/\s+[-–—]\s+(remaster(ed)?|.*\b(version|edit|mix)\b|live\b|mono|stereo).*$/i, '');
  }
  const key = norm(title).replace(/\b(official|video|audio|lyrics?|hd|hq|explicit|remaster(ed)?)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return [key, artist];
}
const artistsOverlap = (a, b) => {
  if (!a || !b) return true;
  const x = a.replace(/ /g, ''), y = b.replace(/ /g, '');
  return x.includes(y) || y.includes(x);
};
const durOk = (a, b) => !a || !b || Math.abs(a - b) <= 8000;
const PLAY_RANK = { local: 0, sp: 1, yt: 2, sc: 3 };      // из какого источника играть дубль
const META_RANK = { sp: 0, local: 1, sc: 2, yt: 3 };      // чьё название и обложку показывать
function searchPlayable(t) {
  if (t.src === 'local') return true;
  if (t.src === 'sp') return !!LS.get('sp_token') && spPremium !== false;
  return searchUsable(t.src);
}
function searchMergeNow() {
  const words = norm(state.query).split(' ').filter(Boolean);
  const lib = state.all.filter((t) => (t.src === 'local' || searchUsable(t.src)) && words.every((w) => (t._k || (t._k = norm(t.title + ' ' + t.artist))).includes(w)));
  const lists = [{ w: 1.5, items: lib.slice(0, 80) }];
  for (const [id] of SEARCH_SRCS) if (searchUsable(id)) lists.push({ w: 1, items: searchSt.remote[id] || [] });
  const groups = [], byId = new Map();
  for (const L of lists) {
    L.items.forEach((t, rank) => {
      const score = L.w / (15 + rank);
      const same = byId.get(t.src + ':' + t.id);
      if (same) { same.score += score; return; }
      const [title, artist] = dupParts(t);
      let g = title ? groups.find((x) => x.title === title && artistsOverlap(x.artist, artist) && durOk(x.dur, t.duration) && !x.members.some((m) => m.src === t.src)) : null;
      if (!g) { g = { title, artist, dur: t.duration || 0, score: 0, members: [] }; groups.push(g); }
      g.members.push(t);
      g.score += score;
      if (!g.dur && t.duration) g.dur = t.duration;
      byId.set(t.src + ':' + t.id, g);
    });
  }
  const playRank = (t) => (searchPlayable(t) ? 0 : 10) + PLAY_RANK[t.src];
  searchSt.items = groups.sort((a, b) => b.score - a.score).map((g) => {
    const mem = g.members.slice().sort((a, b) => playRank(a) - playRank(b));
    const p = mem[0];
    const metas = g.members.slice().sort((a, b) => META_RANK[a.src] - META_RANK[b.src]);
    const meta = metas[0];
    const pickImg = (k) => (metas.find((m) => m[k]) || {})[k] || '';   // обложка из любого источника, где она есть
    return Object.assign({}, p, {
      title: meta.title, artist: meta.artist, album: meta.album || p.album,
      cover: pickImg('cover'), art: pickImg('art'), big: pickImg('big'),
      alts: mem.slice(1).filter(searchPlayable),
      _srcs: mem.map((m) => m.src),
      _dim: mem.filter((m) => !searchPlayable(m)).map((m) => m.src),
    });
  });
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
    if (!out.length) state.recsError = T('a.loadRecs.1');
    LS.set('recs', JSON.stringify({ at: state.recsAt, tracks: out, seeds: state.recsSeeds }));
  } catch (e) {
    state.recsError = T('a.loadRecs.2') + e.message;
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
// после сбоя или правки руками в плейлистах могло оказаться что угодно: оставляем только годное, чтобы список не ломал отрисовку
playlists = playlists.filter((p) => p && typeof p === 'object' && p.id != null && Array.isArray(p.tracks)).map((p) => ({
  ...p, id: String(p.id), name: String(p.name == null ? T('a.top.1') : p.name).slice(0, 60) || T('a.top.2'),
  tracks: p.tracks.filter((t) => t && typeof t === 'object' && ['sp', 'sc', 'yt', 'local'].includes(t.src) && t.id != null).map((t) => ({ ...t, id: String(t.id), title: String(t.title == null ? T('a.top.3') : t.title) || T('a.top.4'), artist: String(t.artist == null ? '' : t.artist) })),
}));
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
  const name = await dialog({ title: T('a.plCreate.1'), value: '', ok: T('a.plCreate.2') });
  if (!name) return null;
  const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.slice(0, 60), tracks: [] };
  if (firstTrack) p.tracks.push(plSlim(firstTrack));
  playlists.push(p);
  savePlaylists();
  toast(firstTrack ? T('a.plCreate.3', { name: p.name }) : T('a.plCreate.4', { name: p.name }));
  return p;
}
function plAdd(p, t) {
  if (p.tracks.some((x) => x.src === t.src && x.id === t.id)) { toast(T('a.plAdd.1', { name: p.name })); return; }
  p.tracks.push(plSlim(t));
  savePlaylists();
  toast(T('a.plAdd.2', { name: p.name }));
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
  const name = await dialog({ title: T('a.plRename.1'), value: p.name, ok: T('a.plRename.2') });
  if (!name) return;
  p.name = name.slice(0, 60);
  savePlaylists();
  renderHead();
}
async function plDelete(p) {
  const ok = await dialog({ title: T('a.plDelete.1', { name: p.name }), text: T('a.plDelete.2'), ok: T('a.plDelete.3'), danger: true });
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
    if (state.radio.seed === seed) toast(T('a.startRadio.1') + e.message);
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
  add(T('a.openTrackMenu.1'), ICONS.radio, () => startRadio(t));
  if (state.cur && state.queue.length) add(T('a.openTrackMenu.2'), ICONS.queue, () => {
    state.queue.push(t);
    state.order.splice(state.pos + 1, 0, state.queue.length - 1);
    toast(T('a.openTrackMenu.3'));
    renderQueue();
  });
  add(T('a.openTrackMenu.4'), ICONS.queue, () => {
    if (!state.queue.length) { playFrom([t], 0); return; }
    state.queue.push(t);
    state.order.push(state.queue.length - 1);
    toast(T('a.openTrackMenu.5'));
    renderQueue();
  });
  items.push({ sep: true }, { head: T('a.openTrackMenu.6') });
  for (const p of playlists) add(p.name, ICONS.list, () => plAdd(p, t));
  add(T('a.openTrackMenu.7'), ICONS.plus, () => plCreate(t));
  const pl = curPl();
  if (pl) { items.push({ sep: true }); add(T('a.openTrackMenu.8'), ICONS.minus, () => plRemove(pl, t), 'danger'); }
  const ext = t.src === 'sp' ? `https://open.spotify.com/track/${t.id}` : t.url;
  if (ext && /^https?:/.test(ext)) { items.push({ sep: true }); add(t.src === 'sp' ? T('a.openTrackMenu.9') : t.src === 'yt' ? T('a.openTrackMenu.10') : T('a.openTrackMenu.11'), ICONS.link, () => window.open(ext, '_blank')); }

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
    throw new Error(T('a.localPlay.1'));
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
    d.innerHTML = T('a.renderFolders.1', { x: ICONS.x });
    d.querySelector('span').textContent = f;
    d.querySelector('span').title = f;
    d.querySelector('button').addEventListener('click', () => localCmd('remove', { path: f }));
    box.appendChild(d);
  }
  const n = state.lib.local.length;
  $('lc-state').textContent = state.localFolders.length ? `${n} ${plural(n, trackForms())}` : T('a.renderFolders.2');
  $('lc-state').className = 'state' + (n ? ' ok' : '');
}
async function localCmd(name, body) {
  $('lc-state').textContent = T('a.localCmd.1');
  try {
    const r = await fetch('/api/app/local/' + name, { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || T('a.localCmd.2'));
    applyLocal(j);
    if (name !== 'remove' && j.tracks) toast(T('a.localCmd.3', { length: j.tracks.length, p2: plural(j.tracks.length, trackForms()) }));
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
  catch { box.innerHTML = T('a.renderStats.1'); return; }
  if (state.view !== 'stats') return;
  const min = Math.round(st.totalMs / 60000);
  const seg = `<div class="seg" id="st-range">${[['week', T('a.renderStats.2')], ['month', T('a.renderStats.3')], ['all', T('a.renderStats.4')]].map(([k, l]) => `<button data-r="${k}" class="${k === range ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (!st.plays) {
    box.innerHTML = seg + emptyCard(ICONS.chart, T('a.renderStats.5'), T('a.renderStats.6'));
    bindStats();
    return;
  }
  const maxDay = Math.max(1, ...st.chart.map((d) => d.ms));
  const step = st.chart.length > 10 ? 5 : 1;
  const bars = st.chart.map((d, i) => {
    const [, mm, dd] = d.day.split('-');
    const h = Math.round((d.ms / maxDay) * 100);
    const label = i % step === 0 || i === st.chart.length - 1 ? `<small>${dd}.${mm}</small>` : '';
    return T('a.renderStats.7', { p1: d.ms ? '' : ' zero', dd: dd, mm: mm, p4: Math.round(d.ms / 60000), p5: Math.max(h, 2), label: label });
  }).join('');
  const srcTotal = Math.max(1, st.sources.sp + st.sources.sc + st.sources.local + (st.sources.yt || 0));
  const srcs = [['sp', 'Spotify', '#1ed760'], ['sc', 'SoundCloud', '#ff7700'], ['yt', 'YouTube Music', '#ff2d2d'], ['local', T('a.renderStats.8'), '#8e8e93']].filter(([k]) => st.sources[k] > 0);
  const maxArt = Math.max(1, ...st.topArtists.map((a) => a.count));
  box.innerHTML = seg + T('a.renderStats.22', { p1: min >= 600 ? Math.round(min / 60) + T('a.renderStats.9') : min + T('a.renderStats.10'), plays: st.plays, p3: plural(st.plays, [T('a.renderStats.11'), T('a.renderStats.12'), T('a.renderStats.13')]), uniqueTracks: st.uniqueTracks, p5: plural(st.uniqueTracks, [T('a.renderStats.14'), T('a.renderStats.15'), T('a.renderStats.16')]), uniqueArtists: st.uniqueArtists, p7: plural(st.uniqueArtists, [T('a.renderStats.17'), T('a.renderStats.18'), T('a.renderStats.19')]), bars: bars, p9: srcs.map(([k, , c]) => `<i style="width:${(st.sources[k] / srcTotal) * 100}%;background:${c}"></i>`).join(''), p10: srcs.map(([k, l, c]) => `<span style="--c:${c}">${l} · ${Math.round((st.sources[k] / srcTotal) * 100)}%</span>`).join('') });
  const tl = $('st-tracks');
  st.topTracks.forEach((x, i) => {
    const t = hydrateLocal({ ...x.t });
    const d = document.createElement('div');
    d.className = 'st-item';
    d.innerHTML = `<span class="r">${i + 1}</span><img alt=""><div><b></b><small></small></div><span class="c">${x.count} ×</span>`;
    d.querySelector('img').src = t.cover || NO_COVER;
    d.querySelector('b').textContent = t.title;
    d.querySelector('small').textContent = t.artist;
    d.title = T('a.renderStats.20');
    d.addEventListener('click', () => playFrom(st.topTracks.map((y) => hydrateLocal({ ...y.t })), i, 'list'));
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); openTrackMenu(t, -1, e.clientX, e.clientY); });
    tl.appendChild(d);
  });
  const al = $('st-artists');
  st.topArtists.forEach((a, i) => {
    const d = document.createElement('div');
    d.className = 'st-item art';
    d.innerHTML = T('a.renderStats.21', { p1: i + 1, p2: (a.count / maxArt) * 100, count: a.count, p4: Math.round(a.ms / 60000) });
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
  $('dc-state').textContent = r.on ? r.status : T('a.showDiscord.1');
  $('dc-state').className = 'state' + (r.on && /подключено/.test(r.status) ? ' ok' : r.on && /отказал|нужен|не запущен/.test(r.status) ? ' err' : '');
}
async function saveDiscord() {
  const id = $('dc-id').value.trim();
  const on = $('dc-on').checked;
  if (on && !/^\d{15,25}$/.test(id)) { $('dc-state').textContent = T('a.saveDiscord.1'); $('dc-state').className = 'state err'; return; }
  $('dc-state').textContent = T('a.saveDiscord.2');
  try {
    const r = await fetch('/api/app/discord', { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ on, id }) }).then((x) => x.json());
    showDiscord(r);
    setTimeout(loadDiscord, 2500);
    publishState(true);
  } catch { $('dc-state').textContent = T('a.saveDiscord.3'); }
}
$('dc-save').addEventListener('click', saveDiscord);
$('dc-on').addEventListener('change', saveDiscord);

/* ===================== Настройки ===================== */
function openSettings(tab = 'look') { $('settings').hidden = false; setTab(tab); syncSettingsUI(); syncAccounts(); }
function closeSettings() { $('settings').hidden = true; }
function setTab(tab) {
  if (tab === 'keys') { renderKeys(); renderMediaKeysStatus(); }
  if (tab === 'backup') backupRefresh();
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
      Object.assign(ui.look, { bg: null, text: null, prevWall: null });   // цвета темы вместо своих
      saveUI(); applyUI();
    });
    pBox.appendChild(b);
  }

  const aBox = $('accents');
  aBox.innerHTML = '';
  for (const [name, c] of ACCENTS) {
    const b = document.createElement('button');
    b.className = 'sw';
    b.title = lbl(name);
    b.dataset.c = c;
    b.style.setProperty('--c', c);
    b.addEventListener('click', () => { ui.accent = c; ui.preset = null; saveUI(); applyUI(); });
    aBox.appendChild(b);
  }
  const custom = document.createElement('label');
  custom.className = 'sw sw-custom';
  custom.title = T('a.buildSettings.1');
  custom.innerHTML = '<input type="color" id="accent-custom">';
  aBox.appendChild(custom);
  $('accent-custom').addEventListener('input', (e) => { ui.accent = e.target.value.toUpperCase(); ui.preset = null; liveChange(); });
  $('accent-custom').addEventListener('change', liveEnd);

  buildWalls();

  // язык переключается сразу, без перезапуска: сохраняем выбор и сообщаем программе (трей, заголовки окон, ошибки сервера)
  const syncLangSeg = () => document.querySelectorAll('#lang-seg button').forEach((b) => b.classList.toggle('on', b.dataset.lang === I18N.lang));
  $('lang-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    I18N.setLanguage(b.dataset.lang);
    LS.set('lang', b.dataset.lang);   // явный выбор запоминаем, даже если язык и так совпал с языком системы
    appCmd('settings', { lang: b.dataset.lang });
  });
  document.addEventListener('langchange', syncLangSeg);
  syncLangSeg();
  $('mode-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ui.mode = b.dataset.mode; ui.preset = null; saveUI(); applyUI();
  });
  const bindRange = (id, key) => {
    const el = $(id);
    el.addEventListener('input', () => { ui[key] = Number(el.value); ui.preset = key === 'blur' ? ui.preset : null; setFill(el); liveChange({ blur: key === 'blur' }); });
    el.addEventListener('change', liveEnd);
  };
  bindRange('opt-alpha', 'alpha');
  bindRange('opt-blur', 'blur');
  $('opt-lite').addEventListener('change', (e) => { ui.lite = e.target.checked; saveUI(); applyUI(); });
  $('opt-compact').addEventListener('change', (e) => { ui.compact = e.target.checked; saveUI(); applyUI(); });
  $('opt-tray').addEventListener('change', (e) => { ui.tray = e.target.checked; saveUI(); appCmd('settings', { closeToTray: ui.tray }); });
  $('wall-file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) onWallFile(f); e.target.value = ''; });
  buildLook();
  buildKeys();
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
    else if (id === 'gradient') b.style.background = 'var(--wall-grad)';
    else if (id === 'cover') b.style.background = 'linear-gradient(135deg, #3a1c3f, #b33a5b 55%, #f0a35e)';
    else if (id === 'custom') {
      const img = LS.get('wallImg');
      if (img) b.style.backgroundImage = `url("${img}")`;
      else { b.style.background = 'var(--field)'; b.innerHTML = ICONS.image; }
    }
    b.insertAdjacentHTML('beforeend', `<span>${w.name}</span>`);
    b.addEventListener('click', () => {
      if (id === 'custom' && (!LS.get('wallImg') || ui.wall === 'custom')) { $('wall-file').click(); return; }
      setWall(id); ui.preset = null; saveUI(); applyUI();
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
    if (!LS.set('wallImg', url)) { toast(T('a.onWallFile.1')); return; }
    setWall('custom'); ui.preset = null; saveUI();
    lastWallBg = null;
    buildWalls(); applyUI();
  } catch { toast(T('a.onWallFile.2')); }
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

/* ---------- окно «Оформление» с живым предпросмотром ---------- */
function openLook() { closeSettings(); $('look').hidden = false; syncLookUI(); }
function closeLook() { $('look').hidden = true; openSettings('look'); }
const lookSave = () => { ui.preset = null; saveUI(); applyUI(); };
function buildLook() {
  const sel = $('lk-font');
  for (const [v, name] of FONTS) {
    const o = document.createElement('option');
    o.value = v; o.textContent = lbl(name);
    if (v) o.style.fontFamily = fontStack(v);
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => { ui.look.font = sel.value; lookSave(); });

  // цвета: input идёт на лету, change сохраняет в store.json
  const color = (id, get, put, reset) => {
    const el = $(id);
    el.addEventListener('input', () => { put(el.value.toLowerCase()); ui.preset = null; liveChange({ wall: id === 'lk-bg' }); });
    el.addEventListener('change', liveEnd);
    $(id + '-x').addEventListener('click', () => { reset(); lookSave(); });
  };
  color('lk-bg', () => ui.look.bg, (v) => {
    ui.look.bg = v;
    // свой цвет виден только на однотонном фоне, поэтому переключаем и запоминаем прежний
    if (ui.wall !== 'plain') { ui.look.prevWall = ui.wall; ui.wall = 'plain'; }
  }, () => {
    ui.look.bg = null;
    if (ui.look.prevWall && ui.wall === 'plain') ui.wall = ui.look.prevWall;
    ui.look.prevWall = null;
  });
  color('lk-accent', () => ui.accent, (v) => { ui.accent = v.toUpperCase(); }, () => { ui.accent = DEFAULT_UI.accent; });
  color('lk-text', () => ui.look.text, (v) => { ui.look.text = v; }, () => { ui.look.text = null; });

  const range = (id, get, put) => {
    const el = $(id);
    el.addEventListener('input', () => { put(Number(el.value)); ui.preset = null; setFill(el); lkReadout(id); liveChange({ blur: id === 'lk-blur' }); });
    el.addEventListener('change', liveEnd);
  };
  range('lk-rs', () => ui.look.rs, (v) => { ui.look.rs = v; });
  range('lk-blur', () => ui.blur, (v) => { ui.blur = v; });
  range('lk-alpha', () => ui.alpha, (v) => { ui.alpha = v; });
  range('lk-cover', () => ui.look.cover, (v) => { ui.look.cover = v; });

  buildBlocksDnD();
  buildGradEditor();
  buildThemes();
  $('lk-auto').addEventListener('change', (e) => { ui.look.auto = e.target.checked; ui.preset = null; saveUI(); autoCover(); applyUI(); });
  $('lk-side').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setLayout({ side: b.dataset.side }); });
  $('lk-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setLayoutMode(b.dataset.mode); });
  $('lk-mini').addEventListener('click', openMiniPlayer);

  $('lk-reset').addEventListener('click', () => {
    const wall = ui.look.prevWall;
    Object.assign(ui.look, DEFAULT_LOOK);
    Object.assign(ui.layout, DEFAULT_LAYOUT);
    ui.blocks = normalizeBlocks(null);
    autoToken++; cancelAnimationFrame(autoRaf); autoNow = null;
    if (wall && ui.wall === 'plain') ui.wall = wall;
    // свой градиент сбрасываем и возвращаем прежний фон из темы
    if (ui.wall === 'gradient') ui.wall = ui.wallPrev && !SPECIAL_WALLS.has(ui.wallPrev) && WALLS[ui.wallPrev] ? ui.wallPrev : DEFAULT_UI.wall;
    ui.grad = normalizeGrad(null); ui.wallPrev = null; gradSel = null;
    coverGradReset();
    lastWallBg = null;
    ui.blur = DEFAULT_UI.blur; ui.alpha = DEFAULT_UI.alpha; ui.accent = DEFAULT_UI.accent;
    lookSave();
    syncFullscreen();
  });
  $('open-look').addEventListener('click', openLook);
  $('close-look').addEventListener('click', closeLook);
  $('look').addEventListener('mousedown', (e) => { if (e.target === $('look')) closeLook(); });
}
/* ---------- редактор градиента фона ---------- */
let gradSel = null;          // выбранная точка (объект из ui.grad.stops)
let gradBarDirty = false;    // полосу и ручки нужно обновить в ближайшем кадре
let gradDrag = null;
const gradClone = (g) => ({ type: g.type, angle: g.angle, stops: g.stops.map((s) => ({ ...s })) });
const gradSort = () => ui.grad.stops.sort((a, b) => a.p - b.p);
// цвет между двумя точками: новая точка на полосе сразу получает цвет, который там уже виден
function gradColorAt(p) {
  const s = ui.grad.stops;
  if (p <= s[0].p) return s[0].c;
  if (p >= s[s.length - 1].p) return s[s.length - 1].c;
  for (let i = 0; i < s.length - 1; i++) if (p >= s[i].p && p <= s[i + 1].p) {
    const span = s[i + 1].p - s[i].p || 1;
    return mixHex(s[i].c, s[i + 1].c, (p - s[i].p) / span);
  }
  return s[0].c;
}
function gradBarRefresh() {
  gradBarDirty = false;
  const bar = $('gr-bar');
  if (!bar) return;
  bar.style.background = gradCss(ui.grad, true);
  for (const h of bar.querySelectorAll('.gr-h')) {
    h.style.left = h._stop.p + '%';
    h.style.setProperty('--c', h._stop.c);
    h.classList.toggle('on', h._stop === gradSel);
  }
  const info = $('gr-info');
  if (gradActive()) {
    const a = gradAnalyze(effGradTarget(), userOpVal(), palettePanel());
    info.textContent = T('a.gradBarRefresh.4', { p1: a.mode === 'dark' ? T('a.gradBarRefresh.1') : T('a.gradBarRefresh.2'), p2: a.contrast.toFixed(1), p3: a.raised ? T('a.gradBarRefresh.3') : '' });
  } else info.textContent = '';
  info.hidden = !info.textContent;
  if (gradSel) {
    const col = $('gr-color'), pos = $('gr-pos');
    if (col.value !== gradSel.c) col.value = gradSel.c;
    if (document.activeElement !== pos && Number(pos.value) !== gradSel.p) pos.value = gradSel.p;
  }
}
// структура изменилась (добавили, удалили, пресет, тип): полная перерисовка редактора
function gradRender() {
  const g = ui.grad, bar = $('gr-bar');
  if (!gradSel || !g.stops.includes(gradSel)) gradSel = g.stops[0];
  bar.querySelectorAll('.gr-h').forEach((h) => h.remove());
  for (const s of g.stops) {
    const h = document.createElement('button');
    h.type = 'button';
    h.className = 'gr-h';
    h._stop = s;
    h.title = T('a.gradRender.1');
    bar.appendChild(h);
  }
  document.querySelectorAll('#gr-type button').forEach((b) => b.classList.toggle('on', b.dataset.t === g.type));
  $('gr-angle-row').hidden = g.type === 'radial';
  $('gr-angle').value = g.angle; setFill($('gr-angle'));
  $('gr-angle-v').textContent = g.type === 'conic' ? T('a.gradRender.2', { angle: g.angle }) : `${g.angle}°`;
  $('gr-add').disabled = g.stops.length >= GRAD_MAX_STOPS;
  $('gr-del').disabled = g.stops.length <= GRAD_MIN_STOPS;
  gradBarRefresh();
}
// после изменения структуры: фон применяется сразу, на диск пишем один раз
function gradCommit() {
  ui.preset = null;
  if (ui.wall !== 'gradient') setWall('gradient');
  clearTimeout(liveIdle);
  document.documentElement.classList.remove('lk-drag', 'lk-drag-blur');
  applyUI();
  saveUI();
}
// движение точки, цвета или угла: только CSS-переменная и полоса, диск после паузы
function gradLive() {
  ui.preset = null;
  if (ui.wall !== 'gradient') { setWall('gradient'); liveWall = true; }
  gradBarDirty = true;
  liveChange({ wall: false });
}
function gradAddAt(p) {
  const g = ui.grad;
  if (g.stops.length >= GRAD_MAX_STOPS) { toast(T('a.gradAddAt.1')); return null; }
  const s = { c: gradColorAt(p), p: Math.round(p) };
  g.stops.push(s);
  gradSort();
  gradSel = s;
  return s;
}
function gradRandom() {
  const g = ui.grad, n = Math.min(GRAD_MAX_STOPS, Math.max(2, g.stops.length));
  const h0 = Math.random() * 360, spread = 30 + Math.random() * 90, dark = Math.random() < 0.6;
  const stops = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const l = dark ? 0.16 + t * 0.4 + Math.random() * 0.06 : 0.62 + t * 0.2 + Math.random() * 0.06;
    stops.push({ c: hslToHex((h0 + t * spread + Math.random() * 12) % 360, 0.5 + Math.random() * 0.35, Math.min(0.9, l)), p: Math.round(t * 100) });
  }
  ui.grad = { type: g.type, angle: Math.round(Math.random() * 360), stops };
  gradSel = null;
}
function buildGradEditor() {
  const box = $('gr-presets');
  for (const p of GRAD_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gr-preset';
    b.title = p.name;
    b.style.background = gradCss(gradFromPreset(p));
    b.innerHTML = `<span>${p.name}</span>`;
    b.addEventListener('click', () => { ui.grad = gradFromPreset(p); gradSel = null; gradRender(); gradCommit(); });
    box.appendChild(b);
  }
  $('lk-wallmode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const m = b.dataset.wm;
    if (m === 'theme') ui.wall = ui.wallPrev && !SPECIAL_WALLS.has(ui.wallPrev) && WALLS[ui.wallPrev] ? ui.wallPrev : DEFAULT_UI.wall;
    else if (m === 'custom' && !LS.get('wallImg')) { $('wall-file').click(); return; }
    else setWall(m);
    ui.preset = null; lastWallBg = null; saveUI(); applyUI();
  });
  $('gr-type').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ui.grad.type = b.dataset.t;
    gradRender(); gradCommit();
  });
  $('gr-cover').addEventListener('change', (e) => {
    ui.gradCover = e.target.checked;
    ui.preset = null;
    if (ui.gradCover && ui.wall !== 'gradient') setWall('gradient');
    lastWallBg = null;
    saveUI(); autoCover(); applyUI();
  });
  $('gr-angle').addEventListener('input', (e) => { ui.grad.angle = Number(e.target.value); setFill(e.target); $('gr-angle-v').textContent = ui.grad.type === 'conic' ? T('a.on_grangle_input.1', { angle: ui.grad.angle }) : `${ui.grad.angle}°`; gradLive(); });
  $('gr-angle').addEventListener('change', liveEnd);
  $('gr-color').addEventListener('input', (e) => { if (gradSel) { gradSel.c = e.target.value.toLowerCase(); gradLive(); } });
  $('gr-color').addEventListener('change', liveEnd);
  $('gr-pos').addEventListener('input', (e) => {
    if (!gradSel || e.target.value === '') return;
    gradSel.p = Math.min(100, Math.max(0, Math.round(Number(e.target.value))));
    gradSort(); gradLive();
  });
  $('gr-pos').addEventListener('change', liveEnd);
  $('gr-add').addEventListener('click', () => {
    const s = ui.grad.stops;
    let at = 50, best = -1;   // середина самого большого промежутка
    for (let i = 0; i < s.length - 1; i++) if (s[i + 1].p - s[i].p > best) { best = s[i + 1].p - s[i].p; at = (s[i].p + s[i + 1].p) / 2; }
    if (gradAddAt(at)) { gradRender(); gradCommit(); }
  });
  $('gr-del').addEventListener('click', () => gradDelete(gradSel));
  $('gr-flip').addEventListener('click', () => {
    ui.grad.stops = ui.grad.stops.map((s) => ({ c: s.c, p: 100 - s.p }));
    gradSort(); gradRender(); gradCommit();
  });
  $('gr-rand').addEventListener('click', () => { gradRandom(); gradRender(); gradCommit(); });

  // ручки на полосе: тянем мышью, клик по пустому месту добавляет точку
  const bar = $('gr-bar');
  const posOf = (e) => { const r = bar.getBoundingClientRect(); return Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)); };
  bar.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.gr-h');
    let stop = h && h._stop;
    if (!stop) { stop = gradAddAt(posOf(e)); if (!stop) return; gradRender(); }
    gradSel = stop;
    gradDrag = stop;
    try { bar.setPointerCapture(e.pointerId); } catch {}
    gradBarDirty = true;
    gradBarRefresh();
    e.preventDefault();
  });
  bar.addEventListener('pointermove', (e) => {
    if (!gradDrag) return;
    gradDrag.p = Math.round(posOf(e));
    gradSort();
    gradLive();
  });
  const stopDrag = () => { if (!gradDrag) return; gradDrag = null; liveEnd(); gradRender(); };
  bar.addEventListener('pointerup', stopDrag);
  bar.addEventListener('pointercancel', stopDrag);
  bar.addEventListener('dblclick', (e) => { const h = e.target.closest('.gr-h'); if (h) gradDelete(h._stop); });
}
function gradDelete(stop) {
  const g = ui.grad;
  if (!stop || g.stops.length <= GRAD_MIN_STOPS) { toast(T('a.gradDelete.1')); return; }
  g.stops = g.stops.filter((s) => s !== stop);
  gradSel = null;
  gradRender(); gradCommit();
}
function syncGradUI() {
  const mode = ui.wall === 'plain' ? 'plain' : ui.wall === 'custom' ? 'custom' : ui.wall === 'gradient' ? 'gradient' : 'theme';
  document.querySelectorAll('#lk-wallmode button').forEach((b) => b.classList.toggle('on', b.dataset.wm === mode));
  $('lk-grad').hidden = ui.wall !== 'gradient';
  $('gr-cover').checked = !!ui.gradCover;
  $('lk-grad').classList.toggle('cover-on', !!ui.gradCover);
  const sw = $('gr-cover-sw');
  sw.hidden = !ui.gradCover;
  if (ui.gradCover) [...sw.children].forEach((el, i) => { el.style.background = coverNow ? coverNow[i] : 'var(--field)'; });
  if (ui.wall === 'gradient' && !gradDrag) gradRender();
}

/* ---------- темы: сохранение, экспорт, импорт ---------- */
const THEME_FORMAT = 'sonara-theme';
const THEME_FILE_MAX = 200000;
const THEMES_MAX = 40;
const isNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const hexOrNull = (v) => v === null || (typeof v === 'string' && HEX_RE.test(v));
// проверка настроек темы: только известные поля с допустимыми значениями; возвращает { theme } или { error }
function validateTheme(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { error: T('a.validateTheme.1') };
  const out = {};
  const only = (obj, keys, where) => {
    for (const k of Object.keys(obj)) if (!keys.includes(k)) return T('a.only.1', { where: where, k: k });
    return '';
  };
  let e = only(o, ['mode', 'accent', 'wall', 'alpha', 'blur', 'grad', 'gradCover', 'look', 'layout', 'blocks'], '');
  if (e) return { error: e };
  if ('mode' in o) { if (!['light', 'dark', 'auto'].includes(o.mode)) return { error: T('a.validateTheme.2') }; out.mode = o.mode; }
  if ('accent' in o) { if (typeof o.accent !== 'string' || !HEX_RE.test(o.accent)) return { error: T('a.validateTheme.3') }; out.accent = o.accent.toUpperCase(); }
  if ('wall' in o) { if (typeof o.wall !== 'string' || o.wall === 'custom' || !Object.prototype.hasOwnProperty.call(WALLS, o.wall)) return { error: T('a.validateTheme.4') }; out.wall = o.wall; }
  if ('alpha' in o) { if (!isNum(o.alpha, 0, 100)) return { error: T('a.validateTheme.5') }; out.alpha = Math.round(o.alpha); }
  if ('blur' in o) { if (!isNum(o.blur, 0, 80)) return { error: T('a.validateTheme.6') }; out.blur = Math.round(o.blur); }
  if ('grad' in o) {
    const v = validateGrad(o.grad);
    if (v.error) return { error: 'grad: ' + v.error };
    out.grad = v.grad;
  } else if (out.wall === 'gradient') out.grad = normalizeGrad(null);   // старая тема с градиентом без самих точек: берём градиент по умолчанию
  // в тему входит только переключатель, сами цвета берутся у играющего трека
  if ('gradCover' in o) { if (typeof o.gradCover !== 'boolean') return { error: T('a.validateTheme.7') }; out.gradCover = o.gradCover; }
  if ('look' in o) {
    const L = o.look;
    if (!L || typeof L !== 'object' || Array.isArray(L)) return { error: T('a.validateTheme.8') };
    e = only(L, ['bg', 'text', 'font', 'rs', 'cover', 'auto', 'css', 'cssOn'], 'look.');
    if (e) return { error: e };
    const l = {};
    for (const k of ['bg', 'text']) if (k in L) { if (!hexOrNull(L[k])) return { error: T('a.validateTheme.9', { k: k }) }; l[k] = L[k] && L[k].toLowerCase(); }
    if ('font' in L) { if (typeof L.font !== 'string' || !FONTS.some(([v]) => v === L.font)) return { error: T('a.validateTheme.10') }; l.font = L.font; }
    if ('rs' in L) { if (!isNum(L.rs, 0, 200)) return { error: T('a.validateTheme.11') }; l.rs = Math.round(L.rs); }
    if ('cover' in L) { if (!isNum(L.cover, 70, 160)) return { error: T('a.validateTheme.12') }; l.cover = Math.round(L.cover); }
    for (const k of ['auto', 'cssOn']) if (k in L) { if (typeof L[k] !== 'boolean') return { error: T('a.validateTheme.13', { k: k }) }; l[k] = L[k]; }
    if ('css' in L) {
      if (typeof L.css !== 'string') return { error: T('a.validateTheme.14') };
      const p = cssProblem(L.css) || (cssBalanced(L.css) ? '' : T('a.validateTheme.15'));
      if (p) return { error: 'look.css: ' + p };
      l.css = L.css;
    }
    out.look = l;
  }
  if ('layout' in o) {
    const Y = o.layout;
    if (!Y || typeof Y !== 'object' || Array.isArray(Y)) return { error: T('a.validateTheme.16') };
    e = only(Y, ['mode', 'side'], 'layout.');
    if (e) return { error: e };
    const y = {};
    if ('mode' in Y) { if (!['normal', 'compact'].includes(Y.mode)) return { error: T('a.validateTheme.17') }; y.mode = Y.mode; }
    if ('side' in Y) { if (!['left', 'right'].includes(Y.side)) return { error: T('a.validateTheme.18') }; y.side = Y.side; }
    out.layout = y;
  }
  if ('blocks' in o) {
    const B = o.blocks;
    if (!B || typeof B !== 'object' || Array.isArray(B)) return { error: T('a.validateTheme.19') };
    e = only(B, ['order', 'off'], 'blocks.');
    if (e) return { error: e };
    const sideIds = Object.keys(BLOCKS).filter((id) => BLOCKS[id].side);
    const ids = (arr, allowed, name) => {
      if (!Array.isArray(arr) || arr.length > 20 || arr.some((x) => typeof x !== 'string' || !allowed.includes(x))) return null;
      return arr;
    };
    const order = 'order' in B ? ids(B.order, sideIds, 'order') : [];
    const off = 'off' in B ? ids(B.off, Object.keys(BLOCKS), 'off') : [];
    if (!order || !off) return { error: T('a.validateTheme.20') };
    out.blocks = { order, off };
  }
  if (!Object.keys(out).length) return { error: T('a.validateTheme.21') };
  return { theme: out };
}
// градиент из файла: тип, угол 0..360, от 2 до 5 точек с hex-цветом и позицией 0..100, ничего другого
function validateGrad(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return { error: T('a.validateGrad.1') };
  for (const k of Object.keys(g)) if (!['type', 'angle', 'stops'].includes(k)) return { error: T('a.validateGrad.2', { k: k }) };
  if (!GRAD_TYPES.includes(g.type)) return { error: T('a.validateGrad.3') };
  if (!isNum(g.angle, 0, 360)) return { error: T('a.validateGrad.4') };
  if (!Array.isArray(g.stops) || g.stops.length < GRAD_MIN_STOPS || g.stops.length > GRAD_MAX_STOPS) return { error: T('a.validateGrad.5', { GRAD_MIN_STOPS: GRAD_MIN_STOPS, GRAD_MAX_STOPS: GRAD_MAX_STOPS }) };
  const stops = [];
  for (const s of g.stops) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { error: T('a.validateGrad.6') };
    for (const k of Object.keys(s)) if (k !== 'c' && k !== 'p') return { error: T('a.validateGrad.7', { k: k }) };
    if (typeof s.c !== 'string' || !HEX_RE.test(s.c)) return { error: T('a.validateGrad.8') };
    if (!isNum(s.p, 0, 100)) return { error: T('a.validateGrad.9') };
    stops.push({ c: s.c.toLowerCase(), p: Math.round(s.p) });
  }
  stops.sort((a, b) => a.p - b.p);
  return { grad: { type: g.type, angle: Math.round(g.angle), stops } };
}
function currentTheme() {
  const L = ui.look;
  return {
    mode: ui.mode,
    accent: HEX_RE.test(ui.accent) ? ui.accent.toUpperCase() : DEFAULT_UI.accent,
    wall: ui.wall === 'custom' ? 'mist' : ui.wall,   // свою картинку фона в тему не кладём
    alpha: ui.alpha,
    blur: ui.blur,
    grad: gradClone(ui.grad),
    gradCover: !!ui.gradCover,
    look: { bg: HEX_RE.test(L.bg || '') ? L.bg : null, text: HEX_RE.test(L.text || '') ? L.text : null, font: L.font, rs: L.rs, cover: L.cover, auto: !!L.auto, css: L.css || '', cssOn: L.cssOn !== false },
    layout: { mode: ui.layout.mode === 'full' ? 'normal' : ui.layout.mode, side: ui.layout.side },
    blocks: { order: ui.blocks.order.slice(), off: ui.blocks.off.slice() },
  };
}
function applyTheme(t) {
  if (t.mode) ui.mode = t.mode;
  if (t.accent) ui.accent = t.accent;
  if (t.grad) { ui.grad = normalizeGrad(t.grad); gradSel = null; }
  if ('gradCover' in t) ui.gradCover = t.gradCover;
  if (t.wall) setWall(t.wall);
  if (t.alpha != null) ui.alpha = t.alpha;
  if (t.blur != null) ui.blur = t.blur;
  if (t.look) Object.assign(ui.look, t.look);
  ui.look.prevWall = null;
  if (t.layout) Object.assign(ui.layout, t.layout);
  if (t.blocks) ui.blocks = normalizeBlocks(t.blocks);
  ui.preset = null;
  lastWallBg = null;
  saveUI(); applyUI(); syncFullscreen();
  autoCover();
  showCssRescue();
}
let themes = [];
function loadThemes() {
  const raw = LS.json('themes', []);
  themes = (Array.isArray(raw) ? raw : []).slice(0, THEMES_MAX).map((t) => {
    const v = t && typeof t.id === 'string' && typeof t.name === 'string' ? validateTheme(t.theme) : null;
    return v && v.theme ? { id: t.id, name: t.name.slice(0, 60), theme: v.theme, at: Number(t.at) || 0 } : null;
  }).filter(Boolean);
}
const saveThemes = () => { LS.set('themes', JSON.stringify(themes)); renderThemes(); };
function uniqueThemeName(name) {
  const base = String(name || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 40) || T('a.uniqueThemeName.1');
  let n = base, i = 2;
  while (themes.some((t) => t.name.toLowerCase() === n.toLowerCase())) n = `${base} (${i++})`;
  return n;
}
function addTheme(name, theme) {
  const t = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: uniqueThemeName(name), theme, at: Date.now() };
  themes.unshift(t);
  if (themes.length > THEMES_MAX) themes.length = THEMES_MAX;
  saveThemes();
  return t;
}
function themeMsg(text, bad) {
  const el = $('lk-th-msg');
  el.textContent = text || '';
  el.hidden = !text;
  el.classList.toggle('bad', !!bad);
}
const TH_ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
};
function renderThemes() {
  const box = $('lk-themes');
  if (!box) return;
  const cur = JSON.stringify(currentTheme());
  box.replaceChildren(...themes.map((t) => {
    const d = document.createElement('div');
    d.className = 'lk-th' + (JSON.stringify(t.theme) === cur ? ' on' : '');
    d.dataset.id = t.id;
    d.innerHTML = T('a.renderThemes.1');
    d.querySelector('.lk-th-dot').style.background = t.theme.wall === 'gradient' && t.theme.grad ? gradCss(t.theme.grad) : t.theme.accent || 'var(--accent)';
    d.querySelector('.lk-th-name').textContent = t.name;
    d.querySelector('[data-act="rename"]').innerHTML = TH_ICONS.edit;
    d.querySelector('[data-act="export"]').innerHTML = TH_ICONS.out;
    d.querySelector('[data-act="delete"]').innerHTML = TH_ICONS.del;
    return d;
  }));
  $('lk-th-empty').hidden = themes.length > 0;
}
async function exportTheme(name, theme) {
  const json = JSON.stringify({ format: THEME_FORMAT, version: 1, name, theme }, null, 2);
  try {
    const r = await api('/api/app/theme/export', { method: 'POST', headers: { 'X-Player': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ name, json }) });
    themeMsg(T('a.exportTheme.1') + r.path, false);
    toast(T('a.exportTheme.2'), 5000);
  } catch (e) { themeMsg(T('a.exportTheme.3') + e.message, true); }
}
// файл темы: { format, version, name, theme }, ничего лишнего
function parseThemeFile(text) {
  if (text.length > THEME_FILE_MAX) return { error: T('a.parseThemeFile.1') };
  let doc;
  try { doc = JSON.parse(text.replace(/^﻿/, '')); } catch { return { error: T('a.parseThemeFile.2') }; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { error: T('a.parseThemeFile.3') };
  if (doc.format !== THEME_FORMAT) return { error: T('a.parseThemeFile.4') };
  if (doc.version !== 1) return { error: T('a.parseThemeFile.5') };
  for (const k of Object.keys(doc)) if (!['format', 'version', 'name', 'theme'].includes(k)) return { error: T('a.parseThemeFile.6', { k: k }) };
  if (typeof doc.name !== 'string' || !doc.name.trim() || doc.name.length > 80) return { error: T('a.parseThemeFile.7') };
  const v = validateTheme(doc.theme);
  if (v.error) return { error: v.error };
  return { name: doc.name, theme: v.theme };
}
async function importThemeFile(file) {
  themeMsg('');
  const res = parseThemeFile(await file.text());
  if (res.error) { themeMsg(T('a.importThemeFile.1') + res.error, true); toast(T('a.importThemeFile.2')); return; }
  // перед чужой темой сохраняем текущее оформление, чтобы можно было вернуться
  const prevNames = [T('a.importThemeFile.3', null, 'ru'), T('a.importThemeFile.3', null, 'en')];
  themes = themes.filter((t) => !prevNames.includes(t.name));
  addTheme(T('a.importThemeFile.3'), currentTheme());
  const t = addTheme(res.name, res.theme);
  applyTheme(t.theme);
  themeMsg(T('a.importThemeFile.4', { name: t.name }), false);
}
function buildThemes() {
  loadThemes();
  renderThemes();
  $('lk-th-save').addEventListener('click', () => {
    const input = $('lk-th-name');
    const t = addTheme(input.value || T('a.on_lkthsave_click.1', { p1: themes.length + 1 }), currentTheme());
    input.value = '';
    themeMsg(T('a.on_lkthsave_click.2', { name: t.name }), false);
  });
  $('lk-th-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lk-th-save').click(); });
  $('lk-th-import').addEventListener('click', () => $('lk-th-file').click());
  $('lk-th-file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importThemeFile(f); });
  $('lk-th-current').addEventListener('click', () => exportTheme(T('a.on_lkthcurrent_click.1'), currentTheme()));
  $('lk-themes').addEventListener('click', async (e) => {
    const row = e.target.closest('.lk-th');
    if (!row) return;
    const t = themes.find((x) => x.id === row.dataset.id);
    if (!t) return;
    const act = e.target.closest('[data-act]');
    if (!act) { if (e.target.closest('.lk-th-name') || e.target.closest('.lk-th-dot')) { applyTheme(t.theme); themeMsg(T('a.on_lkthemes_click.1', { name: t.name }), false); } return; }
    if (act.dataset.act === 'export') exportTheme(t.name, t.theme);
    else if (act.dataset.act === 'rename') {
      const name = await dialog({ title: T('a.on_lkthemes_click.2'), value: t.name, ok: T('a.on_lkthemes_click.3') });
      if (name) {
        const others = themes.filter((x) => x !== t);
        const all = themes;
        themes = others;               // имя считаем уникальным среди остальных, а не против самой себя
        t.name = uniqueThemeName(name);
        themes = all;
        saveThemes();
      }
    } else if (act.dataset.act === 'delete') {
      if (await dialog({ title: T('a.on_lkthemes_click.4', { name: t.name }), text: T('a.on_lkthemes_click.5'), ok: T('a.on_lkthemes_click.6'), danger: true })) { themes = themes.filter((x) => x.id !== t.id); saveThemes(); }
    }
  });

  // свой CSS
  const area = $('lk-css');
  let cssTimer = 0;
  area.addEventListener('input', () => {
    clearTimeout(cssTimer);
    cssTimer = setTimeout(() => {
      const css = area.value;
      const bad = cssProblem(css);
      if (bad) { cssMsg(bad + T('a.on_area_input.1'), true); return; }
      ui.look.css = css;
      if (css && ui.look.cssOn === false) ui.look.cssOn = true;
      saveUI(); applyUI();
      cssMsg(css ? (cssBalanced(css) ? T('a.on_area_input.2') : T('a.on_area_input.3')) : '', false);
      showCssRescue();
    }, 150);
  });
  $('lk-css-on').addEventListener('change', (e) => { ui.look.cssOn = e.target.checked; saveUI(); applyUI(); showCssRescue(); });
  $('lk-css-reset').addEventListener('click', () => { ui.look.css = ''; ui.look.cssOn = true; area.value = ''; saveUI(); applyUI(); cssMsg(T('a.on_lkcssreset_click.1'), false); showCssRescue(); });
}
function cssMsg(text, bad) {
  const el = $('lk-css-msg');
  el.textContent = text || '';
  el.hidden = !text;
  el.classList.toggle('bad', !!bad);
}
function syncThemesUI() {
  renderThemes();
  const area = $('lk-css');
  if (document.activeElement !== area && area.value !== (ui.look.css || '')) area.value = ui.look.css || '';
  $('lk-css-on').checked = ui.look.cssOn !== false;
  const safe = !!window.__safeCss;
  $('lk-css-on').disabled = safe;
  $('lk-css-safe').hidden = !safe;
}

/* ---------- блоки ---------- */
const blockOn = (id) => !ui.blocks.off.includes(id);
function applyBlocks() {
  const r = document.documentElement, B = ui.blocks;
  for (const id of Object.keys(BLOCKS)) r.setAttribute('data-b-' + id, blockOn(id) ? '1' : '0');
  // порядок: блоки сайдбара идут по списку, бренд первый, настройки последние;
  // распорка стоит перед последним включённым блоком, поэтому он прижат к низу
  const setOrder = (el, n) => { if (el) el.style.order = n; };
  setOrder(document.querySelector('.sidebar .brand'), 0);
  setOrder($('open-settings'), 1000);
  let last = -1;
  B.order.forEach((id, i) => { if (blockOn(id)) last = i; });
  B.order.forEach((id, i) => {
    setOrder(document.querySelector(BLOCKS[id].sel), (i + 1) * 10);
    setOrder(document.querySelector('.lk-b-' + id), (i + 1) * 10);
  });
  setOrder($('side-spacer'), (last + 1) * 10 - 5);
  setOrder(document.querySelector('.lk-spacer'), (last + 1) * 10 - 5);
  qSig = ''; lycSig = '';
  renderQueue();
  lycKick();
}
// очередь: следующие треки из state.order, клик по строке запускает трек
function renderQueue() {
  const box = $('queue-list');
  if (!box || !blockOn('queue')) return;
  const items = [];
  for (let i = state.pos + 1; i < state.order.length && items.length < 12; i++) {
    const t = state.queue[state.order[i]];
    if (t) items.push([i, t]);
  }
  const sig = state.pos + '|' + state.queue.length + '|' + items.map(([i, t]) => i + ':' + t.src + t.id).join();
  if (sig === qSig) return;
  qSig = sig;
  box.innerHTML = items.length ? items.map(([i, t]) => {
    const art = t.art || t.cover || '';
    return `<button class="q-row" data-i="${i}" title="${escapeHtml(t.title)}">${art ? `<img class="q-cv" alt="" loading="lazy" src="${escapeHtml(art)}">` : '<span class="q-cv"></span>'}<span class="q-tx"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.artist || '')}</small></span></button>`;
  }).join('') : `<div class="q-empty">${state.cur ? T('a.renderQueue.1') : T('a.renderQueue.2')}</div>`;
}
$('queue-list').addEventListener('click', (e) => {
  const b = e.target.closest('.q-row');
  if (!b) return;
  const i = Number(b.dataset.i);
  if (i > state.pos && i < state.order.length) { state.pos = i; playTrack(state.queue[state.order[i]]); }
});
// текст в сайдбаре: предыдущая, текущая и следующая строки; сам текст грузит та же логика, что и у большого окна
function lycRender() {
  const t = state.cur;
  let p = '', c = '', n = '';
  if (!t) c = T('a.lycRender.1');
  else if (lyr.key !== lyKeyOf(t) || lyr.status === 'loading' || lyr.status === 'idle') c = T('a.lycRender.2');
  else if (lyr.status === 'synced') {
    const L = lyr.lines, now = lyNow() + 200;
    let lo = 0, hi = L.length - 1, idx = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m].t <= now) { idx = m; lo = m + 1; } else hi = m - 1; }
    p = idx > 0 ? L[idx - 1].text : '';
    c = idx >= 0 ? L[idx].text || '• • •' : '♪';
    n = L[idx + 1] ? L[idx + 1].text : '';
  } else if (lyr.status === 'plain') {
    const lines = lyr.plain.split(/\r?\n/).filter((s) => s.trim() && !/^\s*\[.+\]\s*$/.test(s));
    c = lines[0] || ''; n = lines[1] || '';
  } else c = lyr.status === 'instrumental' ? T('a.lycRender.3') : T('a.lycRender.4');
  const sig = p + '\n' + c + '\n' + n;
  if (sig === lycSig) return;
  lycSig = sig;
  $('lyc-p').textContent = p; $('lyc-c').textContent = c; $('lyc-n').textContent = n;
}
function lycTick() {
  lycTimer = 0;
  if (!blockOn('lyrics')) return;
  if ($('blk-lyrics').offsetParent && !document.hidden) {
    const t = state.cur;
    if (t && !lyOpen && lyr.key !== lyKeyOf(t)) lyLoad(t);
    lycRender();
  }
  lycTimer = setTimeout(lycTick, 400);
}
function lycKick() {
  clearTimeout(lycTimer);
  lycTimer = 0;
  if (blockOn('lyrics')) lycTimer = setTimeout(lycTick, 0);
}
$('blk-lyrics').addEventListener('click', () => setLyrics(true));

// окно: список блоков с переключателями и перетаскиванием
function blockRow(id) {
  const def = BLOCKS[id];
  const d = document.createElement('div');
  d.className = 'lk-blk';
  d.dataset.id = id;
  d.innerHTML = `<span class="lk-grip" title="${def.side ? T('a.blockRow.1') : ''}">${def.side ? '⋮⋮' : ''}</span><span class="lk-bn">${def.name}<small>${def.desc}</small></span><label class="switch"><input type="checkbox" aria-label="${def.name}"><span></span></label>`;
  const cb = d.querySelector('input');
  cb.checked = blockOn(id);
  cb.disabled = !!def.locked;
  cb.addEventListener('change', () => {
    const off = ui.blocks.off.filter((x) => x !== id);
    if (!cb.checked) off.push(id);
    ui.blocks.off = off;
    saveUI(); applyUI();
  });
  if (def.side) {
    d.draggable = true;
    d.tabIndex = 0;
    d.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const o = ui.blocks.order.slice(), i = o.indexOf(id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j < 0 || j >= o.length) return;
      [o[i], o[j]] = [o[j], o[i]];
      ui.blocks.order = o;
      saveUI(); applyUI();
      const again = $('lk-blocks').querySelector(`[data-id="${id}"]`);
      if (again) again.focus();
    });
  }
  return d;
}
function syncBlocksUI() {
  const box = $('lk-blocks'), main = $('lk-blocks-main'), B = ui.blocks;
  const sig = B.order.join() + '|' + B.off.join();
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.replaceChildren(...B.order.map(blockRow));
  main.replaceChildren(blockRow('list'));
}
let dragId = null;
function clearDropMarks() { $('lk-blocks').querySelectorAll('.over-top, .over-bottom, .drag').forEach((el) => el.classList.remove('over-top', 'over-bottom', 'drag')); }
function dropTarget(e) {
  const row = e.target.closest && e.target.closest('.lk-blk');
  if (!row || row.dataset.id === dragId) return null;
  const b = row.getBoundingClientRect();
  return { id: row.dataset.id, row, after: e.clientY > b.top + b.height / 2 };
}
function buildBlocksDnD() {
  const box = $('lk-blocks');
  box.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.lk-blk');
    if (!row) return;
    dragId = row.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch {}
    row.classList.add('drag');
  });
  box.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    box.querySelectorAll('.over-top, .over-bottom').forEach((el) => el.classList.remove('over-top', 'over-bottom'));
    const t = dropTarget(e);
    if (t) t.row.classList.add(t.after ? 'over-bottom' : 'over-top');
  });
  box.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const t = dropTarget(e);
    if (t) {
      const o = ui.blocks.order.filter((x) => x !== dragId);
      o.splice(o.indexOf(t.id) + (t.after ? 1 : 0), 0, dragId);
      ui.blocks.order = o;
      saveUI(); applyUI();
    }
    dragId = null;
    clearDropMarks();
  });
  box.addEventListener('dragend', () => { dragId = null; clearDropMarks(); });
}

/* ---------- раскладки ---------- */
let fsWanted = false;
function syncFullscreen() {
  const want = ui.layout.mode === 'full';
  if (want === fsWanted) return;
  fsWanted = want;
  if (appInfo.native) appCmd('fullscreen', { on: want });
  else if (want) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }
  else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
function setLayout(patch) { Object.assign(ui.layout, patch); saveUI(); applyUI(); syncFullscreen(); }
function setLayoutMode(mode) {
  if (mode === ui.layout.mode) return;
  const prev = ui.layout.mode !== 'full' ? ui.layout.mode : ui.layout.prev;
  setLayout({ mode, prev });
}
const toggleFull = () => setLayoutMode(ui.layout.mode === 'full' ? (ui.layout.prev === 'full' ? 'normal' : ui.layout.prev) : 'full');
async function openMiniPlayer() {
  const r = await appCmd('mini');
  let j = null;
  try { j = r && await r.json(); } catch {}
  if (!j || !j.native) window.open('/mini', 'sonara-mini', 'popup,width=380,height=150');   // без родного окна открываем мини в отдельном окне браузера
}
// в полном экране сайдбар прячется за краем окна и выезжает при наведении на край или по Ctrl+F
let peekTimer = 0;
function peekSide(on) {
  clearTimeout(peekTimer);
  if (on && ui.layout.mode !== 'full') return;
  document.documentElement.classList.toggle('peek', on);
}
$('edge').addEventListener('mouseenter', () => peekSide(true));
$('sidebar').addEventListener('mouseenter', () => clearTimeout(peekTimer));
$('sidebar').addEventListener('mouseleave', () => { peekTimer = setTimeout(() => peekSide(false), 250); });
$('sidebar').addEventListener('click', (e) => { if (e.target.closest('.nav')) peekTimer = setTimeout(() => peekSide(false), 150); });
// Esc в обычном браузере выходит из полного экрана сам: возвращаем раскладку
document.addEventListener('fullscreenchange', () => {
  if (appInfo.native || !fsWanted || document.fullscreenElement) return;
  fsWanted = false;
  if (ui.layout.mode === 'full') { ui.layout.mode = ui.layout.prev === 'full' ? 'normal' : ui.layout.prev; saveUI(); applyUI(); }
});

function syncLookUI() {
  if ($('look').hidden) return;
  const L = ui.look;
  syncBlocksUI();
  syncGradUI();
  syncThemesUI();
  $('lk-auto').checked = !!L.auto;
  $('lk-colors').classList.toggle('dim', !!L.auto);
  const info = $('lk-auto-info');
  info.hidden = !L.auto;
  if (L.auto) {
    const A = autoNow;
    info.textContent = A
      ? T('a.syncLookUI.1', { p1: A.ratios.text.toFixed(1), p2: A.ratios.muted.toFixed(1), p3: A.ratios.button.toFixed(1) })
      : state.cur ? T('a.syncLookUI.2') : T('a.syncLookUI.3');
  }
  document.querySelectorAll('#lk-side button').forEach((b) => b.classList.toggle('on', b.dataset.side === ui.layout.side));
  document.querySelectorAll('#lk-mode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === ui.layout.mode));
  const cur = (v, fallback) => (HEX_RE.test(v || '') ? v.toLowerCase() : fallback);
  const cs = getComputedStyle(document.documentElement);
  const val = { 'lk-bg': cur(L.bg, rgbToHex(cs.getPropertyValue('--main-rgb'))), 'lk-accent': cur(ui.accent, '#007aff'), 'lk-text': cur(L.text, rgbToHex(cs.color)) };
  for (const [id, v] of Object.entries(val)) $(id).value = v;
  $('lk-bg-x').hidden = !L.bg; $('lk-text-x').hidden = !L.text; $('lk-accent-x').hidden = String(ui.accent).toLowerCase() === DEFAULT_UI.accent.toLowerCase();
  $('lk-font').value = FONTS.some(([v]) => v === L.font) ? L.font : '';
  const sliders = [['lk-rs', L.rs, (v) => v + '%'], ['lk-blur', ui.blur, (v) => v + ' px'], ['lk-alpha', ui.alpha, (v) => v + '%'], ['lk-cover', L.cover, (v) => v + '%']];
  for (const [id, v, fmtV] of sliders) { $(id).value = v; setFill($(id)); $(id + '-v').textContent = fmtV(v); }
}
// «r g b» или rgb(r, g, b) -> #rrggbb
function rgbToHex(s) {
  const n = String(s).match(/\d+/g);
  return n && n.length >= 3 ? '#' + n.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('') : '#ffffff';
}

/* ---------- аккаунты ---------- */
const accState = { sp: { text: '', cls: '' }, sc: { text: '', cls: '' }, yt: { text: '', cls: '' } };
function setAccState(src, text, cls = '') { accState[src] = { text, cls }; syncAccounts(); }
function syncAccounts() {
  const connected = !!LS.get('sp_token');
  const spEl = $('sp-state');
  const name = spEl.dataset.name;
  const s = accState.sp;
  spEl.textContent = s.cls === 'err' || !connected ? (s.text || T('a.syncAccounts.1')) : `${name ? name + ' · ' : ''}${s.text || T('a.syncAccounts.2')}`;
  spEl.className = 'state ' + (connected && s.cls !== 'err' ? 'ok' : s.cls);
  $('sp-connect').textContent = connected ? T('a.syncAccounts.3') : T('a.syncAccounts.4');
  $('sp-logout').hidden = !connected;
  const c = accState.sc;
  $('sc-state').textContent = c.text || (LS.get('sc_user') ? '' : T('a.syncAccounts.5'));
  $('sc-state').className = 'state ' + c.cls;
  const y = accState.yt;
  $('yt-state').textContent = y.text || (ytLists.length ? '' : T('a.syncAccounts.6'));
  $('yt-state').className = 'state ' + y.cls;
  renderSearchChips();
}
$('sp-connect').addEventListener('click', spLogin);
$('sp-logout').addEventListener('click', spLogout);
$('sc-load').addEventListener('click', () => {
  const user = parseScUser($('sc-user').value);
  if (!/^[\w\-.]{1,100}$/.test(user)) { setAccState('sc', T('a.on_scload_click.1'), 'err'); return; }
  $('sc-user').value = user;
  LS.set('sc_user', user);
  scLoadLikes(true);
});
$('sc-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sc-load').click(); });
$('sp-client').addEventListener('keydown', (e) => { if (e.key === 'Enter') spLogin(); });

/* ===================== События интерфейса ===================== */
$('sidebar').addEventListener('click', (e) => {
  const b = e.target.closest('.nav[data-view]');
  if (!b) return;
  if (state.query) setQuery('');   // переход в раздел закрывает поиск
  setView(b.dataset.view);
});
$('search').addEventListener('input', (e) => setQuery(e.target.value, e.target));
$('gs-input').addEventListener('input', (e) => setQuery(e.target.value, e.target));
$('gs-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchActive()) { clearTimeout(searchSt.timer); runSearch(); }
  if (e.key === 'Escape') { e.stopPropagation(); if (state.query) setQuery(''); else e.target.blur(); }
});
$('gs-clear').addEventListener('click', () => { setQuery(''); $('gs-input').focus(); });
$('gs-chips').addEventListener('click', (e) => {
  const b = e.target.closest('.gs-chip');
  if (!b) return;
  const id = b.dataset.src;
  if (!searchAvail(id)) { toast(id === 'sp' ? T('a.on_gschips_click.1') : T('a.on_gschips_click.2')); return; }
  searchOn[id] = !searchOn[id];
  LS.set('search_src', JSON.stringify(searchOn));
  if (searchOn[id] && searchActive()) { searchSt.per[id] = { st: 'loading' }; searchOne(id, state.query.trim(), searchSt.token); }
  searchRefresh();
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
  if (searchActive()) { clearTimeout(searchSt.timer); return runSearch(); }
  if (state.view === 'local') return loadLocal(true);
  if (state.view === 'radio') return radioMore();
  if (state.view === 'recs') return loadRecs(true);
  if ((state.view === 'all' || state.view === 'sp') && LS.get('sp_token')) spLoadLikes();
  if ((state.view === 'all' || state.view === 'sc') && LS.get('sc_user')) scLoadLikes(true);
  if ((state.view === 'all' || state.view === 'yt') && ytLists.length) ytLoadAll(true);
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

/* ===================== Проверка обновлений ===================== */
// Сама проверка идёт на сервере (раз в сутки). Здесь только показ уведомления и кнопки.
function updShow(s) {
  const tag = s && s.latest && s.latest.tag;
  const seen = LS.get('upd_seen');
  $('upd-bar').hidden = !tag || seen === tag;
  if (tag) $('upd-text').textContent = T('a.updShow.1', { tag: tag, current: s.current });
}
async function updPoll() {
  try { updShow(await api('/api/app/update/status', { headers: { 'X-Player': '1' } })); } catch {}
}
$('upd-open').addEventListener('click', () => { appCmd('update/open'); $('upd-bar').hidden = true; });
$('upd-x').addEventListener('click', () => {
  const t = $('upd-text').textContent.match(/версия (\S+)/);
  if (t) LS.set('upd_seen', t[1]);
  $('upd-bar').hidden = true;
});
$('upd-on').addEventListener('change', (e) => appCmd('settings', { updateCheck: e.target.checked }));
$('upd-check').addEventListener('click', async () => {
  const msg = $('upd-msg');
  msg.textContent = T('a.on_updcheck_click.1');
  try {
    const s = await (await fetch('/api/app/update/check', { method: 'POST', headers: { 'X-Player': '1' } })).json();
    if (!s.repoSet) msg.textContent = T('a.on_updcheck_click.2');
    else if (s.error) msg.textContent = T('a.on_updcheck_click.3') + s.error;
    else if (s.latest) { msg.textContent = T('a.on_updcheck_click.4', { tag: s.latest.tag }); LS.set('upd_seen', ''); updShow(s); }
    else msg.textContent = T('a.on_updcheck_click.5', { current: s.current });
  } catch (e) { msg.textContent = T('a.on_updcheck_click.6') + e.message; }
});
api('/api/app/update/status', { headers: { 'X-Player': '1' } }).then((s) => { $('upd-on').checked = !!s.enabled; }).catch(() => {});
setTimeout(updPoll, 14000);
setInterval(updPoll, 6 * 3600e3);

/* ===================== Копия библиотеки ===================== */
const BK_FORMAT = 'sonara-backup';
const BK_MAX_BYTES = 40e6;
const BK_ID_RE = { sp: /^[A-Za-z0-9]{10,30}$/, sc: /^\d{1,20}$/, yt: /^[\w-]{11}$/, local: /^[\w-]{1,80}$/ };
const BK_URL_HOSTS = new Set(['open.spotify.com', 'music.youtube.com', 'www.youtube.com', 'youtube.com', 'soundcloud.com', 'www.soundcloud.com']);
const BK_COVER_RE = /^https:\/\/([\w-]+\.)*(scdn\.co|spotifycdn\.com|sndcdn\.com|ytimg\.com|ggpht\.com|googleusercontent\.com)\/[^\s"'<>]{1,380}$/i;
const BK_LIKE_NAMES = { get sp() { return T('a.const.49'); }, get sc() { return T('a.const.50'); }, get yt() { return T('a.const.51'); } };
const bkClean = (s, max) => String(s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
const hdr = { 'X-Player': '1' };
function bkIso(at) { return at > 0 ? new Date(at).toISOString() : undefined; }
// трек в файле копии: только нужные поля, без обложек-картинок и прочего
function bkTrackOut(t, src) {
  const s = src || t.src;
  const o = { src: s, id: String(t.id), title: String(t.title || ''), artist: String(t.artist || '') };
  if (t.album) o.album = String(t.album);
  const url = s === 'sp' ? `https://open.spotify.com/track/${t.id}` : s === 'yt' ? `https://music.youtube.com/watch?v=${t.id}` : s === 'sc' ? t.url : '';
  if (url && /^https:\/\//.test(url)) o.url = url;
  if (s === 'sp') o.uri = `spotify:track:${t.id}`;
  if (t.duration > 0) o.duration = Math.round(t.duration);
  const added = bkIso(t.at);
  if (added) o.added = added;
  const cv = t.art || t.cover || '';
  if (BK_COVER_RE.test(cv)) o.cover = cv;
  return o;
}
function buildBackup() {
  const doc = {
    format: BK_FORMAT, version: 1, createdAt: new Date().toISOString(), app: 'Sonara ' + (appInfo.version || ''),
    likes: { sp: state.lib.sp.map((t) => bkTrackOut(t, 'sp')), sc: state.lib.sc.map((t) => bkTrackOut(t, 'sc')), yt: state.lib.yt.map((t) => bkTrackOut(t, 'yt')) },
    playlists: playlists.map((p) => ({ name: p.name, tracks: p.tracks.filter((t) => BK_ID_RE[t.src] && t.id != null).map((t) => bkTrackOut(t)) })),
    connections: {},
  };
  const scUser = LS.get('sc_user');
  if (scUser && /^[\w\-.]{1,100}$/.test(scUser)) doc.connections.sc_user = scUser;
  if (ytLists.length) doc.connections.yt_lists = ytLists.map((l) => ({ id: l.id, name: l.name || '', cookies: !!l.cookies }));
  const counts = { sp: doc.likes.sp.length, sc: doc.likes.sc.length, yt: doc.likes.yt.length, playlists: doc.playlists.length, plTracks: doc.playlists.reduce((a, p) => a + p.tracks.length, 0) };
  counts.total = counts.sp + counts.sc + counts.yt + counts.playlists;
  return { doc, json: JSON.stringify(doc), counts };
}
function bkValidateTrack(t, where, only) {
  const bad = (m) => ({ error: `${where}: ${m}` });
  if (!t || typeof t !== 'object' || Array.isArray(t)) return bad(T('a.bkValidateTrack.1'));
  for (const k of Object.keys(t)) if (!['src', 'id', 'title', 'artist', 'album', 'url', 'uri', 'duration', 'added', 'cover'].includes(k)) return bad(T('a.bkValidateTrack.2', { k: k }));
  if (typeof t.src !== 'string' || !BK_ID_RE[t.src] || (only && t.src !== only)) return bad(T('a.bkValidateTrack.3') + (only ? '' : T('a.bkValidateTrack.4')) + (only ? T('a.bkValidateTrack.5', { only: only }) : ''));
  if (typeof t.id !== 'string' || !BK_ID_RE[t.src].test(t.id)) return bad(T('a.bkValidateTrack.6'));
  if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 300) return bad(T('a.bkValidateTrack.7'));
  if (typeof t.artist !== 'string' || t.artist.length > 300) return bad(T('a.bkValidateTrack.8'));
  const o = { src: t.src, id: t.id, title: bkClean(t.title, 300), artist: bkClean(t.artist, 300) };
  if ('album' in t) { if (typeof t.album !== 'string' || t.album.length > 300) return bad(T('a.bkValidateTrack.9')); if (t.album) o.album = bkClean(t.album, 300); }
  if ('url' in t) {
    let u = null;
    try { u = typeof t.url === 'string' && t.url.length <= 600 ? new URL(t.url) : null; } catch {}
    if (!u || u.protocol !== 'https:' || !BK_URL_HOSTS.has(u.hostname) || u.username || u.password) return bad(T('a.bkValidateTrack.10'));
    o.url = u.href;
  }
  if ('uri' in t) { if (t.src !== 'sp' || typeof t.uri !== 'string' || t.uri !== `spotify:track:${t.id}`) return bad(T('a.bkValidateTrack.11')); o.uri = t.uri; }
  if ('duration' in t) { if (!isNum(t.duration, 0, 36e6)) return bad(T('a.bkValidateTrack.12')); o.duration = Math.round(t.duration); }
  if ('added' in t) { if (typeof t.added !== 'string' || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(t.added) || !Number.isFinite(Date.parse(t.added))) return bad(T('a.bkValidateTrack.13')); o.added = t.added; }
  if ('cover' in t) { if (typeof t.cover !== 'string' || !BK_COVER_RE.test(t.cover)) return bad(T('a.bkValidateTrack.14')); o.cover = t.cover; }
  return { track: o };
}
// файл копии: только известные поля и допустимые значения, иначе отказ с понятной причиной (как у импорта тем)
function validateBackup(text) {
  if (text.length > BK_MAX_BYTES) return { error: T('a.validateBackup.1') };
  let d;
  try { d = JSON.parse(text.replace(/^﻿/, '')); } catch { return { error: T('a.validateBackup.2') }; }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.format !== BK_FORMAT) return { error: T('a.validateBackup.3') };
  if (d.version !== 1) return { error: T('a.validateBackup.4') };
  for (const k of Object.keys(d)) if (!['format', 'version', 'createdAt', 'app', 'likes', 'playlists', 'connections'].includes(k)) return { error: T('a.validateBackup.5', { k: k }) };
  if (typeof d.createdAt !== 'string' || !Number.isFinite(Date.parse(d.createdAt))) return { error: T('a.validateBackup.6') };
  if ('app' in d && (typeof d.app !== 'string' || d.app.length > 40)) return { error: T('a.validateBackup.7') };
  const out = { createdAt: d.createdAt, likes: { sp: [], sc: [], yt: [] }, playlists: [], connections: {} };
  if ('likes' in d) {
    if (!d.likes || typeof d.likes !== 'object' || Array.isArray(d.likes)) return { error: T('a.validateBackup.8') };
    for (const [k, list] of Object.entries(d.likes)) {
      if (!['sp', 'sc', 'yt'].includes(k)) return { error: T('a.validateBackup.9', { k: k }) };
      if (!Array.isArray(list) || list.length > 60000) return { error: T('a.validateBackup.10', { k: k }) };
      for (let i = 0; i < list.length; i++) { const r = bkValidateTrack(list[i], `likes.${k}[${i}]`, k); if (r.error) return r; out.likes[k].push(r.track); }
    }
  }
  if ('playlists' in d) {
    if (!Array.isArray(d.playlists) || d.playlists.length > 300) return { error: T('a.validateBackup.11') };
    for (let i = 0; i < d.playlists.length; i++) {
      const p = d.playlists[i];
      if (!p || typeof p !== 'object' || Array.isArray(p)) return { error: T('a.validateBackup.12', { i: i }) };
      for (const k of Object.keys(p)) if (k !== 'name' && k !== 'tracks') return { error: T('a.validateBackup.13', { i: i, k: k }) };
      if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 60) return { error: T('a.validateBackup.14', { i: i }) };
      if (!Array.isArray(p.tracks) || p.tracks.length > 30000) return { error: T('a.validateBackup.15', { i: i }) };
      const tracks = [];
      for (let j = 0; j < p.tracks.length; j++) { const r = bkValidateTrack(p.tracks[j], `playlists[${i}].tracks[${j}]`); if (r.error) return r; tracks.push(r.track); }
      out.playlists.push({ name: bkClean(p.name, 60), tracks });
    }
  }
  if ('connections' in d) {
    const c = d.connections;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return { error: T('a.validateBackup.16') };
    for (const k of Object.keys(c)) if (k !== 'sc_user' && k !== 'yt_lists') return { error: T('a.validateBackup.17', { k: k }) };
    if ('sc_user' in c) { if (typeof c.sc_user !== 'string' || !/^[\w\-.]{1,100}$/.test(c.sc_user)) return { error: T('a.validateBackup.18') }; out.connections.sc_user = c.sc_user; }
    if ('yt_lists' in c) {
      if (!Array.isArray(c.yt_lists) || c.yt_lists.length > 12) return { error: T('a.validateBackup.19') };
      out.connections.yt_lists = [];
      for (const l of c.yt_lists) {
        if (!l || typeof l !== 'object' || Array.isArray(l)) return { error: T('a.validateBackup.20') };
        for (const k of Object.keys(l)) if (!['id', 'name', 'cookies'].includes(k)) return { error: T('a.validateBackup.21', { k: k }) };
        if (typeof l.id !== 'string' || !/^[\w-]{2,60}$/.test(l.id)) return { error: T('a.validateBackup.22') };
        if ('name' in l && (typeof l.name !== 'string' || l.name.length > 80)) return { error: T('a.validateBackup.23') };
        if ('cookies' in l && typeof l.cookies !== 'boolean') return { error: T('a.validateBackup.24') };
        out.connections.yt_lists.push({ id: l.id, name: bkClean(l.name || '', 80), cookies: !!l.cookies });
      }
    }
  }
  const n = out.likes.sp.length + out.likes.sc.length + out.likes.yt.length + out.playlists.length;
  if (!n) return { error: T('a.validateBackup.25') };
  return { data: out };
}
// трек из копии -> запись плейлиста: обложки у YouTube восстанавливаем по id
function bkToSlim(t) {
  const o = { src: t.src, id: t.id, title: t.title, artist: t.artist };
  if (t.album) o.album = t.album;
  if (t.uri) o.uri = t.uri;
  if (t.url) o.url = t.url;
  if (t.duration) o.duration = t.duration;
  const cv = t.cover || (t.src === 'yt' ? `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg` : '');
  if (cv) { o.cover = cv; o.art = cv; }
  return o;
}
function bkMsg(text, bad) { const el = $('bk-msg'); el.textContent = text || ''; el.hidden = !text; el.classList.toggle('bad', !!bad); }
const bkFmtDate = (ms) => I18N.dateTime(ms);
const bkFmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + T('a.bkFmtSize.1') : Math.max(1, Math.round(b / 1024)) + T('a.bkFmtSize.2'));
async function backupRefresh() {
  try {
    const s = await api('/api/app/backup/status', { headers: hdr });
    $('bk-auto').checked = !!s.auto;
    $('bk-state').textContent = s.lastAt ? T('a.backupRefresh.1') + bkFmtDate(s.lastAt) : T('a.backupRefresh.2');
    $('bk-state').className = 'state' + (s.lastAt ? ' ok' : '');
    const box = $('bk-files');
    box.replaceChildren(...s.files.map((f) => {
      const d = document.createElement('div');
      d.className = 'folder';
      d.innerHTML = T('a.backupRefresh.3');
      d.querySelector('span').textContent = `${bkFmtDate(f.at)} · ${f.auto ? T('a.backupRefresh.4') : T('a.backupRefresh.5')} · ${bkFmtSize(f.size)}`;
      d.querySelector('span').title = f.name;
      d.querySelector('button').addEventListener('click', async () => {
        try { restoreFlow(await (await fetch('/api/app/backup/file?name=' + encodeURIComponent(f.name), { headers: hdr })).text()); } catch (e) { bkMsg(T('a.on_button_click.1') + e.message, true); }
      });
      return d;
    }));
    if (!s.files.length) box.innerHTML = T('a.backupRefresh.6');
  } catch (e) { $('bk-state').textContent = T('a.backupRefresh.7'); }
}
async function backupSave(auto) {
  const b = buildBackup();
  if (!b.counts.total) { if (!auto) bkMsg(T('a.backupSave.1'), true); return null; }
  const r = await api('/api/app/backup/save', { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ json: b.json, auto }) });
  const what = T('a.backupSave.2', { sp: b.counts.sp, sc: b.counts.sc, yt: b.counts.yt, playlists: b.counts.playlists });
  if (auto) toast(T('a.backupSave.3'));
  else bkMsg(T('a.backupSave.4', { dir: r.dir, name: r.name, what: what }), false);
  backupRefresh();
  return r;
}
// раз в неделю (и при запуске, если пропустили), если автокопия включена и в библиотеке что-то есть
async function backupAutoCheck() {
  try {
    const s = await api('/api/app/backup/status', { headers: hdr });
    if (!s.auto || Date.now() - (s.lastAt || 0) < 7 * 86400e3) return;
    await backupSave(true);
  } catch (e) { console.warn(T('a.backupAutoCheck.1'), e); }
}
async function restoreFlow(text) {
  const v = validateBackup(text);
  if (v.error) { bkMsg(T('a.restoreFlow.1') + v.error, true); toast(T('a.restoreFlow.2')); return; }
  const d = v.data;
  const plTracks = d.playlists.reduce((a, p) => a + p.tracks.length, 0);
  const lines = [T('a.restoreFlow.3', { p1: bkFmtDate(Date.parse(d.createdAt)) }), T('a.restoreFlow.4', { length: d.likes.sp.length, p2: d.likes.sc.length, p3: d.likes.yt.length }), T('a.restoreFlow.5', { length: d.playlists.length, plTracks: plTracks }),
    T('a.restoreFlow.6')];
  const ok = await dialog({ title: T('a.restoreFlow.7'), text: lines.join('\n'), ok: T('a.restoreFlow.8') });
  if (!ok) return;
  const st = { created: 0, merged: 0, added: 0 };
  const fill = (name, list) => {
    let p = playlists.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!p) { p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, tracks: [] }; playlists.push(p); st.created++; } else st.merged++;
    const have = new Set(p.tracks.map((t) => t.src + ':' + t.id));
    for (const t of list) { const k = t.src + ':' + t.id; if (have.has(k)) continue; have.add(k); p.tracks.push(bkToSlim(t)); st.added++; }
  };
  for (const p of d.playlists) fill(p.name, p.tracks);
  for (const k of ['sp', 'sc', 'yt']) if (d.likes[k].length) fill(BK_LIKE_NAMES[k], d.likes[k]);
  savePlaylists();
  // подключения возвращаем только если они не заданы: чужие настройки не перезаписываем
  const c = d.connections;
  if (c.sc_user && !LS.get('sc_user')) { LS.set('sc_user', c.sc_user); $('sc-user').value = c.sc_user; scLoadLikes(false); }
  if (c.yt_lists) {
    let added = 0;
    for (const l of c.yt_lists) if (ytLists.length < 12 && !ytLists.some((x) => x.id === l.id)) { ytLists.push({ id: l.id, name: l.name, cookies: l.cookies, n: 0 }); added++; }
    if (added) { saveYtLists(); ytLoadAll(false); }
  }
  if (state.view.startsWith('pl:')) render();
  bkMsg(T('a.restoreFlow.9', { created: st.created, merged: st.merged, added: st.added }), false);
  toast(T('a.restoreFlow.10'));
}
async function exportM3u(list) {
  const pls = list.filter((p) => p.tracks.length).map((p) => ({ name: p.name, tracks: p.tracks.map((t) => ({ src: t.src, id: t.id, title: t.title, artist: t.artist, duration: t.duration, url: t.url })) }));
  if (!pls.length) { toast(T('a.exportM3u.1')); bkMsg(T('a.exportM3u.2'), true); return; }
  try {
    const r = await api('/api/app/backup/m3u', { method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify({ playlists: pls }) });
    bkMsg(T('a.exportM3u.3', { files: r.files, tracks: r.tracks, dir: r.dir }), false);
    toast(T('a.exportM3u.4', { files: r.files, tracks: r.tracks }), 5000);
  } catch (e) { bkMsg(T('a.exportM3u.5') + e.message, true); toast('M3U: ' + e.message); }
}
$('bk-save').addEventListener('click', async () => { try { await backupSave(false); } catch (e) { bkMsg(T('a.on_bksave_click.1') + e.message, true); } });
$('bk-restore').addEventListener('click', () => $('bk-file').click());
$('bk-file').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) restoreFlow(await f.text()); });
$('bk-auto').addEventListener('change', (e) => appCmd('settings', { autoBackup: e.target.checked }));
$('bk-open').addEventListener('click', () => appCmd('backup/reveal'));
$('bk-m3u').addEventListener('click', () => exportM3u(playlists));
$('act-m3u').addEventListener('click', () => { const p = curPl(); if (p) exportM3u([p]); });
setTimeout(backupAutoCheck, 25000);
setInterval(backupAutoCheck, 6 * 3600e3);

/* ===================== Таймер сна ===================== */
// mode 'time': пауза через заданное время; mode 'track': пауза в конце играющего сейчас трека (вместо следующего).
// За 30 секунд до конца громкость плавно падает, потом пауза: плеер остаётся открытым, а громкость возвращается.
const SLEEP_FADE_MS = 30000;
const sleepT = { mode: null, end: 0, label: '' };
let sleepTimer = 0;
const sleepFmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
// сколько осталось; для трека неизвестной длины Infinity: ни обратного отсчёта, ни затухания
function sleepLeft() {
  if (sleepT.mode === 'time') return Math.max(0, sleepT.end - Date.now());
  if (sleepT.mode === 'track') return state.dur > 0 ? Math.max(0, state.dur - lyNow()) : Infinity;
  return 0;
}
function applyGain() {
  audio.volume = gain();
  if (sp.player) sp.player.setVolume(gain()).catch(() => {});
  if (scw) { try { scw.setVolume(gain() * 100); } catch {} }
}
let fadeSpcAt = 0;
function setFade(m) {
  if (Math.abs(m - fadeMul) < 0.004) return;
  fadeMul = m;
  applyGain();
  // Spotify в приложении: громкость только запросами к API, поэтому реже, шагами
  if (isSpConnect() && spc.device && Date.now() - fadeSpcAt > 2500) { fadeSpcAt = Date.now(); spcCmd(`/me/player/volume?volume_percent=${Math.round(state.volume * fadeMul)}`); }
}
function sleepRestoreVolume() {
  if (fadeMul === 1) return;
  fadeMul = 1;
  applyGain();
  if (isSpConnect() && spc.device) spcCmd(`/me/player/volume?volume_percent=${state.volume}`);
}
function sleepUi() {
  const on = !!sleepT.mode;
  const left = on ? sleepLeft() : 0;
  const txt = !on ? '' : left === Infinity ? T('a.sleepUi.1') : sleepFmt(left);
  $('b-sleep').classList.toggle('on', on);
  $('sleep-lbl').textContent = txt;
  $('sleep-lbl').hidden = !on;
  $('b-sleep').title = on ? T('a.sleepUi.2', { label: sleepT.label, txt: txt }) : T('a.sleepUi.3');
  $('sp-status').hidden = !on;
  $('sp-left').textContent = on ? (sleepT.mode === 'track' ? (left === Infinity ? T('a.sleepUi.4') : T('a.sleepUi.5', { txt: txt })) : txt) : '';
  document.querySelectorAll('#sleep-pop [data-min]').forEach((b) => b.classList.toggle('on', on && sleepT.mode === 'time' && sleepT.min === Number(b.dataset.min)));
  $('sp-track').classList.toggle('on', on && sleepT.mode === 'track');
}
function sleepSchedule() {
  clearTimeout(sleepTimer);
  sleepTimer = 0;
  if (!sleepT.mode) return;
  sleepTimer = setTimeout(sleepTick, fadeMul < 1 ? 250 : 1000);
}
function sleepTick() {
  if (!sleepT.mode) return;
  if (sleepT.mode === 'track' && !state.cur) { sleepCancel(); return; }
  const left = sleepLeft();
  if (sleepT.mode === 'time' && left <= 0) { sleepFire(); return; }
  if (state.playing && left < SLEEP_FADE_MS) setFade(Math.max(0, left / SLEEP_FADE_MS));
  else if (fadeMul < 1) sleepRestoreVolume();   // пауза или перемотка на начало: затухание отменяем
  sleepUi();
  sleepSchedule();
}
function sleepStop() {
  clearTimeout(sleepTimer);
  sleepTimer = 0;
  sleepT.mode = null;
  sleepUi();
  publishState(true);
}
function sleepFire() {
  sleepStop();
  if (state.playing) engPause();   // для Spotify в приложении это пауза через API
  toast(T('a.sleepFire.1'));
  setTimeout(sleepRestoreVolume, 700);   // громкость возвращаем уже на паузе, чтобы следующий запуск не был тихим
}
function sleepCancel(silent) {
  if (!sleepT.mode) return;
  sleepStop();
  sleepRestoreVolume();
  if (!silent) toast(T('a.sleepCancel.1'));
}
function sleepStart(mode, ms, label) {
  if (sleepT.mode) { sleepStop(); sleepRestoreVolume(); }
  if (mode === 'track' && !state.cur) { toast(T('a.sleepStart.1')); return; }
  sleepT.mode = mode;
  sleepT.label = label;
  sleepT.min = mode === 'time' ? Math.round(ms / 60000) : 0;
  sleepT.end = mode === 'time' ? Date.now() + ms : 0;
  toast(T('a.sleepStart.2', { label: label }));
  sleepUi();
  sleepSchedule();
  publishState(true);
}
const openSleepPop = () => { $('sleep-pop').hidden = false; $('b-sleep').classList.add('open'); sleepUi(); };
function closeSleepPop() { $('sleep-pop').hidden = true; $('b-sleep').classList.remove('open'); }
$('b-sleep').addEventListener('click', () => { if ($('sleep-pop').hidden) openSleepPop(); else closeSleepPop(); });
$('sleep-pop').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.min) { sleepStart('time', Number(b.dataset.min) * 60000, T('a.on_sleeppop_click.1', { min: b.dataset.min })); closeSleepPop(); }
  else if (b.id === 'sp-track') { sleepStart('track', 0, T('a.on_sleeppop_click.2')); closeSleepPop(); }
  else if (b.id === 'sp-cancel') { sleepCancel(); closeSleepPop(); }
  else if (b.id === 'sp-custom-go') {
    const v = Math.round(Number($('sp-custom').value));
    if (!(v >= 1 && v <= 720)) { $('sp-custom').focus(); toast(T('a.on_sleeppop_click.3')); return; }
    sleepStart('time', v * 60000, T('a.on_sleeppop_click.4', { v: v }));
    $('sp-custom').value = '';
    closeSleepPop();
  }
});
$('sp-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('sp-custom-go').click(); });
document.addEventListener('mousedown', (e) => { if (!$('sleep-pop').hidden && !e.target.closest('#sleep-pop, #b-sleep')) closeSleepPop(); });

/* ===================== Горячие клавиши ===================== */
// Сочетание записываем как «Ctrl+Alt+Shift+Meta+<e.code>»: e.code не зависит от раскладки, русская М тоже KeyM.
function comboOf(e) {
  const m = [];
  if (e.ctrlKey) m.push('Ctrl');
  if (e.altKey) m.push('Alt');
  if (e.shiftKey) m.push('Shift');
  if (e.metaKey) m.push('Meta');
  return [...m, e.code].join('+');
}
const isModifierCode = (c) => /^(Control|Shift|Alt|Meta|OS)(Left|Right)?$/.test(c);
const KEY_NAMES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', get Space() { return T('a.const.52'); }, Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', PageUp: 'PgUp', PageDown: 'PgDn' };
function comboLabel(c) {
  if (!c) return '—';
  return c.split('+').map((p) => KEY_NAMES[p] || p.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ')).join(' + ');
}
// действия: def это сочетание по умолчанию; inInput: работает даже в поле ввода; repeat: можно держать нажатой
const focusSearch = () => { setLyrics(false); const gs = $('gs-input'); if (gs.offsetParent) { gs.focus(); gs.select(); return; } peekSide(true); $('search').focus(); $('search').select(); };
const KEY_ACTIONS = [
  { id: 'toggle', get name() { return T('a.const.53'); }, def: 'Space', run: () => togglePlay() },
  { id: 'seekBack', get name() { return T('a.const.54'); }, def: 'ArrowLeft', repeat: true, run: () => seek(lyNow() - 5000) },
  { id: 'seekFwd', get name() { return T('a.const.55'); }, def: 'ArrowRight', repeat: true, run: () => seek(lyNow() + 5000) },
  { id: 'prev', get name() { return T('a.const.56'); }, def: 'Ctrl+ArrowLeft', run: () => prev() },
  { id: 'next', get name() { return T('a.const.57'); }, def: 'Ctrl+ArrowRight', run: () => next(false) },
  { id: 'volUp', get name() { return T('a.const.58'); }, def: 'ArrowUp', repeat: true, run: () => setVolume(state.volume + 5) },
  { id: 'volDown', get name() { return T('a.const.59'); }, def: 'ArrowDown', repeat: true, run: () => setVolume(state.volume - 5) },
  { id: 'mute', get name() { return T('a.const.60'); }, def: 'KeyM', run: () => setVolume(state.volume > 0 ? 0 : state.lastVolume || 70) },
  { id: 'lyrics', get name() { return T('a.const.61'); }, def: 'KeyL', run: () => toggleLyrics() },
  { id: 'fullscreen', get name() { return T('a.const.62'); }, def: 'F11', inInput: true, run: () => toggleFull() },
  { id: 'search', get name() { return T('a.const.63'); }, def: 'Ctrl+KeyF', inInput: true, run: focusSearch },
];
// эти сочетания занять нельзя: на них держится сам плеер или система
const KEY_RESERVED = {
  get Escape() { return T('a.const.64'); },
  get Tab() { return T('a.const.65'); },
  'Shift+Tab': '@a.key.shifttab',
  get Enter() { return T('a.const.66'); },
  'Ctrl+Shift+KeyK': '@a.key.ctrlshiftk',
  'Alt+F4': '@a.key.altf4',
  get F5() { return T('a.const.67'); },
  'Ctrl+KeyR': '@a.key.ctrlr',
};
const KEY_SYSTEM_WARN = { 'Ctrl+KeyC': '@a.sys.copy', 'Ctrl+KeyV': '@a.sys.paste', 'Ctrl+KeyX': '@a.sys.cut', 'Ctrl+KeyA': '@a.sys.selectall', 'Ctrl+KeyZ': '@a.sys.undo', 'Ctrl+KeyW': '@a.sys.closetab' };
const KEY_COMBO_RE = /^((Ctrl|Alt|Shift|Meta)\+)*[A-Za-z0-9]+$/;
let keymap = {};
let keyCapture = null;
let keyPending = null;
function loadKeymap() {
  const saved = LS.json('keys', {});
  keymap = {};
  for (const a of KEY_ACTIONS) {
    const v = saved && typeof saved === 'object' ? saved[a.id] : undefined;
    keymap[a.id] = typeof v === 'string' && (v === '' || KEY_COMBO_RE.test(v)) ? v : a.def;   // '' значит «не назначено»
  }
}
function saveKeymap() {
  const diff = {};
  for (const a of KEY_ACTIONS) if (keymap[a.id] !== a.def) diff[a.id] = keymap[a.id];
  LS.set('keys', JSON.stringify(diff));
}
loadKeymap();
function keyMsg(html, bad) {
  const el = $('kb-msg');
  el.innerHTML = html || '';
  el.hidden = !html;
  el.classList.toggle('bad', !!bad);
}
function keyAssign(id, combo) {
  const act = KEY_ACTIONS.find((a) => a.id === id);
  if (KEY_RESERVED[combo]) { keyMsg(T('a.keyAssign.1', { p1: lbl(KEY_RESERVED[combo]) }), true); return; }
  const other = KEY_ACTIONS.find((a) => a.id !== id && keymap[a.id] === combo);
  if (other) {
    keyPending = { id, combo, other: other.id };
    keyMsg(T('a.keyAssign.2', { p1: escapeHtml(comboLabel(combo)), p2: escapeHtml(other.name) }), true);
    return;
  }
  keymap[id] = combo;
  saveKeymap();
  const sys = lbl(KEY_SYSTEM_WARN[combo] || '');
  keyMsg(sys ? T('a.keyAssign.3', { p1: escapeHtml(comboLabel(combo)), sys: sys }) : `«${escapeHtml(act.name)}»: ${escapeHtml(comboLabel(combo))}`, false);
  renderKeys();
}
function keyCancelCapture() { keyCapture = null; renderKeys(); }
// запись нового сочетания идёт в фазе перехвата, чтобы остальные обработчики клавиш её не увидели
window.addEventListener('keydown', (e) => {
  if (!keyCapture) return;
  e.preventDefault();
  e.stopPropagation();
  if (isModifierCode(e.code)) return;
  const id = keyCapture.id;
  if (e.code === 'Escape') { keyCancelCapture(); keyMsg(T('a.on_window_keydown.1')); return; }
  keyCapture = null;
  keyPending = null;
  keyAssign(id, comboOf(e));
  renderKeys();
}, true);
function renderKeys() {
  const box = $('kb-list');
  if (!box) return;
  box.replaceChildren(...KEY_ACTIONS.map((a) => {
    const d = document.createElement('div');
    d.className = 'kb-row';
    d.innerHTML = T('a.renderKeys.1');
    d.dataset.id = a.id;
    d.querySelector('.kb-name').textContent = a.name;
    const k = d.querySelector('.kb-key');
    const rec = keyCapture && keyCapture.id === a.id;
    k.textContent = rec ? T('a.renderKeys.2') : comboLabel(keymap[a.id]);
    k.classList.toggle('rec', !!rec);
    k.classList.toggle('empty', !keymap[a.id]);
    d.querySelector('[data-act="reset"]').hidden = keymap[a.id] === a.def;
    d.querySelector('[data-act="clear"]').hidden = !keymap[a.id];
    return d;
  }));
}
async function renderMediaKeysStatus() {
  const el = $('kb-global-state');
  try {
    const s = await api('/api/app/mediakeys', { headers: { 'X-Player': '1' } });
    $('kb-global').checked = !!s.enabled;
    const names = { play: 'Play/Pause', next: T('a.renderMediaKeysStatus.1'), prev: T('a.renderMediaKeysStatus.2'), stop: T('a.renderMediaKeysStatus.3') };
    const bad = Object.entries(s.keys || {}).filter(([, ok]) => !ok).map(([k]) => names[k]);
    el.textContent = !s.enabled ? T('a.renderMediaKeysStatus.4')
      : !s.running ? T('a.renderMediaKeysStatus.5')
      : bad.length ? T('a.renderMediaKeysStatus.6', { p1: bad.join(', ') })
      : s.active ? T('a.renderMediaKeysStatus.7') : T('a.renderMediaKeysStatus.8');
    el.classList.toggle('bad', !!bad.length);
  } catch { el.textContent = T('a.renderMediaKeysStatus.9'); }
}
function buildKeys() {
  $('kb-list').addEventListener('click', (e) => {
    const row = e.target.closest('.kb-row');
    if (!row) return;
    const id = row.dataset.id, a = KEY_ACTIONS.find((x) => x.id === id);
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'reset') { keymap[id] = a.def; saveKeymap(); keyMsg(''); renderKeys(); return; }
    if (act && act.dataset.act === 'clear') { keymap[id] = ''; saveKeymap(); keyMsg(''); renderKeys(); return; }
    if (e.target.closest('.kb-key')) { keyMsg(''); keyPending = null; keyCapture = { id }; renderKeys(); }
  });
  $('kb-msg').addEventListener('click', (e) => {
    if (e.target.id === 'kb-steal' && keyPending) {
      const { id, combo, other } = keyPending;
      keymap[other] = '';
      keymap[id] = combo;
      keyPending = null;
      saveKeymap();
      keyMsg(T('a.on_kbmsg_click.1'), false);
      renderKeys();
    } else if (e.target.id === 'kb-cancel') { keyPending = null; keyMsg(''); renderKeys(); }
  });
  $('kb-reset').addEventListener('click', () => { keymap = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.def])); keyPending = null; saveKeymap(); keyMsg(T('a.on_kbreset_click.1'), false); renderKeys(); });
  $('kb-global').addEventListener('change', (e) => { appCmd('settings', { mediaKeys: e.target.checked }); setTimeout(renderMediaKeysStatus, 1500); });
  // пока окно клавиш закрыто, запись отменяем, чтобы не перехватывать нажатия зря
  $('settings').addEventListener('mousedown', (e) => { if (keyCapture && !e.target.closest('.kb-key')) keyCancelCapture(); });
  renderKeys();
  renderMediaKeysStatus();
}

document.addEventListener('keydown', (e) => {
  const typing = e.target.matches('input:not([type=range]):not([type=checkbox]), textarea');
  if (e.key === 'Escape' && !$('sleep-pop').hidden) { closeSleepPop(); return; }
  if (e.key === 'Escape' && ctxOpen) { closeMenu(); return; }
  if (e.key === 'Escape' && !$('look').hidden) { closeLook(); return; }
  if (e.key === 'Escape' && !$('settings').hidden) { closeSettings(); return; }
  if (e.key === 'Escape' && lyOpen && !$('ly-dlg').hidden) { $('ly-dlg').hidden = true; return; }
  if (e.key === 'Escape' && lyOpen) { setLyrics(false); return; }
  if (e.key === 'Escape' && ui.layout.mode === 'full' && !typing) { toggleFull(); return; }
  // всё остальное идёт по карте сочетаний; пока человек печатает, перехватываем только то, что помечено inInput
  const act = keyCapture ? null : KEY_ACTIONS.find((a) => keymap[a.id] === comboOf(e));
  if (!act || (typing && !act.inInput) || (e.repeat && !act.repeat)) return;
  e.preventDefault();
  act.run();
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
  if (!state.cur) { lyLinesEl.innerHTML = lyState(T('a.lyRender.1'), T('a.lyRender.2')); return; }
  switch (lyr.status) {
    case 'loading':
      lyLinesEl.innerHTML = lyState(T('a.lyRender.3'), '', '<div class="loader"></div>');
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
      const srcName = { genius: 'Genius', lrclib: 'LRCLIB', lyricsovh: 'lyrics.ovh', custom: T('a.lyRender.4') }[lyr.source];
      note.textContent = (srcName ? T('a.lyRender.5', { srcName: srcName }) : '') + T('a.lyRender.6');
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
      lyLinesEl.innerHTML = lyState(T('a.lyRender.7'), T('a.lyRender.8'));
      break;
    case 'error':
      lyLinesEl.innerHTML = lyState(T('a.lyRender.9'), T('a.lyRender.10'), '') ;
      lyLinesEl.querySelector('.ly-state').insertAdjacentHTML('beforeend', T('a.lyRender.11'));
      break;
    default:
      lyLinesEl.innerHTML = lyState(T('a.lyRender.12'), T('a.lyRender.13'));
      lyLinesEl.querySelector('.ly-state').insertAdjacentHTML('beforeend', T('a.lyRender.14'));
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
  $('ly-src').innerHTML = t ? (t.src === 'sp' ? '<span class="badge sp">Spotify</span>' : t.src === 'yt' ? '<span class="badge yt">YouTube</span>' : t.src === 'local' ? T('a.lyTrack.1') : '<span class="badge sc">SoundCloud</span>') : '';
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

/* ===================== Смена языка без перезапуска ===================== */
// Разметку с data-i18n уже перевёл I18N.apply(). Здесь обновляем то, что собирается из JS: подписи в списках, меню, настройках, плеере.
function relocalize() {
  const names = (sel, list, pick) => document.querySelectorAll(sel).forEach((b, i) => { const v = pick(list, b, i); if (v != null) { const s = b.querySelector('span'); if (s) s.textContent = v; } });
  names('#presets .preset', PRESETS, (L, b) => (L.find((p) => p.id === b.dataset.id) || {}).name);
  names('#walls .wl', WALLS, (L, b) => (L[b.dataset.id] || {}).name);
  names('#gr-presets .gr-preset', GRAD_PRESETS, (L, b, i) => (L[i] || {}).name);
  document.querySelectorAll('#gr-presets .gr-preset').forEach((b, i) => { if (GRAD_PRESETS[i]) b.title = GRAD_PRESETS[i].name; });
  document.querySelectorAll('#accents .sw[data-c]').forEach((b, i) => { if (ACCENTS[i]) b.title = lbl(ACCENTS[i][0]); });
  const custom = document.querySelector('.sw-custom');
  if (custom) custom.title = T('a.buildSettings.1');
  [...$('lk-font').options].forEach((o, i) => { if (FONTS[i]) o.textContent = lbl(FONTS[i][1]); });
  $('lk-blocks').dataset.sig = ''; syncBlocksUI();
  if (appInfo.native) $('hint-sp-play').innerHTML = T('a.top.5');
  for (const src of ['sp', 'sc', 'yt']) {
    const n = state.lib[src].length;
    if (accState[src].cls === 'ok' && n) accState[src] = { text: `${n} ${plural(n, trackForms())}`, cls: 'ok' };
  }
  syncAccounts();
  renderYtLists(); renderFolders(); renderSearchChips(); spFreeSync();
  renderSidebarPlaylists();
  render();
  renderQueue(); lycRender(); lyRender();
  updatePlayer(); sleepUi();
  renderThemes(); renderKeys(); renderMediaKeysStatus(); syncLookUI();
  if (state.view === 'stats') renderStats();
  if (!$('settings').hidden) backupRefresh();
  appCmd('settings', { lang: I18N.lang });
}
document.addEventListener('langchange', () => { try { relocalize(); } catch (e) { console.warn('language switch', e); } });

/* ===================== Старт ===================== */
// экран запуска из index.html убираем, когда интерфейс собран (или через 6 секунд, что бы ни случилось)
function hideBoot() {
  const el = document.getElementById('boot');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 250);
}
setTimeout(hideBoot, 6000);
(async function init() {
  $('redirect-uri').textContent = REDIRECT_URI;
  $('sp-client').value = LS.get('sp_client_id');
  $('sc-user').value = LS.get('sc_user');
  readRowH();
  buildSettings();
  applyUI();
  showCssRescue();
  setVolume(state.volume, false);
  updatePlayer();
  ping();
  api('/api/info').then((i) => {
    appInfo = i;
    $('ver').textContent = 'v' + i.version;
    $('log-path').textContent = i.logFile;
    connectEvents();
    appCmd('settings', { lang: I18N.lang });   // трей, заголовки окон и ошибки сервера говорят на языке интерфейса
    if (i.native) {
      $('b-mini').hidden = false;
      $('row-tray').hidden = false;
      appCmd('settings', { closeToTray: ui.tray !== false });
      syncFullscreen();   // сохранённый полноэкранный режим включаем сразу при старте
      publishState(true);
      $('hint-sp-play').innerHTML = T('a.top.5');
      pushTheme();
    }
  }).catch(() => {});

  if (location.pathname === '/callback') await spHandleCallback();

  renderSidebarPlaylists();
  rebuildAll();
  if (LS.get('sp_token')) {
    setAccState('sp', state.lib.sp.length ? `${state.lib.sp.length} ${plural(state.lib.sp.length, trackForms())}` : '', 'ok');
    spLoadLikes();
    spMe().then(syncAccounts);
  }
  if (LS.get('sc_user')) scLoadLikes(false);
  renderYtLists();
  renderSearchChips();
  ytCheck();
  if (ytLists.length) ytLoadAll(false);
  loadLocal(false);
  loadDiscord();
  hideBoot();
})();
