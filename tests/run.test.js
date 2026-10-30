'use strict';
// npm test: самое важное. Серверные функции берём из server.js (режим PLAYER_TEST), клиентские вырезаем из public/app.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// сервер пишет в папку данных: подменяем её на временную, настоящие настройки не трогаем
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nakazmusic-test-'));
process.env.LOCALAPPDATA = tmp;
process.env.PLAYER_TEST = '1';
const server = require('../server.js');
const { load } = require('./load-client.js');
test.after(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

/* ---------- очистка названий для поиска ---------- */
test('cleanTitle убирает ремастеры, версии и мусор из скобок', () => {
  assert.equal(server.cleanTitle('Song Name (Remastered 2011)'), 'Song Name');
  assert.equal(server.cleanTitle('Song Name - 2011 Remastered Version'), 'Song Name');
  assert.equal(server.cleanTitle('Song Name (Official Video)'), 'Song Name');
  assert.equal(server.cleanTitle('Song Name feat. Someone'), 'Song Name');
  assert.equal(server.cleanTitle('Plain Title'), 'Plain Title');
  assert.equal(server.cleanTitle('Песня (Remix)'), 'Песня (Remix)', 'ремикс это часть названия, его оставляем');
  assert.equal(server.cleanTitle(null), '');
});
test('splitArtists делит исполнителей и не ломается на пустом', () => {
  assert.deepEqual(server.splitArtists('Anna, Boris & Clara feat. Dmitri'), ['anna', 'boris', 'clara', 'dmitri']);
  assert.deepEqual(server.splitArtists(''), []);
  assert.deepEqual(server.splitArtists(undefined), []);
});
test('norm приводит к нижнему регистру без знаков', () => {
  assert.equal(server.norm('Hello, World!'), 'hello world');
  assert.equal(server.norm('  Ёлка  '), server.norm('ёлка'));
});

/* ---------- сравнение версий ---------- */
test('verNewer сравнивает версии по числам', () => {
  assert.equal(server.verNewer('v3.6.0', '3.5.0'), true);
  assert.equal(server.verNewer('3.10.0', '3.9.9'), true);
  assert.equal(server.verNewer('3.5.0', '3.5.0'), false);
  assert.equal(server.verNewer('3.4.9', '3.5.0'), false);
  assert.equal(server.verNewer('4', '3.5.0'), true);
  assert.equal(server.verNewer('мусор', '3.5.0'), false);
  assert.equal(server.verNewer('', '3.5.0'), false);
});

/* ---------- лог не выдаёт секреты ---------- */
test('redact прячет токены, cookies и пароли', () => {
  const s = server.redact('Authorization: Bearer abcdef1234567890 access_token=SECRETVALUE123 Cookie: SID=abc; x=y password: hunter22222');
  assert.ok(!/abcdef1234567890|SECRETVALUE123|SID=abc|hunter22222/.test(s), s);
  assert.equal(server.redact('обычная строка про трек'), 'обычная строка про трек');
});

/* ---------- настройки: повреждённый и старый store.json ---------- */
test('readStore переживает мусор и откладывает файл в сторону', () => {
  const dir = path.join(tmp, 'MyPlayer');
  const file = path.join(dir, 'store.json');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, '{"playlists": [1,2');
  assert.deepEqual(server.readStore(), {});
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('store.json.broken-')));
  fs.writeFileSync(file, '[1,2,3]');
  assert.deepEqual(server.readStore(), {});
  fs.writeFileSync(file, '');
  assert.deepEqual(server.readStore(), {});
  fs.writeFileSync(file, '{"volume":"40"}');
  assert.deepEqual(server.readStore(), { volume: '40' });
});
test('writeJson пишет атомарно и не оставляет .tmp', () => {
  const f = path.join(tmp, 'x.json');
  server.writeJson(f, { a: 1 });
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { a: 1 });
  assert.ok(!fs.existsSync(f + '.tmp'));
});

/* ---------- клиент: миграция настроек ---------- */
test('sanitizeUi заменяет недопустимое умолчаниями и сохраняет годное', () => {
  const c = load(['DEFAULT_UI', 'sanitizeUi']);
  const d = c.DEFAULT_UI;
  const bad = c.sanitizeUi({ alpha: 'много', blur: -5, mode: 'sepia', accent: 'red', tray: 'yes', look: [1], layout: 5 });
  assert.equal(bad.alpha, d.alpha);
  assert.equal(bad.blur, 0);
  assert.equal(bad.mode, d.mode);
  assert.equal(bad.accent, d.accent);
  assert.equal(bad.tray, d.tray);
  assert.deepEqual(JSON.parse(JSON.stringify(bad.look)), {});
  const ok = c.sanitizeUi({ alpha: 70, mode: 'dark', accent: '#112233', wall: 'night', extra: 1 });
  assert.equal(ok.alpha, 70); assert.equal(ok.mode, 'dark'); assert.equal(ok.accent, '#112233'); assert.equal(ok.extra, 1);
  for (const junk of [null, [], 'text', 42, undefined]) assert.equal(c.sanitizeUi(junk).preset, d.preset);
});

/* ---------- клиент: слияние дублей ---------- */
test('dupParts сводит варианты одного трека к одному ключу', () => {
  const c = load(['norm', 'dupParts', 'artistsOverlap', 'durOk']);
  const a = c.dupParts({ title: 'Blinding Lights', artist: 'The Weeknd' });
  const b = c.dupParts({ title: 'The Weeknd - Blinding Lights (Official Video)', artist: 'The Weeknd' });
  assert.equal(a[0], b[0]);
  assert.ok(c.artistsOverlap(a[1], b[1]));
  assert.ok(c.durOk(200000, 203000));
  assert.ok(!c.durOk(200000, 260000));
  assert.ok(c.durOk(0, 260000));
  assert.notEqual(c.dupParts({ title: 'Other Song', artist: 'The Weeknd' })[0], a[0]);
  assert.doesNotThrow(() => c.dupParts({}));
});

/* ---------- клиент: импорт тем ---------- */
const THEME_DEPS = ['isNum', 'hexOrNull', 'HEX_RE', 'GRAD_TYPES', 'GRAD_MIN_STOPS', 'GRAD_MAX_STOPS', 'GRAD_DEFAULT', 'normalizeGrad', 'validateGrad', 'WALLS', 'FONTS', 'BLOCKS', 'CSS_MAX', 'cssProblem', 'cssBalanced', 'validateTheme'];
test('validateTheme принимает хорошую тему и отвергает чужие поля и плохие значения', () => {
  const c = load(THEME_DEPS);
  assert.ok(c.validateTheme({ mode: 'dark', accent: '#aabbcc', alpha: 50, blur: 20 }).theme);
  assert.ok(c.validateTheme({ evil: 1 }).error);
  assert.ok(c.validateTheme({ mode: 'neon' }).error);
  assert.ok(c.validateTheme({ accent: 'javascript:alert(1)' }).error);
  assert.ok(c.validateTheme({ alpha: 1e9 }).error);
  assert.ok(c.validateTheme({ wall: '__proto__' }).error);
  assert.ok(c.validateTheme({ look: { css: 'body{background:url(http://evil.example/x.png)}' } }).error, 'внешние ссылки в CSS не принимаются');
  assert.ok(c.validateTheme({ look: { css: '@import url(//evil/x.css);' } }).error);
  assert.ok(c.validateTheme({}).error);
  assert.ok(c.validateTheme(null).error);
  assert.ok(c.validateTheme([]).error);
});

/* ---------- клиент: копия библиотеки ---------- */
const BK_DEPS = ['isNum', 'BK_FORMAT', 'BK_MAX_BYTES', 'BK_ID_RE', 'BK_URL_HOSTS', 'BK_COVER_RE', 'bkClean', 'bkValidateTrack', 'validateBackup', 'bkToSlim'];
const goodBackup = () => ({
  format: 'nakazmusic-backup', version: 1, createdAt: '2026-10-30T10:00:00.000Z', app: 'nakazmusic 3.5.0',
  likes: { sp: [{ src: 'sp', id: '4uLU6hMCjMI75M1A2tKUQC', title: 'A 🎵', artist: 'Б', uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', duration: 1000 }], yt: [{ src: 'yt', id: 'dQw4w9WgXcQ', title: 'T', artist: '' }] },
  playlists: [{ name: 'Мой', tracks: [{ src: 'sc', id: '123', title: 'x', artist: 'y', url: 'https://soundcloud.com/a/b' }] }],
});
test('validateBackup принимает правильную копию и чистит значения', () => {
  const c = load(BK_DEPS);
  const r = c.validateBackup(JSON.stringify(goodBackup()));
  assert.ok(r.data, r.error);
  assert.equal(r.data.likes.sp.length, 1);
  assert.equal(r.data.playlists[0].tracks[0].id, '123');
  assert.equal(c.bkToSlim(r.data.likes.yt[0]).cover, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
});
test('validateBackup отвергает лишнее, чужие ссылки и мусор', () => {
  const c = load(BK_DEPS);
  const v = (mut) => { const d = goodBackup(); mut(d); return c.validateBackup(JSON.stringify(d)).error; };
  assert.ok(v((d) => { d.evil = 1; }));
  assert.ok(v((d) => { d.version = 2; }));
  assert.ok(v((d) => { d.format = 'other'; }));
  assert.ok(v((d) => { d.likes.sp[0].url = 'https://evil.com/x'; }));
  assert.ok(v((d) => { d.likes.sp[0].url = 'http://open.spotify.com/track/x'; }));
  assert.ok(v((d) => { d.likes.sp[0].id = 'bad id!'; }));
  assert.ok(v((d) => { d.likes.sp[0].extra = 1; }));
  assert.ok(v((d) => { d.likes.sp[0].cover = 'https://evil.com/c.jpg'; }));
  assert.ok(v((d) => { d.likes.sp[0].uri = 'spotify:track:other'; }));
  assert.ok(v((d) => { d.likes.sp[0].title = ''; }));
  assert.ok(v((d) => { d.likes.yt[0].src = 'sp'; }), 'трек другого источника в чужом списке');
  assert.ok(v((d) => { d.playlists[0].name = ''; }));
  assert.ok(v((d) => { d.connections = { sc_user: '<script>' }; }));
  assert.ok(v((d) => { d.likes = {}; d.playlists = []; }), 'пустая копия');
  assert.ok(c.validateBackup('не json').error);
  assert.ok(c.validateBackup('null').error);
  assert.ok(c.validateBackup('[]').error);
  assert.ok(c.validateBackup('x'.repeat(41e6)).error);
});
test('validateBackup не ломается на эмодзи, странных символах и пустом артисте', () => {
  const c = load(BK_DEPS);
  const d = goodBackup();
  d.likes.sp[0].title = '😀‮<b>"\'&</b>\n\t';
  const r = c.validateBackup(JSON.stringify(d));
  assert.ok(r.data, r.error);
  assert.ok(!/[\u0000-\u001f]/.test(r.data.likes.sp[0].title));
});

test('копии из прежних версий (формат sonara-backup) тоже принимаются, новые пишутся как nakazmusic-backup', () => {
  const c = load(BK_DEPS);
  const old = goodBackup(); old.format = 'sonara-backup';
  assert.ok(c.validateBackup(JSON.stringify(old)).data, 'старый формат');
  assert.ok(c.validateBackup(JSON.stringify(goodBackup())).data, 'новый формат');
  assert.equal(c.BK_FORMAT, 'nakazmusic-backup');
});
