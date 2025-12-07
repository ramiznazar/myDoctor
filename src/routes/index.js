const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Mount all route modules
router.use('/auth', require('./auth.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/admin/subscription-plan', require('./subscriptionPlan.routes'));
router.use('/users', require('./user.routes'));
router.use('/doctor', require('./doctor.routes'));
router.use('/specialization', require('./specialization.routes'));
router.use('/subscription', require('./subscription.routes'));
router.use('/appointment', require('./appointment.routes'));
router.use('/video', require('./videoSession.routes'));
router.use('/chat', require('./chat.routes'));
router.use('/products', require('./product.routes'));
router.use('/pharmacy', require('./pharmacy.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/favorite', require('./favorite.routes'));
router.use('/blog', require('./blog.routes'));
router.use('/notification', require('./notification.routes'));
router.use('/transaction', require('./transaction.routes'));
router.use('/upload', require('./upload.routes'));

module.exports = router;
