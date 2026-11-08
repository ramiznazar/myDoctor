const Product = require('../models/product.model');
const notificationService = require('./notification.service');

const numeric = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const thresholdFor = (variant, product) => (
  variant?.lowStockThreshold === null || variant?.lowStockThreshold === undefined
    ? numeric(product.lowStockThreshold, 5)
    : numeric(variant.lowStockThreshold, 5)
);

/**
 * Update low-stock state and send one notification for each new low-stock
 * transition. This is deliberately invoked after a committed stock change so
 * a failed checkout can never create a misleading inventory alert.
 */
const assessLowStockForProduct = async (productId) => {
  const product = await Product.findById(productId);
  if (!product || !product.sellerId) return { alerts: 0 };

  const alerts = [];
  let changed = false;
  const activeVariants = (product.variants || []).filter((variant) => variant.isActive !== false);

  if (activeVariants.length) {
    activeVariants.forEach((variant) => {
      const stock = numeric(variant.stock);
      const threshold = thresholdFor(variant, product);
      const isLow = stock <= threshold;
      if (isLow && !variant.lowStockAlertActive) {
        variant.lowStockAlertActive = true;
        variant.lowStockAlertAt = new Date();
        alerts.push({ name: variant.name || product.name, stock, threshold, variantId: variant._id?.toString() });
        changed = true;
      } else if (!isLow && variant.lowStockAlertActive) {
        variant.lowStockAlertActive = false;
        variant.lowStockAlertAt = null;
        changed = true;
      }
    });
  } else {
    const stock = numeric(product.stock);
    const threshold = numeric(product.lowStockThreshold, 5);
    const isLow = stock <= threshold;
    if (isLow && !product.lowStockAlertActive) {
      product.lowStockAlertActive = true;
      product.lowStockAlertAt = new Date();
      alerts.push({ name: product.name, stock, threshold });
      changed = true;
    } else if (!isLow && product.lowStockAlertActive) {
      product.lowStockAlertActive = false;
      product.lowStockAlertAt = null;
      changed = true;
    }
  }

  if (changed) await product.save();
  await Promise.allSettled(alerts.map((alert) => notificationService.createNotification({
    userId: product.sellerId,
    type: 'SYSTEM',
    title: 'Low stock alert',
    body: `${alert.name || 'A product option'} has ${alert.stock} unit${alert.stock === 1 ? '' : 's'} left (alert level: ${alert.threshold}).`,
    data: { event: 'LOW_STOCK', productId: product._id.toString(), variantId: alert.variantId || null, stock: alert.stock, threshold: alert.threshold },
  })));

  return { alerts: alerts.length };
};

module.exports = { assessLowStockForProduct, thresholdFor };
