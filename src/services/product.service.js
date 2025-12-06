const Product = require('../models/product.model');
const User = require('../models/user.model');

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
  const seller = await User.findById(sellerId);
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
 * @returns {Promise<Object>} Updated product
 */
const updateProduct = async (id, data) => {
  const product = await Product.findById(id);
  
  if (!product) {
    throw new Error('Product not found');
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      if (key === 'sellerType') {
        product[key] = data[key].toUpperCase();
      } else {
        product[key] = data[key];
      }
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
 * @returns {Promise<Object>} Success message
 */
const deleteProduct = async (id) => {
  const product = await Product.findById(id);
  
  if (!product) {
    throw new Error('Product not found');
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

