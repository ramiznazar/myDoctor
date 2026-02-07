const twilio = require('twilio');
const config = require('../config/env');

const getTwilioClient = () => {
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials are not configured');
  }
  return twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
};

const getVerifyServiceSid = () => {
  if (!config.TWILIO_VERIFY_SERVICE_SID) {
    throw new Error('Twilio Verify Service SID is not configured');
  }
  return config.TWILIO_VERIFY_SERVICE_SID;
};

const sendPhoneOtp = async (phone) => {
  if (!phone) {
    throw new Error('Phone is required');
  }

  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  const result = await client.verify.v2
    .services(serviceSid)
    .verifications.create({ to: phone, channel: 'sms' });

  return result;
};

const verifyPhoneOtp = async (phone, code) => {
  if (!phone) {
    throw new Error('Phone is required');
  }
  if (!code) {
    throw new Error('Verification code is required');
  }

  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();

  const result = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: phone, code: String(code) });

  return result;
};

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp
};
