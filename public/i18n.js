/* Локализация страницы: T('ключ', { n: 5 }) возвращает строку на текущем языке; разметка с data-i18n и data-i18n-attr переводится сама.
   Язык: выбранный в настройках (localStorage 'lang', он же уезжает в store.json), иначе язык Windows/браузера: русский или английский. */
(function () {
  const core = window.NakazmusicI18nCore, dicts = window.NakazmusicLocales || {};
  let saved = '';
  try { saved = localStorage.getItem('lang') || ''; } catch {}
  const i18n = core.create(dicts, core.LANGS.includes(saved) ? saved : core.detect(navigator.languages || [navigator.language]));
  const CYR = /[Ѐ-ӿ]/;
  const textNodes = new WeakMap();   // элемент -> { nodes, lead, trail }: русский текст из разметки запоминаем один раз, чтобы можно было переключаться туда и обратно

  function collect(el) {
    let rec = textNodes.get(el);
    if (rec) return rec;
    const nodes = [], lead = [], trail = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !CYR.test(n.nodeValue)) continue;
      nodes.push(n);
      lead.push(n.nodeValue.match(/^\s*/)[0]);
      trail.push(n.nodeValue.match(/\s*$/)[0]);
    }
    rec = { nodes, lead, trail };
    textNodes.set(el, rec);
    return rec;
  }

  function apply(root) {
    root = root || document;
    for (const el of root.querySelectorAll('[data-i18n]')) {
      const keys = el.dataset.i18n.split(',');
      const rec = collect(el);
      rec.nodes.forEach((n, i) => { if (keys[i]) n.nodeValue = rec.lead[i] + i18n.t(keys[i]) + rec.trail[i]; });
    }
    for (const el of root.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.dataset.i18nAttr.split(';')) {
        const [attr, key] = pair.split('=');
        if (attr && key) el.setAttribute(attr, i18n.t(key));
      }
    }
  }

  function setLanguage(lang) {
    if (!i18n.setLang(lang)) return false;
    document.documentElement.lang = lang;
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    return true;
  }

  window.I18N = Object.assign(i18n, { apply, setLanguage });
  window.T = i18n.t;
  document.documentElement.lang = i18n.lang;
  const run = () => apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
