'use strict';
// Словари ru и en: одинаковый набор ключей, нет пустых значений, формы множественного числа и подстановки согласованы.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'locales');
const core = require(path.join(dir, 'core.js'));
const dicts = { ru: require(path.join(dir, 'ru.js')), en: require(path.join(dir, 'en.js')) };
const CYR = /[Ѐ-ӿ]/;
const forms = (v) => (typeof v === 'object' ? Object.values(v) : [v]);
const vars = (v) => [...new Set(forms(v).join(' ').match(/\{\w+\}/g) || [])].sort().join(',');

test('в обоих словарях одинаковый набор ключей', () => {
  const ru = Object.keys(dicts.ru), en = Object.keys(dicts.en);
  assert.deepEqual(ru.filter((k) => !(k in dicts.en)), [], 'нет в en');
  assert.deepEqual(en.filter((k) => !(k in dicts.ru)), [], 'нет в ru');
});

test('нет пустых значений и пустых форм', () => {
  for (const [lang, d] of Object.entries(dicts)) {
    for (const [k, v] of Object.entries(d)) {
      assert.ok(v !== null && v !== undefined, `${lang}:${k} пусто`);
      for (const f of forms(v)) assert.ok(typeof f === 'string' && f.trim() !== '', `${lang}:${k} пустая форма`);
    }
  }
});

test('наборы форм содержат other, а подстановки {x} совпадают в ru и en', () => {
  for (const k of Object.keys(dicts.ru)) {
    for (const lang of ['ru', 'en']) {
      const v = dicts[lang][k];
      if (typeof v === 'object') assert.ok(typeof v.other === 'string', `${lang}:${k} без формы other`);
    }
    assert.equal(vars(dicts.en[k]), vars(dicts.ru[k]), `подстановки ${k} различаются`);
  }
});

test('в английском словаре нет русских букв', () => {
  for (const [k, v] of Object.entries(dicts.en)) for (const f of forms(v)) assert.ok(!CYR.test(f), `en:${k} содержит кириллицу: ${f}`);
});

test('t(): подстановки, множественные числа, запасной язык', () => {
  const I = core.create({ ru: { a: { one: '{n} трек', few: '{n} трека', many: '{n} треков', other: '{n} трека' }, b: 'Привет, {name}', only: 'только ру' }, en: { a: { one: '{n} track', other: '{n} tracks' }, b: 'Hi, {name}' } }, 'ru');
  assert.equal(I.t('a', { n: 1 }), '1 трек');
  assert.equal(I.t('a', { n: 3 }), '3 трека');
  assert.equal(I.t('a', { n: 5 }), '5 треков');
  assert.equal(I.t('a', { n: 21 }), '21 трек');
  assert.equal(I.t('a', { n: 11 }), '11 треков');
  assert.equal(I.t('b', { name: 'Аня' }), 'Привет, Аня');
  assert.equal(I.t('нет такого ключа'), 'нет такого ключа');
  I.setLang('en');
  assert.equal(I.t('a', { n: 1 }), '1 track');
  assert.equal(I.t('a', { n: 2 }), '2 tracks');
  assert.equal(I.t('only'), 'только ру', 'нет перевода: показываем русский, а не ключ');
  assert.equal(I.t('a', { n: 1234 }), '1,234 tracks');
});

test('язык по умолчанию: русский для русской системы, иначе английский', () => {
  assert.equal(core.detect(['ru-RU', 'en-US']), 'ru');
  assert.equal(core.detect('uk-UA'), 'ru');
  assert.equal(core.detect(['en-GB']), 'en');
  assert.equal(core.detect(['de-DE', 'ru']), 'ru', 'берём первый из поддерживаемых языков в списке предпочтений');
  assert.equal(core.detect(['de-DE', 'fr']), 'en');
  assert.equal(core.detect([]), 'en');
  assert.equal(core.detect(undefined), 'en');
});

test('все ключи из разметки есть в словарях', () => {
  for (const f of ['index.html', 'mini.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
    const keys = [];
    for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) keys.push(...m[1].split(','));
    for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) keys.push(...m[1].split(';').map((p) => p.split('=')[1]));
    for (const k of keys) assert.ok(k in dicts.ru && k in dicts.en, `${f}: нет ключа ${k}`);
  }
});
