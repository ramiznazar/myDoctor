const asyncHandler = require('../middleware/asyncHandler');
const productService = require('../services/product.service');

/**
 * Create product
 * Automatically sets sellerId and sellerType from authenticated user
 * Doctors must have FULL subscription plan to create products
 * Admin and Doctor can create pharmacy products by providing pharmacyId
 */
exports.create = asyncHandler(async (req, res) => {
  let sellerId = req.userId;
  let sellerType = req.userRole;
  const pharmacyService = require('../services/pharmacy.service');
  const subscriptionPolicy = require('../services/subscriptionPolicy.service');
  
  // Check for pharmacyId first (before removing it from body)
  // Handle both string and empty string cases
  let pharmacyId = null;
  const rawPharmacyId = req.body.pharmacyId;
  
  // More robust parsing - handle all edge cases
  if (rawPharmacyId !== undefined && rawPharmacyId !== null) {
    const pharmacyIdStr = String(rawPharmacyId).trim();
    // Only set pharmacyId if it's a non-empty string that's not 'null' or 'undefined'
    if (pharmacyIdStr && pharmacyIdStr !== '' && pharmacyIdStr !== 'null' && pharmacyIdStr !== 'undefined') {
      pharmacyId = pharmacyIdStr;
    }
  }
  
  console.log('Product creation - pharmacyId check:', {
    rawPharmacyId: req.body.pharmacyId,
    rawPharmacyIdType: typeof req.body.pharmacyId,
    processedPharmacyId: pharmacyId,
    pharmacyIdTruthy: !!pharmacyId,
    userRole: req.userRole,
    userId: req.userId,
    conditionCheck: req.userRole === 'ADMIN' && pharmacyId
  });
  
  // If pharmacy creates product, require approval and pharmacy profile exists
  if (req.userRole === 'PHARMACY') {
    const status = req.user?.status?.toUpperCase();
    if (status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your pharmacy account is not approved yet. You cannot add products until approved.'
      });
    }

    const myPharmacy = await pharmacyService.getPharmacyByOwnerId(req.userId);
    if (!myPharmacy) {
      return res.status(400).json({
        success: false,
        message: 'Please create your pharmacy profile first before adding products'
      });
    }

    const isProfileComplete = !!(
      myPharmacy.name &&
      myPharmacy.phone &&
      myPharmacy.address &&
      myPharmacy.address.line1 &&
      myPharmacy.address.city
    );

    if (!isProfileComplete) {
      return res.status(400).json({
        success: false,
        message: 'Please complete your pharmacy profile first before adding products'
      });
    }

    await subscriptionPolicy.enforcePharmacySubscriptionActive({ pharmacyUserId: req.userId });
  }
  // If admin provides pharmacyId, link product to that pharmacy
  else if (req.userRole === 'ADMIN' && pharmacyId) {
    console.log('ADMIN with pharmacyId - Entering pharmacy linking block:', {
      userRole: req.userRole,
      pharmacyId: pharmacyId,
      pharmacyIdType: typeof pharmacyId,
      pharmacyIdTruthy: !!pharmacyId
    });
    
    try {
      const pharmacy = await pharmacyService.getPharmacy(pharmacyId);
      console.log('Pharmacy fetched successfully:', {
        pharmacyId: pharmacy._id,
        pharmacyName: pharmacy.name,
        ownerId: pharmacy.ownerId,
        ownerIdType: typeof pharmacy.ownerId,
        ownerIdIsObject: typeof pharmacy.ownerId === 'object',
        ownerIdIsNull: pharmacy.ownerId === null
      });
      
      // Get the pharmacy owner's ID (handle both populated object and direct ID)
      sellerId = pharmacy.ownerId?._id || pharmacy.ownerId;
      sellerType = 'PHARMACY';
      
      console.log('After setting sellerId and sellerType:', {
        sellerId: sellerId,
        sellerType: sellerType,
        ownerId_id: pharmacy.ownerId?._id,
        ownerId_direct: pharmacy.ownerId
      });
      
      if (!sellerId) {
        console.error('Pharmacy has no ownerId - returning error');
        return res.status(400).json({ 
          success: false, 
          message: 'Pharmacy has no owner assigned. Please ensure the pharmacy has an owner before linking products.' 
        });
      }
      
      console.log('Admin creating product for pharmacy - SUCCESS:', {
        pharmacyId: pharmacyId,
        pharmacyName: pharmacy.name,
        pharmacyOwnerId: sellerId,
        pharmacyOwnerRole: pharmacy.ownerId?.role || 'unknown',
        sellerType: sellerType
      });
    } catch (pharmacyError) {
      console.error('Error fetching pharmacy:', {
        error: pharmacyError,
        message: pharmacyError.message,
        stack: pharmacyError.stack
      });
      // getPharmacy throws Error('Pharmacy not found') if pharmacy doesn't exist
      const statusCode = pharmacyError.message === 'Pharmacy not found' ? 404 : 500;
      return res.status(statusCode).json({ 
        success: false, 
        message: pharmacyError.message || 'Error fetching pharmacy details' 
      });
    }
  } else if (req.userRole === 'ADMIN') {
    console.log('ADMIN without pharmacyId - Using default ADMIN sellerType');
  }
  // If admin wants to create pharmacy product without pharmacyId, use sellerType from body
  else if (req.userRole === 'ADMIN' && req.body.sellerType === 'PHARMACY') {
    sellerType = 'PHARMACY';
  }
  
  // Remove pharmacyId, sellerId, and sellerType from productData 
  // (these are set by backend logic, not from request body)
  const { pharmacyId: _, sellerId: __, sellerType: ___, ...productBody } = req.body;
  
  // Automatically set sellerId and sellerType (override any values from body)
  const productData = {
    ...productBody,
    sellerId: sellerId,
    sellerType: sellerType
  };
  
  // Debug log to verify
  console.log('Product creation - Final values:', {
    userRole: req.userRole,
    userId: req.userId,
    pharmacyId: pharmacyId,
    initialSellerId: req.userId,
    initialSellerType: req.userRole,
    finalSellerId: sellerId,
    finalSellerType: sellerType,
    bodyPharmacyId: req.body.pharmacyId
  });
  
  const result = await productService.createProduct(productData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update product
 * Doctors must have FULL subscription to update products
 */
exports.update = asyncHandler(async (req, res) => {
  if (req.userRole === 'PHARMACY') {
    const subscriptionPolicy = require('../services/subscriptionPolicy.service');
    await subscriptionPolicy.enforcePharmacySubscriptionActive({ pharmacyUserId: req.userId });
  }
  const result = await productService.updateProduct(req.params.id, req.body, req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get product by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await productService.getProduct(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List products with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete product
 */
exports.delete = asyncHandler(async (req, res) => {
  if (req.userRole === 'PHARMACY') {
    const subscriptionPolicy = require('../services/subscriptionPolicy.service');
    await subscriptionPolicy.enforcePharmacySubscriptionActive({ pharmacyUserId: req.userId });
  }
  const result = await productService.deleteProduct(req.params.id, req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

