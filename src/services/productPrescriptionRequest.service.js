const ProductPrescriptionRequest = require('../models/productPrescriptionRequest.model');
const Product = require('../models/product.model');
const Pharmacy = require('../models/pharmacy.model');
const User = require('../models/user.model');
const notificationService = require('./notification.service');

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

const notify = async (userId, title, body, data) => {
  try {
    await notificationService.createNotification({ userId, title, body, type: 'PRESCRIPTION', data });
  } catch (error) {
    console.error('Unable to create product prescription notification:', error.message);
  }
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
  await notify(pharmacy.ownerId, 'New prescription request', `A patient submitted a prescription for ${product.name}.`, { action: 'PRODUCT_PRESCRIPTION_REQUEST', prescriptionRequestId: String(request._id), productId: String(product._id) });
  return request.toObject();
};

const getEligibility = async (patientId, productId, variantId) => {
  const product = await Product.findById(productId).lean();
  if (!product) throw httpError('Product not found', 404);
  if (!product.requiresPrescription) return { requiresPrescription: false, canPurchase: true, status: 'NOT_REQUIRED', request: null };
  const variant = resolveVariant(product, variantId);
  if (product.variants?.length && !variant) throw httpError('Selected product variant is no longer available');
  const request = await ProductPrescriptionRequest.findOne({ patientId, productId: product._id, variantId: variant?._id || null }).sort({ createdAt: -1 }).lean();
  return { requiresPrescription: true, canPurchase: request?.status === 'APPROVED', status: request?.status || 'NOT_SUBMITTED', request: request || null };
};

const hydrateRequests = async (requests, pagination) => {
  const productIds = [...new Set(requests.map((request) => String(request.productId)).filter(Boolean))];
  const patientIds = [...new Set(requests.map((request) => String(request.patientId)).filter(Boolean))];
  const [products, patients] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('name images variants').lean(),
    User.find({ _id: { $in: patientIds } }).select('fullName email phone').lean(),
  ]);
  const productById = new Map(products.map((product) => [String(product._id), product]));
  const patientById = new Map(patients.map((patient) => [String(patient._id), patient]));
  return {
    requests: requests.map((request) => {
      const product = productById.get(String(request.productId));
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
  return hydrateRequests(requests, { page, limit, total });
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
  return hydrateRequests(requests, { page, limit, total });
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
  await notify(request.patientId, status === 'APPROVED' ? 'Prescription approved' : 'Prescription needs attention', status === 'APPROVED'
    ? `Your prescription for ${product?.name || 'this product'} has been approved. You can now purchase it.`
    : `Your prescription for ${product?.name || 'this product'} was not approved. ${request.reviewNotes || 'Please submit a new prescription.'}`,
  { action: status === 'APPROVED' ? 'PRODUCT_PRESCRIPTION_APPROVED' : 'PRODUCT_PRESCRIPTION_REJECTED', prescriptionRequestId: String(request._id), productId: String(request.productId), variantId: request.variantId ? String(request.variantId) : null });
  return request.toObject();
};

const countPendingForSeller = async (ownerId) => ({ pendingCount: await ProductPrescriptionRequest.countDocuments({ pharmacyOwnerId: ownerId, status: 'PENDING' }) });
const hasApprovedPrescription = async (patientId, productId, variantId) => Boolean(await ProductPrescriptionRequest.exists({ patientId, productId, variantId: variantId || null, status: 'APPROVED' }));

module.exports = { submitRequest, getEligibility, listMine, listForSeller, reviewRequest, countPendingForSeller, hasApprovedPrescription, resolveVariant };
