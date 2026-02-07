const dotenv = require("dotenv");
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED = ["MONGO_URI", "JWT_SECRET", "REFRESH_TOKEN_SECRET", "PORT"];

// Optional but recommended for video calls
const RECOMMENDED = ["STREAM_API_KEY", "STREAM_API_SECRET"];

REQUIRED.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

module.exports = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,

  MONGO_URI: process.env.MONGO_URI,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",

  // uploads
  UPLOAD_PROFILE: process.env.UPLOAD_PROFILE,
  UPLOAD_DOCTOR_DOCS: process.env.UPLOAD_DOCTOR_DOCS,
  UPLOAD_CLINIC: process.env.UPLOAD_CLINIC,
  UPLOAD_PRODUCT: process.env.UPLOAD_PRODUCT,
  UPLOAD_BLOG: process.env.UPLOAD_BLOG,
  UPLOAD_PHARMACY: process.env.UPLOAD_PHARMACY,
  UPLOAD_GENERAL: process.env.UPLOAD_GENERAL,

  // email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // payment
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_SECRET: process.env.PAYPAL_SECRET,

  // video
  WEBRTC_API_KEY: process.env.WEBRTC_API_KEY,
  WEBRTC_SECRET: process.env.WEBRTC_SECRET,

  // Stream Video SDK
  STREAM_API_KEY: process.env.STREAM_API_KEY,
  STREAM_API_SECRET: process.env.STREAM_API_SECRET,

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID,

  // CRM API Key for external CRM integration
  CRM_API_KEY: process.env.CRM_API_KEY,

  // Reschedule Request Configuration
  RESCHEDULE_REQUEST_DEADLINE_DAYS: process.env.RESCHEDULE_REQUEST_DEADLINE_DAYS || 7,
  RESCHEDULE_DEFAULT_FEE_PERCENTAGE: process.env.RESCHEDULE_DEFAULT_FEE_PERCENTAGE || 50,
  RESCHEDULE_MIN_FEE: process.env.RESCHEDULE_MIN_FEE || 5,
  RESCHEDULE_DOCTOR_RESPONSE_DEADLINE_HOURS: process.env.RESCHEDULE_DOCTOR_RESPONSE_DEADLINE_HOURS || 48,
  RESCHEDULE_PAYMENT_DEADLINE_HOURS: process.env.RESCHEDULE_PAYMENT_DEADLINE_HOURS || 24,
};

// Warn if Stream credentials are missing (but don't fail startup)
if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
  console.warn('⚠️  WARNING: Stream API credentials are not set. Video calling will not work.');
  console.warn('⚠️  Please set STREAM_API_KEY and STREAM_API_SECRET in your .env file');
}
