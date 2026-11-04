const FooterOption = require('../models/footerOption.model');

const cleanText = (value, max) => String(value || '').trim().slice(0, max);
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const getFooterOptions = async () => FooterOption.findOneAndUpdate(
  { key: 'default' },
  { $setOnInsert: { key: 'default' } },
  { new: true, upsert: true, setDefaultsOnInsert: true }
).lean();

const updateFooterOptions = async (payload = {}) => {
  const update = {
    address: cleanText(payload.address, 500),
    supportEmail: cleanText(payload.supportEmail, 254).toLowerCase(),
    phoneNumber: cleanText(payload.phoneNumber, 80),
  };
  if (update.supportEmail && !/^\S+@\S+\.\S+$/.test(update.supportEmail)) throw error('Enter a valid support email address');
  return FooterOption.findOneAndUpdate({ key: 'default' }, { $set: update, $setOnInsert: { key: 'default' } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
};

module.exports = { getFooterOptions, updateFooterOptions };
