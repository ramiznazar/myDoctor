const mongoose = require('mongoose');

// One secure, short-lived code store for password resets, authenticated
// password changes, and first-time email verification. The code itself is a
// SHA-256 digest; a database leak never exposes a usable verification code.
const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  purpose: {
    type: String,
    enum: ['PASSWORD_RESET', 'PASSWORD_CHANGE', 'EMAIL_VERIFICATION'],
    default: 'PASSWORD_RESET',
  },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  isUsed: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  attempts: { type: Number, default: 0, min: 0 },
  maxAttempts: { type: Number, default: 5, min: 1 },
}, { timestamps: true });

passwordResetSchema.index({ email: 1, purpose: 1, isUsed: 1, expiresAt: 1 });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
