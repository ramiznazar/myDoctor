const { DEFAULT_LANG, SUPPORTED_LANGS } = require('../config/i18n');

const normalizeLang = (lang) => {
  if (!lang || typeof lang !== 'string') return null;
  const cleaned = lang.trim();
  if (!cleaned) return null;
  return cleaned;
};

const parseAcceptLanguage = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') return [];

  return headerValue
    .split(',')
    .map((part) => {
      const [rawLang, ...params] = part.trim().split(';');
      const lang = normalizeLang(rawLang);
      let q = 1;
      const qParam = params.find((p) => p.trim().startsWith('q='));
      if (qParam) {
        const qValue = Number(String(qParam).trim().slice(2));
        if (!Number.isNaN(qValue)) q = qValue;
      }
      return lang ? { lang, q } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.q - a.q)
    .map((item) => item.lang);
};

const pickSupportedLang = (candidates) => {
  const supported = new Set(SUPPORTED_LANGS);

  for (const cand of candidates) {
    const normalized = normalizeLang(cand);
    if (!normalized) continue;

    if (supported.has(normalized)) return normalized;

    const base = normalized.split('-')[0];
    if (base && supported.has(base)) return base;
  }

  return DEFAULT_LANG;
};

const languageMiddleware = (req, res, next) => {
  const queryLang = normalizeLang(req.query?.lang);
  const headerLangs = parseAcceptLanguage(req.headers['accept-language']);

  const candidates = [];
  if (queryLang) candidates.push(queryLang);
  candidates.push(...headerLangs);

  const lang = pickSupportedLang(candidates);

  req.lang = lang;
  res.setHeader('Content-Language', lang);
  res.setHeader('Vary', 'Accept-Language');

  next();
};

module.exports = languageMiddleware;
