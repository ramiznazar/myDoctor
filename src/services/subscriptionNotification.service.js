const User = require('../models/user.model');
const { sendSubscriptionExpiryReminder } = require('./email.service');

const sameInstant = (left, right) => left && right && new Date(left).getTime() === new Date(right).getTime();

/**
 * Queue the seven-day and expired-subscription emails. The durable outbox
 * provides a second layer of deduplication; the persisted dates prevent this
 * minute-level worker from repeatedly scanning and queuing old subscriptions.
 */
const runSubscriptionNotifications = async () => {
  const now = new Date();
  const reminderStart = new Date(now.getTime() + (6.5 * 24 * 60 * 60 * 1000));
  const reminderEnd = new Date(now.getTime() + (7.5 * 24 * 60 * 60 * 1000));
  const base = { role: { $in: ['DOCTOR', 'PHARMACY'] }, subscriptionPlan: { $ne: null }, subscriptionExpiresAt: { $ne: null } };
  const [expiring, expired] = await Promise.all([
    User.find({ ...base, subscriptionExpiresAt: { $gte: reminderStart, $lte: reminderEnd } }).populate('subscriptionPlan').limit(200),
    User.find({ ...base, subscriptionExpiresAt: { $lte: now } }).populate('subscriptionPlan').sort({ subscriptionExpiresAt: -1 }).limit(200),
  ]);
  let queued = 0;
  for (const user of expiring) {
    if (sameInstant(user.subscriptionReminderSentFor, user.subscriptionExpiresAt)) continue;
    await sendSubscriptionExpiryReminder({ user, plan: user.subscriptionPlan, expiresAt: user.subscriptionExpiresAt });
    user.subscriptionReminderSentFor = user.subscriptionExpiresAt;
    await user.save();
    queued += 1;
  }
  for (const user of expired) {
    if (sameInstant(user.subscriptionExpirationEmailSentFor, user.subscriptionExpiresAt)) continue;
    await sendSubscriptionExpiryReminder({ user, plan: user.subscriptionPlan, expiresAt: user.subscriptionExpiresAt, expired: true });
    user.subscriptionExpirationEmailSentFor = user.subscriptionExpiresAt;
    await user.save();
    queued += 1;
  }
  return { queued };
};

module.exports = { runSubscriptionNotifications };
