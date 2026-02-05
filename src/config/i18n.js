const DEFAULT_LANG = process.env.DEFAULT_LANG || 'en';

const SUPPORTED_LANGS = String(process.env.SUPPORTED_LANGS || 'en,it,es,fr,de,pt,ru,tr,ar,hi,id,ja,ko,th,vi,zh-CN,zh-TW')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
};
