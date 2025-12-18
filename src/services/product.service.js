const Product = require('../models/product.model');
const User = require('../models/user.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');

/**
 * Create product
 * @param {Object} data - Product data
 * @returns {Promise<Object>} Created product
 */
const createProduct = async (data) => {
  const {
    sellerId,
    sellerType,
    name,
    price,
    stock,
    description,
    sku,
    discountPrice,
    images,
    category,
    subCategory,
    tags,
    isActive
  } = data;

  // Verify seller exists
  const seller = await User.findById(sellerId).populate('subscriptionPlan');
  if (!seller) {
    throw new Error('Seller not found');
  }

  // Verify seller type matches user role
  if (sellerType === 'DOCTOR' && seller.role !== 'DOCTOR') {
    throw new Error('Seller must be a doctor');
  }

  if (sellerType === 'PHARMACY' && seller.role !== 'PHARMACY') {
    throw new Error('Seller must be a pharmacy');
  }

  if (sellerType === 'ADMIN' && seller.role !== 'ADMIN') {
    throw new Error('Seller must be an admin');
  }

  // For doctors: Check if they have FULL subscription plan
  // Admin and Pharmacy don't need subscription check
  if (sellerType === 'DOCTOR') {
    if (!seller.subscriptionPlan) {
      throw new Error('You must have an active subscription plan to create products');
    }

    // Check if subscription is active
    const hasActiveSubscription = seller.subscriptionExpiresAt && 
                                  new Date(seller.subscriptionExpiresAt) > new Date();
    if (!hasActiveSubscription) {
      throw new Error('Your subscription has expired. Please renew to create products');
    }

    // Check if subscription plan name is "FULL"
    const plan = await SubscriptionPlan.findById(seller.subscriptionPlan);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    if (plan.name.toUpperCase() !== 'FULL') {
      throw new Error('Only doctors with FULL subscription plan can create products. Please upgrade to FULL plan.');
    }
  }

  const product = await Product.create({
    sellerId,
    sellerType: sellerType.toUpperCase(),
    name,
    price,
    stock: stock || 0,
    description,
    sku,
    discountPrice,
    images: images || [],
    category,
    subCategory,
    tags: tags || [],
    isActive: isActive !== undefined ? isActive : true
  });

  return product;
};

/**
 * Update product
 * @param {string} id - Product ID
 * @param {Object} data - Update data
 * @param {string} userId - User ID (for authorization check)
 * @returns {Promise<Object>} Updated product
 */
const updateProduct = async (id, data, userId) => {
  const product = await Product.findById(id);
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Verify user owns the product (or is admin)
  const seller = await User.findById(product.sellerId);
  const currentUser = await User.findById(userId);
  
  // Admin can update any product, others can only update their own
  if (currentUser.role !== 'ADMIN' && product.sellerId.toString() !== userId) {
    throw new Error('You do not have permission to update this product');
  }

  // For doctors: Verify they still have FULL subscription
  // Admin and Pharmacy don't need subscription check
  if (product.sellerType === 'DOCTOR' && currentUser.role !== 'ADMIN') {
    const seller = await User.findById(product.sellerId).populate('subscriptionPlan');
    if (!seller || !seller.subscriptionPlan) {
      throw new Error('You must have an active subscription plan to update products');
    }

    const hasActiveSubscription = seller.subscriptionExpiresAt && 
                                  new Date(seller.subscriptionExpiresAt) > new Date();
    if (!hasActiveSubscription) {
      throw new Error('Your subscription has expired. Please renew to update products');
    }

    const plan = await SubscriptionPlan.findById(seller.subscriptionPlan);
    if (!plan || plan.name.toUpperCase() !== 'FULL') {
      throw new Error('Only doctors with FULL subscription plan can update products');
    }
  }

  // Prevent changing sellerId or sellerType
  const { sellerId, sellerType, ...updateData } = data;

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      product[key] = updateData[key];
    }
  });

  await product.save();

  return product;
};

/**
 * Get product by ID
 * @param {string} id - Product ID
 * @returns {Promise<Object>} Product
 */
const getProduct = async (id) => {
  const product = await Product.findById(id)
    .populate('sellerId', 'fullName email phone profileImage');
  
  if (!product) {
    throw new Error('Product not found');
  }

  return product;
};

/**
 * List products with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Products and pagination info
 */
const listProducts = async (filter = {}) => {
  const {
    sellerId,
    sellerType,
    category,
    subCategory,
    minPrice,
    maxPrice,
    tags,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = { isActive: true };

  if (sellerId) {
    query.sellerId = sellerId;
  }

  if (sellerType) {
    query.sellerType = sellerType.toUpperCase();
  }

  if (category) {
    query.category = category;
  }

  if (subCategory) {
    query.subCategory = subCategory;
  }

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = minPrice;
    if (maxPrice) query.price.$lte = maxPrice;
  }

  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('sellerId', 'fullName email phone profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Product.countDocuments(query)
  ]);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Delete product
 * @param {string} id - Product ID
 * @param {string} userId - User ID (for authorization check)
 * @returns {Promise<Object>} Success message
 */
const deleteProduct = async (id, userId) => {
  const product = await Product.findById(id);
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Verify user owns the product (or is admin)
  const currentUser = await User.findById(userId);
  
  // Admin can delete any product, others can only delete their own
  if (currentUser.role !== 'ADMIN' && product.sellerId.toString() !== userId) {
    throw new Error('You do not have permission to delete this product');
  }

  await Product.findByIdAndDelete(id);

  return { message: 'Product deleted successfully' };
};

module.exports = {
  createProduct,
  updateProduct,
  getProduct,
  listProducts,
  deleteProduct
};

