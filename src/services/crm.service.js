const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Order = require('../models/order.model');
const DoctorProfile = require('../models/doctorProfile.model');
const Pharmacy = require('../models/pharmacy.model');
const DoctorSubscription = require('../models/doctorSubscription.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const Transaction = require('../models/transaction.model');
const Product = require('../models/product.model');

const MAX_LEAD_PAGE_SIZE = 100;
const CRM_ROLES = ['ADMIN', 'DOCTOR', 'PATIENT', 'PHARMACY', 'PARAPHARMACY'];
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'EXPIRED', 'CANCELLED', 'NOT_SUBSCRIBED'];
const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

const text = (value) => String(value || '').trim();
const escapeRegex = (value) => text(value).replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
const contains = (value) => new RegExp(escapeRegex(value), 'i');
const idOf = (value) => value?._id?.toString?.() || value?.toString?.() || null;
const number = (value) => Number(value || 0);
const uniqueSorted = (values) => [...new Set(values.map(text).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right));

const parsePositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const subscriptionStatus = (subscription) => {
  if (!subscription) return 'NOT_SUBSCRIBED';
  if (String(subscription.status || '').toUpperCase() === 'CANCELLED') return 'CANCELLED';
  if (!subscription.endDate || new Date(subscription.endDate) <= new Date()) return 'EXPIRED';
  return 'ACTIVE';
};

const mapPlan = (plan) => plan ? {
  id: idOf(plan),
  name: plan.name || null,
  targetRole: plan.targetRole || null,
  price: number(plan.price),
  currency: 'EUR',
  durationInDays: Number(plan.durationInDays || 0) || null,
  features: Array.isArray(plan.features) ? plan.features : [],
  status: plan.status || null,
} : null;

const mapSubscription = (subscription, plansById) => {
  if (!subscription) return null;
  const plan = plansById.get(idOf(subscription.planId));
  return {
    id: idOf(subscription),
    plan: mapPlan(plan),
    status: subscriptionStatus(subscription),
    startDate: subscription.startDate || null,
    endDate: subscription.endDate || null,
    transactionId: idOf(subscription.transactionId),
    createdAt: subscription.createdAt || null,
  };
};

const mapPayment = (transaction) => ({
  id: idOf(transaction),
  amount: number(transaction.amount),
  currency: transaction.currency || 'EUR',
  status: transaction.status || null,
  provider: transaction.provider || null,
  reference: transaction.providerReference || null,
  type: transaction.relatedSubscriptionId ? 'SUBSCRIPTION'
    : transaction.relatedOrderId ? 'ORDER'
      : transaction.relatedAppointmentId ? 'APPOINTMENT'
        : transaction.relatedProductId ? 'PRODUCT' : 'OTHER',
  createdAt: transaction.createdAt || null,
});

const addressOf = (address = {}) => ({
  line1: address?.line1 || null,
  line2: address?.line2 || null,
  city: address?.city || null,
  region: address?.state || null,
  country: address?.country || null,
  zip: address?.zip || null,
});

const createAddressConditions = (prefix, filters) => {
  const conditions = [];
  if (filters.city) conditions.push({ [`${prefix}city`]: contains(filters.city) });
  if (filters.country) conditions.push({ [`${prefix}country`]: contains(filters.country) });
  if (filters.region) conditions.push({ [`${prefix}state`]: contains(filters.region) });
  if (filters.area) {
    conditions.push({
      $or: [
        { [`${prefix}line1`]: contains(filters.area) },
        { [`${prefix}line2`]: contains(filters.area) },
      ],
    });
  }
  return conditions;
};

const groupBy = (items, key) => items.reduce((groups, item) => {
  const groupKey = key(item);
  if (!groupKey) return groups;
  if (!groups.has(groupKey)) groups.set(groupKey, []);
  groups.get(groupKey).push(item);
  return groups;
}, new Map());

/**
 * The legacy /crm/data endpoint is maintained for integrations that still use
 * it. Leo X24 uses getCrmLeads below, which never returns clinical records.
 */
const getCrmData = async (filters = {}) => {
  const { startDate, endDate, patientId, doctorId, orderStatus, appointmentStatus } = filters;
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (validDate(startDate)) dateFilter.createdAt.$gte = validDate(startDate);
    if (validDate(endDate)) dateFilter.createdAt.$lte = validDate(endDate);
  }

  const patientFilter = { role: 'PATIENT' };
  if (patientId) patientFilter._id = patientId;
  const appointmentFilter = { ...dateFilter };
  if (doctorId) appointmentFilter.doctorId = doctorId;
  if (patientId) appointmentFilter.patientId = patientId;
  if (appointmentStatus) appointmentFilter.status = appointmentStatus;
  const orderFilter = { ...dateFilter };
  if (patientId) orderFilter.patientId = patientId;
  if (orderStatus) orderFilter.status = orderStatus;

  const [patients, appointments, orders] = await Promise.all([
    User.find(patientFilter).select('-password').sort({ createdAt: -1 }).lean(),
    Appointment.find(appointmentFilter)
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .sort({ createdAt: -1 }).lean(),
    Order.find(orderFilter)
      .populate('patientId', 'fullName email phone')
      .populate('pharmacyId', 'name logo')
      .populate('ownerId', 'fullName email')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 }).lean(),
  ]);

  return { patients, appointments, orders, generatedAt: new Date().toISOString(), filters };
};

/**
 * Read-only, filterable feed consumed by Leo X24. It intentionally exposes
 * registration, professional/business, subscription and accounting data only.
 * It excludes prescriptions, documents, medical notes and patient care data.
 */
const getCrmLeads = async (filters = {}) => {
  const page = parsePositiveInt(filters.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePositiveInt(filters.limit, 25, MAX_LEAD_PAGE_SIZE);
  const normalized = {
    search: text(filters.search),
    name: text(filters.name),
    email: text(filters.email).toLowerCase(),
    role: text(filters.role).toUpperCase(),
    status: text(filters.status).toUpperCase(),
    city: text(filters.city),
    country: text(filters.country),
    region: text(filters.region),
    area: text(filters.area),
    subscriptionPlan: text(filters.subscriptionPlan),
    subscriptionStatus: text(filters.subscriptionStatus).toUpperCase(),
    paymentStatus: text(filters.paymentStatus).toUpperCase(),
    fromDate: validDate(filters.fromDate),
    toDate: validDate(filters.toDate),
    sortBy: ['createdAt', 'updatedAt', 'name', 'role', 'status'].includes(text(filters.sortBy))
      ? text(filters.sortBy) : 'createdAt',
    sortDirection: text(filters.sortDirection).toLowerCase() === 'asc' ? 'asc' : 'desc',
  };

  const queryParts = [];
  if (normalized.role && CRM_ROLES.includes(normalized.role)) queryParts.push({ role: normalized.role });
  if (normalized.status) queryParts.push({ status: normalized.status });
  if (normalized.name) queryParts.push({ fullName: contains(normalized.name) });
  if (normalized.email) queryParts.push({ email: contains(normalized.email) });
  if (normalized.fromDate || normalized.toDate) {
    const createdAt = {};
    if (normalized.fromDate) createdAt.$gte = normalized.fromDate;
    if (normalized.toDate) createdAt.$lte = normalized.toDate;
    queryParts.push({ createdAt });
  }
  if (normalized.search) {
    queryParts.push({
      $or: [
        { fullName: contains(normalized.search) },
        { email: contains(normalized.search) },
        { phone: contains(normalized.search) },
      ],
    });
  }

  const locationRequested = [normalized.city, normalized.country, normalized.region, normalized.area].some(Boolean);
  if (locationRequested) {
    const userConditions = createAddressConditions('address.', normalized);
    const pharmacyConditions = createAddressConditions('address.', normalized);
    const pharmacies = await Pharmacy.find(
      pharmacyConditions.length === 1 ? pharmacyConditions[0] : { $and: pharmacyConditions },
    ).select('ownerId').lean().maxTimeMS(3000);
    const alternatives = [];
    if (userConditions.length) alternatives.push(userConditions.length === 1 ? userConditions[0] : { $and: userConditions });
    if (pharmacies.length) alternatives.push({ _id: { $in: pharmacies.map((pharmacy) => pharmacy.ownerId) } });
    if (alternatives.length) queryParts.push(alternatives.length === 1 ? alternatives[0] : { $or: alternatives });
  }

  const userQuery = queryParts.length ? { $and: queryParts } : {};
  const users = await User.find(userQuery)
    .select('fullName email phone role status profileImage isEmailVerified isPhoneVerified address subscriptionPlan subscriptionExpiresAt createdAt updatedAt')
    .sort({ createdAt: -1 }).lean().maxTimeMS(10000);
  const userIds = users.map((user) => user._id);

  const [profiles, pharmacies, subscriptions, plans, transactions, products, appointmentTotals, orderTotals] = userIds.length
    ? await Promise.all([
      DoctorProfile.find({ userId: { $in: userIds } })
        .populate('specialization', 'name')
        .select('userId title biography specialization experienceYears services consultationFees clinics isVerified profileCompleted isAvailableOnline ratingAvg ratingCount createdAt updatedAt')
        .lean().maxTimeMS(5000),
      Pharmacy.find({ ownerId: { $in: userIds } })
        .select('ownerId kind name logo address phone isActive createdAt updatedAt')
        .lean().maxTimeMS(5000),
      DoctorSubscription.find({ doctorId: { $in: userIds } })
        .sort({ endDate: -1, createdAt: -1 }).lean().maxTimeMS(5000),
      SubscriptionPlan.find({}).select('name targetRole price durationInDays features status').lean().maxTimeMS(3000),
      Transaction.find({ userId: { $in: userIds } })
        .select('userId relatedAppointmentId relatedSubscriptionId relatedProductId relatedOrderId amount currency status provider providerReference createdAt')
        .sort({ createdAt: -1 }).lean().maxTimeMS(10000),
      Product.find({ sellerId: { $in: userIds } })
        .select('sellerId sellerType name sku category subCategory price discountPrice stock lowStockThreshold lowStockAlertActive images variants isActive createdAt updatedAt')
        .sort({ createdAt: -1 }).lean().maxTimeMS(10000),
      Appointment.aggregate([
        { $match: { doctorId: { $in: userIds } } },
        { $group: { _id: '$doctorId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }, confirmed: { $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] } } } },
      ]).option({ maxTimeMS: 5000 }),
      Order.aggregate([
        { $match: { ownerId: { $in: userIds } } },
        { $group: { _id: '$ownerId', total: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 1, 0] } }, paidRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$total', 0] } } } },
      ]).option({ maxTimeMS: 5000 }),
    ])
    : [[], [], [], [], [], [], [], []];

  const plansById = new Map(plans.map((plan) => [idOf(plan), plan]));
  const profilesByUserId = new Map(profiles.map((profile) => [idOf(profile.userId), profile]));
  const pharmaciesByOwnerId = new Map(pharmacies.map((pharmacy) => [idOf(pharmacy.ownerId), pharmacy]));
  const subscriptionsByUserId = groupBy(subscriptions, (subscription) => idOf(subscription.doctorId));
  const paymentsByUserId = groupBy(transactions, (transaction) => idOf(transaction.userId));
  const productsByUserId = groupBy(products, (product) => idOf(product.sellerId));
  const appointmentsByDoctorId = new Map(appointmentTotals.map((total) => [idOf(total._id), total]));
  const ordersByOwnerId = new Map(orderTotals.map((total) => [idOf(total._id), total]));

  const leads = users.map((user) => {
    const userId = idOf(user);
    const profile = profilesByUserId.get(userId) || null;
    const pharmacy = pharmaciesByOwnerId.get(userId) || null;
    const history = (subscriptionsByUserId.get(userId) || []).map((subscription) => mapSubscription(subscription, plansById));
    const currentPlan = plansById.get(idOf(user.subscriptionPlan));
    const latestSubscription = history.find((subscription) => subscription.status === 'ACTIVE') || history[0] || null;
    const planLinkedSubscription = history.find((subscription) => subscription.plan?.id === idOf(user.subscriptionPlan)) || latestSubscription;
    const currentSubscription = currentPlan
      ? {
        id: planLinkedSubscription?.id || null,
        plan: mapPlan(currentPlan),
        status: planLinkedSubscription?.status === 'CANCELLED'
          ? 'CANCELLED'
          : user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date() ? 'ACTIVE' : 'EXPIRED',
        startDate: planLinkedSubscription?.startDate || null,
        endDate: user.subscriptionExpiresAt || planLinkedSubscription?.endDate || null,
        transactionId: planLinkedSubscription?.transactionId || null,
        createdAt: planLinkedSubscription?.createdAt || null,
      }
      : latestSubscription;
    const payments = (paymentsByUserId.get(userId) || []).map(mapPayment);
    const sellerProducts = (productsByUserId.get(userId) || []).map((product) => ({
      id: idOf(product),
      name: product.name || null,
      sku: product.sku || null,
      sellerType: product.sellerType || null,
      category: product.category || null,
      subCategory: product.subCategory || null,
      price: number(product.price),
      discountPrice: product.discountPrice === null || product.discountPrice === undefined ? null : number(product.discountPrice),
      stock: product.stock === null || product.stock === undefined ? null : number(product.stock),
      lowStockThreshold: number(product.lowStockThreshold),
      lowStockAlertActive: Boolean(product.lowStockAlertActive),
      variants: Array.isArray(product.variants) ? product.variants.map((variant) => ({
        id: idOf(variant), name: variant.name || null, sku: variant.sku || null,
        price: number(variant.price), stock: number(variant.stock), isActive: Boolean(variant.isActive),
      })) : [],
      isActive: Boolean(product.isActive),
      image: Array.isArray(product.images) ? product.images[0] || null : null,
      createdAt: product.createdAt || null,
    }));
    // Never send a patient home/delivery address into a cross-platform CRM.
    // Professional and business operating locations remain available.
    const profileAddress = user.role === 'PATIENT'
      ? addressOf()
      : pharmacy ? addressOf(pharmacy.address) : addressOf(user.address);
    const appointment = appointmentsByDoctorId.get(userId);
    const order = ordersByOwnerId.get(userId);

    return {
      id: userId,
      name: user.fullName || null,
      email: user.email || null,
      phone: user.phone || pharmacy?.phone || null,
      role: user.role || null,
      status: user.status || null,
      emailVerified: Boolean(user.isEmailVerified),
      phoneVerified: Boolean(user.isPhoneVerified),
      address: profileAddress,
      profileImage: user.profileImage || pharmacy?.logo || null,
      doctor: profile ? {
        title: profile.title || null,
        biography: profile.biography || null,
        specialization: profile.specialization?.name || null,
        experienceYears: profile.experienceYears ?? null,
        isVerified: Boolean(profile.isVerified),
        profileCompleted: Boolean(profile.profileCompleted),
        isAvailableOnline: Boolean(profile.isAvailableOnline),
        ratingAvg: number(profile.ratingAvg),
        ratingCount: number(profile.ratingCount),
        consultationFees: { clinic: profile.consultationFees?.clinic ?? null, online: profile.consultationFees?.online ?? null },
        services: Array.isArray(profile.services) ? profile.services.map((service) => ({ name: service.name || null, price: service.price ?? null })) : [],
        clinics: Array.isArray(profile.clinics) ? profile.clinics.map((clinic) => ({ name: clinic.name || null, city: clinic.city || null, region: clinic.state || null, country: clinic.country || null, phone: clinic.phone || null })) : [],
      } : null,
      pharmacy: pharmacy ? {
        kind: pharmacy.kind || null,
        name: pharmacy.name || null,
        phone: pharmacy.phone || null,
        isActive: Boolean(pharmacy.isActive),
        address: addressOf(pharmacy.address),
        logo: pharmacy.logo || null,
      } : null,
      subscription: currentSubscription,
      subscriptionHistory: history,
      payments,
      products: sellerProducts,
      operations: {
        appointments: appointment ? { total: number(appointment.total), confirmed: number(appointment.confirmed), completed: number(appointment.completed) } : null,
        orders: order ? { total: number(order.total), paid: number(order.paid), paidRevenue: number(order.paidRevenue) } : null,
        products: {
          total: sellerProducts.length,
          active: sellerProducts.filter((product) => product.isActive).length,
          lowStock: sellerProducts.filter((product) => product.lowStockAlertActive).length,
        },
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }).filter((lead) => {
    if (normalized.subscriptionPlan && !contains(normalized.subscriptionPlan).test(lead.subscription?.plan?.name || '')) return false;
    if (normalized.subscriptionStatus && SUBSCRIPTION_STATUSES.includes(normalized.subscriptionStatus)
      && (lead.subscription?.status || 'NOT_SUBSCRIBED') !== normalized.subscriptionStatus) return false;
    if (normalized.paymentStatus && PAYMENT_STATUSES.includes(normalized.paymentStatus)
      && !lead.payments.some((payment) => String(payment.status).toUpperCase() === normalized.paymentStatus)) return false;
    return true;
  });

  const direction = normalized.sortDirection === 'asc' ? 1 : -1;
  leads.sort((left, right) => {
    if (normalized.sortBy === 'createdAt' || normalized.sortBy === 'updatedAt') {
      return ((new Date(left[normalized.sortBy] || 0).getTime()) - (new Date(right[normalized.sortBy] || 0).getTime())) * direction;
    }
    return String(left[normalized.sortBy] || '').localeCompare(String(right[normalized.sortBy] || '')) * direction;
  });

  const roleCounts = CRM_ROLES.reduce((counts, role) => ({ ...counts, [role]: leads.filter((lead) => lead.role === role).length }), {});
  const subscriptionCounts = SUBSCRIPTION_STATUSES.reduce((counts, status) => ({ ...counts, [status]: leads.filter((lead) => (lead.subscription?.status || 'NOT_SUBSCRIBED') === status).length }), {});
  const filteredIds = new Set(leads.map((lead) => lead.id));
  const relevantPayments = transactions.filter((transaction) => filteredIds.has(idOf(transaction.userId)) && String(transaction.status).toUpperCase() === 'SUCCESS');
  const revenue = relevantPayments.reduce((summary, transaction) => {
    const amount = number(transaction.amount);
    summary.total += amount;
    if (transaction.relatedSubscriptionId) summary.subscriptions += amount;
    else if (transaction.relatedOrderId) summary.orders += amount;
    else if (transaction.relatedAppointmentId) summary.appointments += amount;
    else summary.other += amount;
    return summary;
  }, { total: 0, subscriptions: 0, orders: 0, appointments: 0, other: 0, currency: 'EUR' });

  const filterOptions = {
    roles: uniqueSorted(leads.map((lead) => lead.role)),
    statuses: uniqueSorted(leads.map((lead) => lead.status)),
    cities: uniqueSorted(leads.map((lead) => lead.address.city)),
    countries: uniqueSorted(leads.map((lead) => lead.address.country)),
    regions: uniqueSorted(leads.map((lead) => lead.address.region)),
    areas: uniqueSorted(leads.map((lead) => lead.address.line2 || lead.address.line1)),
    subscriptionPlans: uniqueSorted(leads.map((lead) => lead.subscription?.plan?.name)),
    subscriptionStatuses: SUBSCRIPTION_STATUSES,
    paymentStatuses: PAYMENT_STATUSES,
  };
  const total = leads.length;
  const start = (page - 1) * limit;
  return {
    users: leads.slice(start, start + limit),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    filterOptions,
    stats: {
      registrations: total,
      roleCounts,
      subscriptionCounts,
      payments: { successful: relevantPayments.length, revenue },
      products: {
        total: leads.reduce((sum, lead) => sum + lead.operations.products.total, 0),
        lowStock: leads.reduce((sum, lead) => sum + lead.operations.products.lowStock, 0),
      },
      orders: {
        total: leads.reduce((sum, lead) => sum + number(lead.operations.orders?.total), 0),
        paidRevenue: leads.reduce((sum, lead) => sum + number(lead.operations.orders?.paidRevenue), 0),
      },
    },
    generatedAt: new Date().toISOString(),
  };
};

module.exports = { getCrmData, getCrmLeads };
