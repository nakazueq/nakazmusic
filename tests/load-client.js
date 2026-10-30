'use strict';
// Достаёт нужные объявления из public/app.js и выполняет их в изолированном контексте: сама страница без DOM не запускается,
// а проверять хочется именно настоящий код, а не его копию.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const core = require('../public/locales/core.js');
const i18n = core.create({ ru: require('../public/locales/ru.js'), en: require('../public/locales/en.js') }, 'ru');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8').split('\n');

// объявление начинается со строки `function name(` / `const name =` и тянется до тех пор, пока кусок не станет корректным JS
function declaration(name) {
  // `const A = 1, B = 2;` тоже находим: имя может стоять после запятой в одной строке объявления
  const re = new RegExp(`^(async )?function ${name}\\b|^(const|let) ${name}\\b|^(const|let) [^=(]*=[^;]*,\\s*${name}\\s*=`);
  const start = SRC.findIndex((l) => re.test(l));
  if (start < 0) throw new Error('в app.js нет объявления ' + name);
  for (let end = start; end < Math.min(SRC.length, start + 400); end++) {
    const chunk = SRC.slice(start, end + 1).join('\n');
    try { new vm.Script(chunk); return chunk; } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
  }
  throw new Error('не удалось вырезать объявление ' + name);
}

function load(names, extra = {}) {
  const ctx = vm.createContext({ T: i18n.t, I18N: i18n, console, Date, Math, JSON, Object, Array, Number, String, Boolean, URL, RegExp, Set, Map, ...extra });
  vm.runInContext([...new Set(names.map(declaration))].join('\n'), ctx);   // одна строка может объявлять несколько имён сразу
  return vm.runInContext('({' + names.join(',') + '})', ctx);
}

module.exports = { load, declaration };
