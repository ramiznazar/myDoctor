const mongoose = require('mongoose');

// A single, admin-managed record supplies contact details wherever they are
// shown publicly.  Keeping it in the API prevents the web application and
// footer from gradually diverging as business details change.
const footerOptionSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  supportEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  phoneNumber: { type: String, trim: true, maxlength: 80, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('FooterOption', footerOptionSchema);
