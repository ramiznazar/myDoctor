const { DEFAULT_LANG, SUPPORTED_LANGS } = require('../config/i18n');

const normalizeLang = (lang) => {
  if (!lang || typeof lang !== 'string') return null;
  const cleaned = lang.trim();
  if (!cleaned) return null;
  return cleaned;
};

const isSupportedLang = (lang) => {
  const normalized = normalizeLang(lang);
  if (!normalized) return false;
  return SUPPORTED_LANGS.includes(normalized) || SUPPORTED_LANGS.includes(normalized.split('-')[0]);
};

const getLocalizedField = ({ baseValue, translations, lang, fallbackLang = DEFAULT_LANG }) => {
  if (!translations || typeof translations !== 'object') return baseValue;

  const getFromTranslations = (key) => {
    if (!key) return undefined;
    if (translations instanceof Map) {
      return translations.get(key);
    }
    if (typeof translations.get === 'function') {
      return translations.get(key);
    }
    return translations[key];
  };

  const normalizedLang = normalizeLang(lang);
  const normalizedFallback = normalizeLang(fallbackLang) || DEFAULT_LANG;

  const tryKeys = [];
  if (normalizedLang) {
    tryKeys.push(normalizedLang);
    const base = normalizedLang.split('-')[0];
    if (base && base !== normalizedLang) tryKeys.push(base);
  }

  if (normalizedFallback) {
    tryKeys.push(normalizedFallback);
    const fbBase = normalizedFallback.split('-')[0];
    if (fbBase && fbBase !== normalizedFallback) tryKeys.push(fbBase);
  }

  for (const key of tryKeys) {
    const value = getFromTranslations(key);
    if (typeof value === 'string' && value.trim() !== '') return value;
    if (Array.isArray(value) && value.length > 0) return value;
    if (value && typeof value === 'object') return value;
  }

  return baseValue;
};

const localizeProduct = (productDoc, lang) => {
  if (!productDoc) return productDoc;

  const obj = typeof productDoc.toObject === 'function' ? productDoc.toObject() : { ...productDoc };
  const i18n = obj.i18n || {};

  obj.name = getLocalizedField({
    baseValue: obj.name,
    translations: i18n.name,
    lang,
  });

  obj.description = getLocalizedField({
    baseValue: obj.description,
    translations: i18n.description,
    lang,
  });

  obj.category = getLocalizedField({
    baseValue: obj.category,
    translations: i18n.category,
    lang,
  });

  obj.subCategory = getLocalizedField({
    baseValue: obj.subCategory,
    translations: i18n.subCategory,
    lang,
  });

  obj.tags = getLocalizedField({
    baseValue: obj.tags,
    translations: i18n.tags,
    lang,
  });

  const localizedDetails = getLocalizedField({
    baseValue: null,
    translations: i18n.details,
    lang,
  });

  if (localizedDetails && typeof localizedDetails === 'object' && !Array.isArray(localizedDetails)) {
    if (localizedDetails.medicineDetails && typeof localizedDetails.medicineDetails === 'object') {
      obj.medicineDetails = { ...(obj.medicineDetails || {}), ...localizedDetails.medicineDetails };
    }
    if (localizedDetails.parapharmacyDetails && typeof localizedDetails.parapharmacyDetails === 'object') {
      obj.parapharmacyDetails = { ...(obj.parapharmacyDetails || {}), ...localizedDetails.parapharmacyDetails };
    }
    if (Array.isArray(localizedDetails.tags) && localizedDetails.tags.length > 0) {
      obj.tags = localizedDetails.tags;
    }
    if (Array.isArray(localizedDetails.variants)) {
      obj.variants = (obj.variants || []).map((variant, index) => {
        const translation = localizedDetails.variants.find((entry) => String(entry?._id || '') === String(variant?._id || '')) || localizedDetails.variants[index];
        return translation && typeof translation === 'object' ? { ...variant, ...translation, _id: variant._id } : variant;
      });
    }
  }

  return obj;
};

const localizeBlogPost = (blogPostDoc, lang) => {
  if (!blogPostDoc) return blogPostDoc;

  const obj = typeof blogPostDoc.toObject === 'function' ? blogPostDoc.toObject() : { ...blogPostDoc };
  const i18n = obj.i18n || {};

  obj.title = getLocalizedField({
    baseValue: obj.title,
    translations: i18n.title,
    lang,
  });

  obj.content = getLocalizedField({
    baseValue: obj.content,
    translations: i18n.content,
    lang,
  });

  obj.tags = getLocalizedField({
    baseValue: obj.tags,
    translations: i18n.tags,
    lang,
  });

  return obj;
};

const localizeAnnouncement = (announcementDoc, lang) => {
  if (!announcementDoc) return announcementDoc;

  const obj = typeof announcementDoc.toObject === 'function' ? announcementDoc.toObject() : { ...announcementDoc };
  const i18n = obj.i18n || {};

  obj.title = getLocalizedField({
    baseValue: obj.title,
    translations: i18n.title,
    lang,
  });

  obj.message = getLocalizedField({
    baseValue: obj.message,
    translations: i18n.message,
    lang,
  });

  return obj;
};

const localizeNotification = (notificationDoc, lang) => {
  if (!notificationDoc) return notificationDoc;

  const obj = typeof notificationDoc.toObject === 'function' ? notificationDoc.toObject() : { ...notificationDoc };
  const i18n = obj.i18n || {};

  obj.title = getLocalizedField({
    baseValue: obj.title,
    translations: i18n.title,
    lang,
  });

  obj.body = getLocalizedField({
    baseValue: obj.body,
    translations: i18n.body,
    lang,
  });

  return obj;
};

module.exports = {
  normalizeLang,
  isSupportedLang,
  getLocalizedField,
  localizeProduct,
  localizeBlogPost,
  localizeAnnouncement,
  localizeNotification,
};
