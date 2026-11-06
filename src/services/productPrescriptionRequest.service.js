const ProductPrescriptionRequest = require('../models/productPrescriptionRequest.model');
const Product = require('../models/product.model');
const Pharmacy = require('../models/pharmacy.model');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const { localizeProduct } = require('../utils/localization');

const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const resolveVariant = (product, variantId) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (variantId) return variants.find((variant) => String(variant._id) === String(variantId)) || null;
  return variants.find((variant) => variant.isDefault) || variants[0];
};

const getPrescriptionProduct = async (productId) => {
  const product = await Product.findById(productId).lean();
  if (!product) throw httpError('Product not found', 404);
  if (!product.requiresPrescription) throw httpError('This product does not require a prescription');
  if (!['PHARMACY', 'PARAPHARMACY'].includes(String(product.sellerType).toUpperCase())) {
    throw httpError('Prescription requests are only available for pharmacy products');
  }
  return product;
};

const getSellerForProduct = async (product) => {
  const pharmacy = await Pharmacy.findOne({ ownerId: product.sellerId }).lean();
  if (!pharmacy?.ownerId || !pharmacy.isActive) throw httpError('This seller is not available');
  return pharmacy;
};

const notify = async (userId, title, body, type, data) => {
  try {
    await notificationService.createNotification({ userId, title, body, type, data });
  } catch (error) {
    console.error('Unable to create product prescription notification:', error.message);
  }
};

// A persistent, deduplicated approval notification means a patient sees the
// purchase-ready prompt once even if the review or notification request is
// retried. It also backfills approvals created before the notifier was added.
const ensureApprovalNotification = async (request, productName) => {
  const prescriptionRequestId = String(request?._id || '');
  if (!prescriptionRequestId) return;
  const existing = await Notification.exists({
    userId: request.patientId,
    type: 'PRESCRIPTION_APPROVED',
    'data.prescriptionRequestId': prescriptionRequestId,
  });
  if (existing) return;
  await notificationService.createNotification({
    userId: request.patientId,
    title: 'Prescription approved',
    body: `Your prescription for ${productName || 'this product'} has been approved. You can now purchase it.`,
    type: 'PRESCRIPTION_APPROVED',
    data: {
      prescriptionRequestId,
      productId: String(request.productId),
      variantId: request.variantId ? String(request.variantId) : null,
    },
  });
};

const submitRequest = async (patientId, data) => {
  const { productId, variantId, prescriptionUrl, originalName, mimeType } = data || {};
  if (!String(prescriptionUrl || '').trim()) throw httpError('Prescription file is required');
  const [patient, product] = await Promise.all([User.findById(patientId).select('role').lean(), getPrescriptionProduct(productId)]);
  if (!patient || patient.role !== 'PATIENT') throw httpError('Patient not found', 404);
  const variant = resolveVariant(product, variantId);
  if (product.variants?.length && !variant) throw httpError('Selected product variant is no longer available');
  if (variant?.isActive === false) throw httpError('Selected product variant is inactive');
  const pharmacy = await getSellerForProduct(product);
  const existing = await ProductPrescriptionRequest.findOne({ patientId, productId: product._id, variantId: variant?._id || null, status: 'PENDING' }).lean();
  if (existing) throw httpError('Your prescription for this product is already under review', 409);
  const request = await ProductPrescriptionRequest.create({
    patientId, productId: product._id, variantId: variant?._id || null, pharmacyId: pharmacy._id,
    pharmacyOwnerId: pharmacy.ownerId, prescriptionUrl: String(prescriptionUrl).trim(),
    originalName: String(originalName || '').trim() || null, mimeType: String(mimeType || '').trim() || null,
  });
  await notify(
    pharmacy.ownerId,
    'New prescription request',
    `A patient submitted a prescription for ${product.name}.`,
    'PRESCRIPTION_REQUEST',
    { action: 'PRODUCT_PRESCRIPTION_REQUEST', prescriptionRequestId: String(request._id), productId: String(product._id) }
  );
  const [patientForEmail, sellerForEmail] = await Promise.all([
    User.findById(patientId).select('fullName email role'),
    User.findById(pharmacy.ownerId).select('fullName email role'),
  ]);
  await emailService.sendPrescriptionReceivedEmail({ request, product, patient: patientForEmail, seller: sellerForEmail })
    .catch((error) => console.error('[email] prescription received email queue failed:', error.message));
  return request.toObject();
};

const getEligibility = async (patientId, productId, variantId) => {
  const product = await getPrescriptionProduct(productId);
  const variant = resolveVariant(product, variantId);
  if (product.variants?.length && !variant) throw httpError('Selected product variant is no longer available');
  const request = await ProductPrescriptionRequest.findOne({ patientId, productId: product._id, variantId: variant?._id || null }).sort({ createdAt: -1 }).lean();
  if (request?.status === 'APPROVED') {
    try { await ensureApprovalNotification(request, product.name); } catch (error) { console.error('Unable to ensure prescription approval notification:', error.message); }
  }
  return { requiresPrescription: true, canPurchase: request?.status === 'APPROVED', status: request?.status || 'NOT_SUBMITTED', request: request || null };
};

const hydrateRequests = async (requests, pagination, lang) => {
  const productIds = [...new Set(requests.map((request) => String(request.productId)).filter(Boolean))];
  const patientIds = [...new Set(requests.map((request) => String(request.patientId)).filter(Boolean))];
  const [products, patients] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('name images variants i18n').lean(),
    User.find({ _id: { $in: patientIds } }).select('fullName email phone').lean(),
  ]);
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const patientById = new Map(patients.map((patient) => [String(patient._id), patient]));
  return {
    requests: requests.map((request) => {
      const sourceProduct = productById.get(String(request.productId));
      const product = sourceProduct ? localizeProduct(sourceProduct, lang) : null;
      return {
        ...request,
        patientId: patientById.get(String(request.patientId)) || null,
        productId: product ? { ...product, selectedVariant: product.variants?.find((variant) => String(variant._id) === String(request.variantId)) || null } : null,
      };
    }),
    pagination: { ...pagination, pages: Math.ceil(pagination.total / pagination.limit) },
  };
};

const listMine = async (patientId, options = {}) => {
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 30));
  const page = Math.max(1, Number(options.page) || 1);
  const [requests, total] = await Promise.all([
    ProductPrescriptionRequest.find({ patientId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ProductPrescriptionRequest.countDocuments({ patientId }),
  ]);
  return hydrateRequests(requests, { page, limit, total }, options.lang);
};

const listForSeller = async (ownerId, options = {}) => {
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 30));
  const page = Math.max(1, Number(options.page) || 1);
  const query = { pharmacyOwnerId: ownerId };
  if (options.status && String(options.status).toUpperCase() !== 'ALL') query.status = String(options.status).toUpperCase();
  const [requests, total] = await Promise.all([
    ProductPrescriptionRequest.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ProductPrescriptionRequest.countDocuments(query),
  ]);
  return hydrateRequests(requests, { page, limit, total }, options.lang);
};

const reviewRequest = async (ownerId, requestId, data) => {
  const status = String(data?.status || '').toUpperCase();
  if (!['APPROVED', 'REJECTED'].includes(status)) throw httpError('Review status must be APPROVED or REJECTED');
  const request = await ProductPrescriptionRequest.findById(requestId);
  if (!request) throw httpError('Prescription request not found', 404);
  if (String(request.pharmacyOwnerId) !== String(ownerId)) throw httpError('You can only review prescriptions sent to your account', 403);
  if (request.status !== 'PENDING') throw httpError('This prescription request has already been reviewed', 409);
  request.status = status;
  request.reviewNotes = String(data?.reviewNotes || '').trim() || null;
  request.reviewedBy = ownerId;
  request.reviewedAt = new Date();
  request.approvedAt = status === 'APPROVED' ? new Date() : null;
  await request.save();
  const product = await Product.findById(request.productId).select('name').lean();
  if (status === 'APPROVED') {
    try { await ensureApprovalNotification(request, product?.name); } catch (error) { console.error('Unable to create prescription approval notification:', error.message); }
  } else {
    await notify(
      request.patientId,
      'Prescription needs attention',
      `Your prescription for ${product?.name || 'this product'} was not approved. ${request.reviewNotes || 'Please submit a new prescription.'}`,
      'PRESCRIPTION_REJECTED',
      { action: 'PRODUCT_PRESCRIPTION_REJECTED', prescriptionRequestId: String(request._id), productId: String(request.productId), variantId: request.variantId ? String(request.variantId) : null }
    );
  }
  const [patientForEmail, sellerForEmail] = await Promise.all([
    User.findById(request.patientId).select('fullName email role'),
    User.findById(ownerId).select('fullName email role'),
  ]);
  await emailService.sendPrescriptionStatusEmail({ request, product, patient: patientForEmail, seller: sellerForEmail })
    .catch((error) => console.error('[email] prescription status email queue failed:', error.message));
  return request.toObject();
};

const countPendingForSeller = async (ownerId) => ({ pendingCount: await ProductPrescriptionRequest.countDocuments({ pharmacyOwnerId: ownerId, status: 'PENDING' }) });
const hasApprovedPrescription = async (patientId, productId, variantId) => Boolean(await ProductPrescriptionRequest.exists({ patientId, productId, variantId: variantId || null, status: 'APPROVED' }));

module.exports = { submitRequest, getEligibility, listMine, listForSeller, reviewRequest, countPendingForSeller, hasApprovedPrescription, resolveVariant };
