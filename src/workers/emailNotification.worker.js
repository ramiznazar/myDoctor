const { processPendingEmails } = require('../services/email.service');
const { runSubscriptionNotifications } = require('../services/subscriptionNotification.service');

const runEmailNotifications = async () => {
  const [outbox, subscriptions] = await Promise.all([
    processPendingEmails(),
    runSubscriptionNotifications(),
  ]);
  return { outbox, subscriptions };
};

module.exports = { runEmailNotifications };
