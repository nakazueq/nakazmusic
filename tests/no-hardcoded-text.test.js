'use strict';
// В коде не должно остаться русских строк: весь текст живёт в словарях public/locales. Комментарии можно писать по-русски.
// Исключения (русские слова в шаблонах поиска и подобное) помечаются комментарием `// i18n-ignore` в той же строке.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const root = path.join(__dirname, '..');
const CYR = /[Ѐ-ӿ]/;

function literals(code, type) {
  const ast = parser.parse(code, { sourceType: type, errorRecovery: false, allowReturnOutsideFunction: true });
  const out = [];
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'StringLiteral' && CYR.test(n.value)) out.push(n);
    if (n.type === 'TemplateElement' && CYR.test(n.value.cooked || n.value.raw)) out.push(n);
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k.endsWith('Comments')) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    }
  };
  walk(ast);
  return out;
}

function scan(file, code, type) {
  const lines = code.split('\n');
  return literals(code, type)
    .filter((n) => !/i18n-ignore/.test(lines[n.loc.start.line - 1]))
    .map((n) => `${file}:${n.loc.start.line}: ${lines[n.loc.start.line - 1].trim().slice(0, 100)}`);
}

const JS = ['server.js', 'discord.js', 'mediakeys.js', 'local.js', 'watchdog.js', 'public/app.js', 'public/i18n.js', 'tools/build.mjs', 'tools/make-icon.mjs', 'tools/release.mjs'];
for (const f of JS) {
  test(`в ${f} нет русских строк`, () => {
    const code = fs.readFileSync(path.join(root, f), 'utf8');
    assert.deepEqual(scan(f, code, f.endsWith('.mjs') ? 'module' : 'script'), []);
  });
}

test('в скриптах внутри html нет русских строк', () => {
  for (const f of ['public/index.html', 'public/mini.html']) {
    const html = fs.readFileSync(path.join(root, 'public', path.basename(f)), 'utf8');
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.deepEqual(scan(f, m[1], 'script'), []);
  }
});

test('каждый ключ T()/LT() из кода есть в словарях', () => {
  const ru = require(path.join(root, 'public/locales/ru.js'));
  const missing = [];
  for (const f of ['server.js', 'discord.js', 'public/app.js', 'public/mini.html']) {
    const code = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of code.matchAll(/\b(?:LT|T|tr)\('([a-z]\.[\w.-]+)'/g)) if (!(m[1] in ru)) missing.push(`${f}: ${m[1]}`);
    for (const m of code.matchAll(/'(@[a-z]\.[\w.-]+)'/g)) if (!((m[1].slice(1)) in ru)) missing.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});
