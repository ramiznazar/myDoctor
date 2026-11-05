const { inspectSmtpConfiguration, verifySmtpConnection } = require('../services/email.service');

(async () => {
  const configuration = inspectSmtpConfiguration();
  if (!configuration.valid) {
    console.error('[email] SMTP configuration check failed', {
      provider: configuration.provider,
      host: configuration.host || null,
      port: configuration.port || null,
      errors: configuration.errors,
      warnings: configuration.warnings,
    });
    process.exitCode = 1;
    return;
  }

  const result = await verifySmtpConnection();
  process.exitCode = result.verified ? 0 : 1;
})();
