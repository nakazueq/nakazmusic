/* Ядро локализации: общее для страницы и сервера (UMD). Словарь плоский: ключ -> строка или набор форм { one, few, many, other }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NakazmusicI18nCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const LANGS = ['ru', 'en'];
  const LOCALE = { ru: 'ru-RU', en: 'en-US' };

  // русский, если система или браузер на русском (или близком: украинский, белорусский), иначе английский
  function detect(list) {
    const arr = Array.isArray(list) ? list : [list];
    for (const l of arr) {
      const s = String(l || '').toLowerCase();
      if (/^(ru|uk|be)\b/.test(s)) return 'ru';
      if (/^en\b/.test(s)) return 'en';
    }
    return 'en';
  }

  function create(dicts, initial) {
    let lang = LANGS.includes(initial) ? initial : 'en';
    let rules = new Intl.PluralRules(LOCALE[lang]);
    const fmtCache = {};
    const api = {
      LANGS,
      get lang() { return lang; },
      get locale() { return LOCALE[lang]; },
      setLang(l) {
        if (!LANGS.includes(l) || l === lang) return false;
        lang = l; rules = new Intl.PluralRules(LOCALE[lang]);
        for (const k of Object.keys(fmtCache)) delete fmtCache[k];
        return true;
      },
      has(key) { return !!dicts[lang] && key in dicts[lang]; },
      // t('key', { n: 5, name: 'x' }): подстановка {name}; если значение это набор форм, выбор по params.n
      t(key, params, forceLang) {
        const l = forceLang || lang;
        let v = dicts[l] && dicts[l][key];
        if (v == null && dicts.ru) v = dicts.ru[key];
        if (v == null) return key;
        if (typeof v === 'object') {
          const n = params && Number.isFinite(Number(params.n)) ? Number(params.n) : 0;
          const cat = (forceLang && forceLang !== lang ? new Intl.PluralRules(LOCALE[l]) : rules).select(n);
          v = v[cat] != null ? v[cat] : v.other != null ? v.other : v.many != null ? v.many : '';
        }
        if (!params) return v;
        return v.replace(/\{(\w+)\}/g, (m, k) => (k in params ? (k === 'n' ? api.num(params[k]) : String(params[k])) : m));
      },
      num(n) { return (fmtCache.num || (fmtCache.num = new Intl.NumberFormat(LOCALE[lang]))).format(n); },
      date(ms, opts) { return new Date(ms).toLocaleDateString(LOCALE[lang], opts || { day: '2-digit', month: '2-digit', year: 'numeric' }); },
      dateTime(ms) { return new Date(ms).toLocaleString(LOCALE[lang], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
      time(ms) { return new Date(ms).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }); },
    };
    return api;
  }

  return { LANGS, LOCALE, detect, create };
});
