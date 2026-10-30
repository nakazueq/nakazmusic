'use strict';
// Проект переименован из Sonara в nakazmusic. Старое имя может остаться только там, где оно нужно по делу:
// чтение файлов прежних версий (копии, темы, папка в Документах), запись об истории в README и CHANGELOG.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'build', '.git', 'release']);
const SKIP_FILES = new Set(['package-lock.json']);
const TEXT = /\.(js|mjs|cjs|json|html|css|md|bat|cs|svg|txt)$|^\.gitignore$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (TEXT.test(e.name) && !SKIP_FILES.has(e.name)) out.push(path.join(dir, e.name));
  }
  return out;
}

// строки, где старое имя допустимо
const ALLOWED = [
  /sonara-(backup|theme)/i,                 // формат файлов из прежних версий принимаем при чтении
  /\(\?:nakazmusic\|sonara\)/,              // то же в регулярке имён файлов копий
  /'Sonara'\)/,                             // старая папка Документы\Sonara переезжает на новое имя
  /Документы[\\/]Sonara/,
  /Formerly named Sonara|Раньше называлась Sonara/,
  /SONARA_/,                                // старые имена переменных окружения как запасные
  /taskkill .*Sonara\.exe/,                 // при пересборке закрываем и старый процесс
];

test('старое имя Sonara остаётся только там, где это нужно', () => {
  const bad = [];
  for (const f of walk(root)) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    if (rel === 'CHANGELOG.md' || rel === 'tests/rename.test.js') continue;   // история изменений и этот тест
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/sonara/i.test(line) && !ALLOWED.some((re) => re.test(line))) bad.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('папка данных осталась прежней, чтобы настройки не потерялись', () => {
  assert.match(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), /'MyPlayer'\);/);
});

test('имя exe, продукта и репозитория новые', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.name, 'nakazmusic');
  assert.equal(pkg.productName, 'nakazmusic');
  assert.match(pkg.repository.url, /nakazueq\/nakazmusic\.git$/);
  assert.match(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), /const UPDATE_REPO = 'nakazueq\/nakazmusic';/);
  assert.match(fs.readFileSync(path.join(root, 'tools/build.mjs'), 'utf8'), /const NAME = 'nakazmusic';/);
});
