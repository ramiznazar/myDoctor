const DELIVERY_DAY_OPTIONS = Object.freeze([2, 3, 4, 5]);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DELIVERY_STATUS = Object.freeze({
  AWAITING_DELIVERY: 'AWAITING_DELIVERY',
  ON_TIME: 'ON_TIME',
  DELIVERED: 'DELIVERED',
  LATE: 'LATE',
});

const DELIVERY_PERFORMANCE = Object.freeze({
  PENDING: 'PENDING',
  ON_TIME: 'ON_TIME',
  LATE: 'LATE',
});

const isValidDeliveryDays = (value) => DELIVERY_DAY_OPTIONS.includes(Number(value));

const toUtcCalendarStart = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const calendarDaysBetween = (from, to) => {
  const fromStart = toUtcCalendarStart(from);
  const toStart = toUtcCalendarStart(to);
  if (fromStart === null || toStart === null) return null;
  return Math.max(0, Math.round((toStart - fromStart) / DAY_IN_MS));
};

// Delivery is a date commitment, not a clock-time promise. Noon UTC prevents a
// customer in a different time zone from seeing the expected date move a day.
const calculateExpectedDeliveryDate = (commitmentDate, deliveryDays) => {
  if (!isValidDeliveryDays(deliveryDays)) return null;
  const date = new Date(commitmentDate);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + Number(deliveryDays),
    12, 0, 0, 0,
  ));
};

const deriveDeliveryMonitoring = (order, now = new Date()) => {
  const expectedDeliveryDate = order?.expectedDeliveryDate ? new Date(order.expectedDeliveryDate) : null;
  const actualDeliveredAt = order?.actualDeliveredAt || order?.deliveredAt || null;
  const orderStatus = String(order?.status || '').toUpperCase();
  const commitmentStart = order?.shippingFeeAddedAt || order?.shippingUpdatedAt || order?.requestedAt || order?.createdAt;

  if (!expectedDeliveryDate || Number.isNaN(expectedDeliveryDate.getTime()) || ['CANCELLED', 'REFUNDED'].includes(orderStatus)) {
    return {
      deliveryStatus: DELIVERY_STATUS.AWAITING_DELIVERY,
      deliveryPerformance: DELIVERY_PERFORMANCE.PENDING,
      totalActualDeliveryDays: actualDeliveredAt ? calendarDaysBetween(commitmentStart, actualDeliveredAt) : null,
      daysLate: 0,
    };
  }

  if (actualDeliveredAt) {
    const deliveredAt = new Date(actualDeliveredAt);
    const daysLate = calendarDaysBetween(expectedDeliveryDate, deliveredAt);
    const isLate = daysLate > 0;
    return {
      deliveryStatus: isLate ? DELIVERY_STATUS.LATE : DELIVERY_STATUS.DELIVERED,
      deliveryPerformance: isLate ? DELIVERY_PERFORMANCE.LATE : DELIVERY_PERFORMANCE.ON_TIME,
      totalActualDeliveryDays: calendarDaysBetween(commitmentStart, deliveredAt),
      daysLate: isLate ? daysLate : 0,
    };
  }

  const daysLate = calendarDaysBetween(expectedDeliveryDate, now);
  const isLate = daysLate > 0;
  return {
    deliveryStatus: isLate ? DELIVERY_STATUS.LATE : DELIVERY_STATUS.ON_TIME,
    deliveryPerformance: DELIVERY_PERFORMANCE.PENDING,
    totalActualDeliveryDays: null,
    daysLate: isLate ? daysLate : 0,
  };
};

module.exports = {
  DELIVERY_DAY_OPTIONS,
  DELIVERY_STATUS,
  DELIVERY_PERFORMANCE,
  isValidDeliveryDays,
  calculateExpectedDeliveryDate,
  calendarDaysBetween,
  deriveDeliveryMonitoring,
};
