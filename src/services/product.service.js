const Product = require('../models/product.model');
const User = require('../models/user.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const subscriptionPolicy = require('./subscriptionPolicy.service');
const { assessLowStockForProduct, thresholdFor } = require('./inventory.service');
const { normalizeLang, localizeProduct } = require('../utils/localization');

const nullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullableText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

// Product options are validated a second time in the service because prices
// and inventory are business-critical values.  Unlike a bare Error, this
// shape survives the global error middleware and lets the web form point to
// the exact option field that needs to be corrected.
const productValidationError = (field, message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.errors = [{ field, message }];
  return error;
};

const normalizeVariants = (variants, fallback = {}) => {
  const source = Array.isArray(variants) && variants.length
    ? variants
    : [{
        name: fallback.name || 'Default option',
        sku: fallback.sku,
        barcode: fallback.barcode,
        price: fallback.price,
        discountPrice: fallback.discountPrice,
        stock: fallback.stock,
      }];

  const normalized = source.map((variant, index) => {
    const price = nullableNumber(variant?.price);
    const discountPrice = nullableNumber(variant?.discountPrice);
    const stock = nullableNumber(variant?.stock);
    const lowStockThreshold = nullableNumber(variant?.lowStockThreshold);
    if (price === null || price < 0) {
      throw productValidationError(`variants.${index}.price`, `Enter a valid regular price for option ${index + 1}`);
    }
    if (stock === null || stock < 0 || !Number.isInteger(stock)) {
      throw productValidationError(`variants.${index}.stock`, `Enter a whole stock quantity for option ${index + 1}`);
    }
    if (lowStockThreshold !== null && (lowStockThreshold < 0 || !Number.isInteger(lowStockThreshold))) {
      throw productValidationError(`variants.${index}.lowStockThreshold`, `Enter a whole low-stock alert level for option ${index + 1}`);
    }
    if (discountPrice !== null && (discountPrice < 0 || discountPrice >= price)) {
      throw productValidationError(`variants.${index}.discountPrice`, `The sale price must be lower than the regular price for option ${index + 1}`);
    }
    return {
      ...(variant?._id ? { _id: variant._id } : {}),
      name: nullableText(variant?.name) || `Option ${index + 1}`,
      sku: nullableText(variant?.sku),
      barcode: nullableText(variant?.barcode),
      strengthValue: nullableNumber(variant?.strengthValue),
      strengthUnit: nullableText(variant?.strengthUnit),
      dosageForm: nullableText(variant?.dosageForm),
      packageType: nullableText(variant?.packageType),
      unitsPerPack: nullableNumber(variant?.unitsPerPack),
      unitLabel: nullableText(variant?.unitLabel),
      packageDescription: nullableText(variant?.packageDescription),
      price,
      discountPrice,
      stock,
      lowStockThreshold,
      isDefault: Boolean(variant?.isDefault),
      isActive: variant?.isActive !== false,
    };
  });

  const defaultIndex = normalized.findIndex((variant) => variant.isDefault);
  normalized.forEach((variant, index) => { variant.isDefault = index === (defaultIndex >= 0 ? defaultIndex : 0); });
  return normalized;
};

const getVariantSummary = (variants) => {
  const defaultVariant = variants.find((variant) => variant.isDefault) || variants[0];
  return {
    price: defaultVariant.price,
    discountPrice: defaultVariant.discountPrice,
    stock: variants.filter((variant) => variant.isActive !== false)
      .reduce((total, variant) => total + Number(variant.stock || 0), 0),
  };
};

const normalizeDetails = (details) => (details && typeof details === 'object' ? details : {});

const enforceDoctorProductPlan = async (seller) => {
  if (seller.role !== 'DOCTOR') return;
  if (!seller.subscriptionPlan || !seller.subscriptionExpiresAt || new Date(seller.subscriptionExpiresAt) <= new Date()) {
    const error = new Error('You must have an active PREMIUM subscription to manage products');
    error.statusCode = 403;
    throw error;
  }
  const plan = await SubscriptionPlan.findById(seller.subscriptionPlan);
  if (!plan || subscriptionPolicy.normalizePlanName(plan.name, subscriptionPolicy.TARGET_ROLES.DOCTOR) !== 'PREMIUM') {
    const error = new Error('Only doctors with a PREMIUM subscription can manage products');
    error.statusCode = 403;
    throw error;
  }
};

const normaliseProductData = (data, existing = {}) => {
  const variants = normalizeVariants(data.variants, {
    name: data.name || existing.name,
    sku: data.sku ?? existing.sku,
    barcode: data.barcode ?? existing.barcode,
    price: data.price ?? existing.price,
    discountPrice: data.discountPrice ?? existing.discountPrice,
    stock: data.stock ?? existing.stock,
  });
  const summary = getVariantSummary(variants);
  const rawThreshold = data.lowStockThreshold ?? existing.lowStockThreshold ?? 5;
  const lowStockThreshold = nullableNumber(rawThreshold);
  if (lowStockThreshold === null || lowStockThreshold < 0 || !Number.isInteger(lowStockThreshold)) {
    throw productValidationError('lowStockThreshold', 'Low-stock alert level must be a non-negative whole number');
  }
  return {
    ...data,
    ...summary,
    variants,
    lowStockThreshold,
    sku: nullableText(data.sku ?? existing.sku) || undefined,
    barcode: nullableText(data.barcode ?? existing.barcode),
    brand: nullableText(data.brand ?? existing.brand),
    manufacturer: nullableText(data.manufacturer ?? existing.manufacturer),
    images: Array.isArray(data.images) ? data.images.filter(Boolean) : (existing.images || []),
    tags: Array.isArray(data.tags) ? data.tags.map((tag) => String(tag).trim()).filter(Boolean) : (existing.tags || []),
    medicineDetails: normalizeDetails(data.medicineDetails ?? existing.medicineDetails),
    parapharmacyDetails: normalizeDetails(data.parapharmacyDetails ?? existing.parapharmacyDetails),
  };
};

const createProduct = async (data) => {
  const seller = await User.findById(data.sellerId).populate('subscriptionPlan');
  if (!seller) {
    const error = new Error('Seller not found');
    error.statusCode = 404;
    throw error;
  }
  if (String(seller.role).toUpperCase() !== String(data.sellerType).toUpperCase()) {
    const error = new Error('Seller role does not match the product type');
    error.statusCode = 403;
    throw error;
  }
  await enforceDoctorProductPlan(seller);

  const sellerType = String(data.sellerType || '').toUpperCase();
  const defaultType = sellerType === 'PHARMACY' ? 'PHARMACY_MEDICINE'
    : sellerType === 'PARAPHARMACY' ? 'PARAPHARMACY_PRODUCT' : 'GENERAL_PRODUCT';
  const productType = ['PHARMACY_MEDICINE', 'PARAPHARMACY_PRODUCT', 'GENERAL_PRODUCT'].includes(data.productType)
    ? data.productType : defaultType;
  const normalized = normaliseProductData(data);
  if (productType === 'PHARMACY_MEDICINE' && !nullableText(normalized.medicineDetails?.activeIngredients)) {
    throw productValidationError('medicineDetails.activeIngredients', 'Active ingredients are required for a medicine');
  }
  const product = await Product.create({
    ...normalized,
    sellerId: data.sellerId,
    sellerType,
    name: String(data.name || '').trim(),
    description: nullableText(data.description),
    category: nullableText(data.category),
    subCategory: nullableText(data.subCategory),
    i18n: data.i18n,
    productType,
    requiresPrescription: Boolean(data.requiresPrescription),
    isActive: data.isActive !== false,
  });
  await assessLowStockForProduct(product._id).catch((error) => console.error('Unable to assess product stock:', error.message));
  return product;
};

const updateProduct = async (id, data, userId) => {
  const product = await Product.findById(id);
  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }
  const currentUser = await User.findById(userId).populate('subscriptionPlan');
  if (!currentUser || (currentUser.role !== 'ADMIN' && String(product.sellerId) !== String(userId))) {
    const error = new Error('You do not have permission to update this product');
    error.statusCode = 403;
    throw error;
  }
  if (currentUser.role !== 'ADMIN') await enforceDoctorProductPlan(currentUser);

  const { sellerId, sellerType, pharmacyId, ...editable } = data;
  const shouldNormalizeVariants = Object.prototype.hasOwnProperty.call(editable, 'variants') ||
    ['price', 'discountPrice', 'stock'].some((key) => Object.prototype.hasOwnProperty.call(editable, key));
  const update = shouldNormalizeVariants
    ? normaliseProductData(editable, product.toObject())
    : {
        ...editable,
        ...(Object.prototype.hasOwnProperty.call(editable, 'images') ? { images: Array.isArray(editable.images) ? editable.images.filter(Boolean) : [] } : {}),
        ...(Object.prototype.hasOwnProperty.call(editable, 'tags') ? { tags: Array.isArray(editable.tags) ? editable.tags.map((tag) => String(tag).trim()).filter(Boolean) : [] } : {}),
      };
  ['name', 'description', 'category', 'subCategory', 'brand', 'manufacturer', 'barcode'].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(update, key)) update[key] = nullableText(update[key]);
  });
  if (Object.prototype.hasOwnProperty.call(update, 'sku')) update.sku = nullableText(update.sku) || undefined;
  Object.assign(product, update);
  await product.save();
  await assessLowStockForProduct(product._id).catch((error) => console.error('Unable to assess product stock:', error.message));
  return product;
};

const getInventorySummary = async (sellerId) => {
  const products = await Product.find({ sellerId }).select('name stock lowStockThreshold variants isActive images updatedAt').sort({ updatedAt: -1 });
  const lowStockItems = [];
  let totalUnits = 0;
  let outOfStockCount = 0;

  products.forEach((product) => {
    const activeVariants = (product.variants || []).filter((variant) => variant.isActive !== false);
    if (activeVariants.length) {
      activeVariants.forEach((variant) => {
        const stock = Number(variant.stock || 0);
        const threshold = thresholdFor(variant, product);
        totalUnits += stock;
        if (stock <= threshold) {
          if (stock === 0) outOfStockCount += 1;
          lowStockItems.push({ productId: product._id, productName: product.name, productImage: product.images?.[0] || null, variantId: variant._id, variantName: variant.name, stock, threshold });
        }
      });
      return;
    }
    const stock = Number(product.stock || 0);
    const threshold = Number(product.lowStockThreshold ?? 5);
    totalUnits += stock;
    if (stock <= threshold) {
      if (stock === 0) outOfStockCount += 1;
      lowStockItems.push({ productId: product._id, productName: product.name, productImage: product.images?.[0] || null, variantId: null, variantName: null, stock, threshold });
    }
  });

  return {
    totalProducts: products.length,
    totalUnits,
    lowStockCount: lowStockItems.length,
    outOfStockCount,
    lowStockItems: lowStockItems.slice(0, 20),
  };
};

const getProduct = async (id, options = {}) => {
  const product = await Product.findById(id).populate('sellerId', 'fullName email phone profileImage');
  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }
  const lang = normalizeLang(options.lang);
  return lang ? localizeProduct(product, lang) : product;
};

const listProducts = async (filter = {}, options = {}) => {
  const { sellerId, sellerType, category, subCategory, minPrice, maxPrice, tags, search, isActive, page = 1, limit = 10 } = filter;
  const lang = normalizeLang(options.lang);
  const baseLang = lang ? lang.split('-')[0] : null;
  const query = { sellerType: { $ne: 'DOCTOR' } };
  const localizedFilters = [];
  const localizedFieldFilter = (field, value) => {
    const conditions = [{ [field]: value }];
    [...new Set([lang, baseLang].filter(Boolean))].forEach((key) => {
      conditions.push({ [`i18n.${field}.${key}`]: value });
    });
    return { $or: conditions };
  };

  if (String(isActive || '').toLowerCase() !== 'all') query.isActive = isActive === undefined || String(isActive).toLowerCase() === 'true';
  if (sellerId) query.sellerId = sellerId;
  if (sellerType && String(sellerType).toUpperCase() !== 'DOCTOR') query.sellerType = String(sellerType).toUpperCase();
  if (category) localizedFilters.push(localizedFieldFilter('category', category));
  if (subCategory) localizedFilters.push(localizedFieldFilter('subCategory', subCategory));
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }
  if (tags?.length) {
    const tagsArray = Array.isArray(tags) ? tags : [tags];
    const tagConditions = [{ tags: { $in: tagsArray } }];
    [...new Set([lang, baseLang].filter(Boolean))].forEach((key) => {
      tagConditions.push({ [`i18n.tags.${key}`]: { $in: tagsArray } });
    });
    localizedFilters.push({ $or: tagConditions });
  }
  if (search) {
    const searchConditions = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } },
    ];
    [...new Set([lang, baseLang].filter(Boolean))].forEach((key) => {
      searchConditions.push({ [`i18n.name.${key}`]: { $regex: search, $options: 'i' } });
      searchConditions.push({ [`i18n.description.${key}`]: { $regex: search, $options: 'i' } });
      searchConditions.push({ [`i18n.category.${key}`]: { $regex: search, $options: 'i' } });
      searchConditions.push({ [`i18n.subCategory.${key}`]: { $regex: search, $options: 'i' } });
    });
    localizedFilters.push({ $or: searchConditions });
  }
  if (localizedFilters.length > 0) query.$and = localizedFilters;
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const [products, total] = await Promise.all([
    Product.find(query).populate('sellerId', 'fullName email phone profileImage').skip((normalizedPage - 1) * normalizedLimit).limit(normalizedLimit).sort({ createdAt: -1 }),
    Product.countDocuments(query),
  ]);
  const localized = lang ? products.map((product) => localizeProduct(product, lang)) : products;
  return {
    products: localized,
    pagination: { page: normalizedPage, limit: normalizedLimit, total, pages: Math.ceil(total / normalizedLimit) },
  };
};

const deleteProduct = async (id, userId) => {
  const product = await Product.findById(id);
  if (!product) throw new Error('Product not found');
  const currentUser = await User.findById(userId);
  if (!currentUser || (currentUser.role !== 'ADMIN' && String(product.sellerId) !== String(userId))) {
    const error = new Error('You do not have permission to delete this product');
    error.statusCode = 403;
    throw error;
  }
  await Product.findByIdAndDelete(id);
  return { message: 'Product deleted successfully' };
};

module.exports = { createProduct, updateProduct, getProduct, listProducts, deleteProduct, getInventorySummary, normalizeVariants };
