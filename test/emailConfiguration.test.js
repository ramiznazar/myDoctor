const test = require('node:test');
const assert = require('node:assert/strict');

const env = require('../src/config/env');
const { inspectSmtpConfiguration } = require('../src/services/email.service');

const SMTP_KEYS = [
  'EMAIL_ENABLED', 'EMAIL_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
  'SMTP_REQUIRE_TLS', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_REPLY_TO',
  'SMTP_ENVELOPE_FROM', 'SMTP_MESSAGE_ID_DOMAIN',
];
const original = Object.fromEntries(SMTP_KEYS.map((key) => [key, env[key]]));

const configureAruba = () => Object.assign(env, {
  EMAIL_ENABLED: true,
  EMAIL_PROVIDER: 'aruba',
  SMTP_HOST: 'smtps.aruba.it',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_REQUIRE_TLS: true,
  SMTP_USER: 'noreply@mydoctorplus.it',
  SMTP_PASS: 'test-only-password',
  SMTP_FROM: 'noreply@mydoctorplus.it',
  SMTP_REPLY_TO: 'support@mydoctorplus.it',
  SMTP_ENVELOPE_FROM: 'noreply@mydoctorplus.it',
  SMTP_MESSAGE_ID_DOMAIN: 'mydoctorplus.it',
});

test.after(() => Object.assign(env, original));

test('accepts an aligned Aruba STARTTLS sender configuration', () => {
  configureAruba();
  const configuration = inspectSmtpConfiguration();

  assert.equal(configuration.valid, true);
  assert.deepEqual(configuration.errors, []);
  assert.equal(configuration.host, 'smtps.aruba.it');
  assert.equal(configuration.envelopeFrom, configuration.from);
});

test('blocks a Gmail host when the configured provider is Aruba', () => {
  configureAruba();
  env.SMTP_HOST = 'smtp.gmail.com';

  const configuration = inspectSmtpConfiguration();

  assert.equal(configuration.valid, false);
  assert.ok(configuration.errors.includes('SMTP_HOST_NOT_ARUBA'));
});

test('blocks an unaligned envelope sender domain', () => {
  configureAruba();
  env.SMTP_ENVELOPE_FROM = 'noreply@example.com';

  const configuration = inspectSmtpConfiguration();

  assert.equal(configuration.valid, false);
  assert.ok(configuration.errors.includes('SMTP_ENVELOPE_FROM_DOMAIN_MISMATCH'));
});
