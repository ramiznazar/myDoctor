/**
 * Safely create or rotate an administrator account.
 *
 * Required environment variables:
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional:
 *   ADMIN_NAME, ADMIN_CURRENT_EMAIL
 *
 * Use ADMIN_CURRENT_EMAIL when changing an existing admin email. It updates
 * that same record instead of creating a second administrator.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL);
const ADMIN_CURRENT_EMAIL = normalizeEmail(process.env.ADMIN_CURRENT_EMAIL);
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
const ADMIN_NAME = String(process.env.ADMIN_NAME || 'My Doctor Administrator').trim();
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

const fail = (message) => { throw new Error(message); };

async function seedAdmin() {
  if (!MONGODB_URI) fail('MONGO_URI (or MONGODB_URI/DATABASE_URL) is required.');
  if (!ADMIN_EMAIL) fail('ADMIN_EMAIL is required.');
  if (ADMIN_PASSWORD.length < 12) fail('ADMIN_PASSWORD must be at least 12 characters long.');

  try {
    await mongoose.connect(MONGODB_URI);

    let admin = ADMIN_CURRENT_EMAIL
      ? await User.findOne({ email: ADMIN_CURRENT_EMAIL }).select('+password')
      : await User.findOne({ email: ADMIN_EMAIL }).select('+password');

    if (admin && admin.role !== 'ADMIN') {
      fail('The selected current email belongs to a non-admin account. Refusing to change it.');
    }

    if (!admin) {
      const accountWithTargetEmail = await User.findOne({ email: ADMIN_EMAIL });
      if (accountWithTargetEmail) fail('The requested admin email already belongs to another account.');
      admin = new User({ email: ADMIN_EMAIL, fullName: ADMIN_NAME, role: 'ADMIN', status: 'APPROVED' });
      console.log('Creating administrator account.');
    } else {
      const accountWithTargetEmail = await User.findOne({ email: ADMIN_EMAIL, _id: { $ne: admin._id } });
      if (accountWithTargetEmail) fail('The requested admin email already belongs to another account.');
      console.log('Updating the existing administrator account.');
    }

    // The user model hashes a plain password on save. Never print it.
    admin.email = ADMIN_EMAIL;
    admin.password = ADMIN_PASSWORD;
    admin.fullName = ADMIN_NAME;
    admin.role = 'ADMIN';
    admin.status = 'APPROVED';
    admin.isEmailVerified = true;
    admin.emailVerificationRequired = false;
    await admin.save();

    const saved = await User.findById(admin._id).select('+password');
    if (!saved || !(await bcrypt.compare(ADMIN_PASSWORD, saved.password))) {
      fail('Credential verification failed; no login credentials were displayed.');
    }

    console.log(`Administrator credentials updated for ${saved.email}.`);
    console.log('Password verification passed.');
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

seedAdmin().catch((error) => {
  console.error(`Admin credential update failed: ${error.message}`);
  process.exitCode = 1;
});
