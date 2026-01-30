const SubscriptionPlan = require('../models/subscriptionPlan.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Conversation = require('../models/conversation.model');

const FIXED_PLAN_NAMES = ['BASIC', 'PRO', 'PREMIUM'];

const FIXED_PLANS = {
  BASIC: {
    name: 'BASIC',
    defaultPrice: 29,
    durationInDays: 30,
    limits: {
      privateConsultations: 10,
      videoConsultations: 5,
      chatSessions: 15
    },
    crmAccess: false
  },
  PRO: {
    name: 'PRO',
    defaultPrice: 59,
    durationInDays: 30,
    limits: {
      privateConsultations: 20,
      videoConsultations: 10,
      chatSessions: 30
    },
    crmAccess: false
  },
  PREMIUM: {
    name: 'PREMIUM',
    defaultPrice: 99,
    durationInDays: 30,
    limits: {
      privateConsultations: null,
      videoConsultations: null,
      chatSessions: null
    },
    crmAccess: true
  }
};

const normalizePlanName = (planName) => {
  const name = (planName || '').toString().trim().toUpperCase();

  if (name === 'FULL') return 'PREMIUM';
  if (name === 'MEDIUM') return 'PRO';

  return name;
};

const getPlanPolicy = (planName) => {
  const normalized = normalizePlanName(planName);
  return FIXED_PLANS[normalized] || null;
};

const getPlanFeatures = (planName) => {
  const policy = getPlanPolicy(planName);
  if (!policy) return [];

  const privateText = policy.limits.privateConsultations === null
    ? 'Private Consultation: Unlimited'
    : `Private Consultation: Max ${policy.limits.privateConsultations}`;

  const videoText = policy.limits.videoConsultations === null
    ? 'Video Consultation: Unlimited'
    : `Video Consultation: Max ${policy.limits.videoConsultations}`;

  const chatText = policy.limits.chatSessions === null
    ? 'Chat: Unlimited'
    : `Chat: Max ${policy.limits.chatSessions}`;

  const features = [privateText, videoText, chatText];

  if (policy.crmAccess) {
    features.push('CRM: Full Access');
  }

  return features;
};

const attachPolicyToPlan = (planDoc) => {
  const planObj = planDoc?.toObject ? planDoc.toObject() : planDoc;
  const policy = getPlanPolicy(planObj?.name);

  return {
    ...planObj,
    limits: policy ? policy.limits : null,
    crmAccess: policy ? policy.crmAccess : false
  };
};

const ensureFixedPlansExist = async () => {
  const existing = await SubscriptionPlan.find({
    name: { $in: [...FIXED_PLAN_NAMES, 'FULL', 'MEDIUM'] }
  });

  const existingByName = new Map(existing.map((p) => [normalizePlanName(p.name), p]));

  const createdOrUpdated = [];

  for (const planName of FIXED_PLAN_NAMES) {
    const policy = FIXED_PLANS[planName];
    const found = existingByName.get(planName);

    if (!found) {
      const created = await SubscriptionPlan.create({
        name: policy.name,
        price: policy.defaultPrice,
        durationInDays: policy.durationInDays,
        features: getPlanFeatures(policy.name),
        status: 'ACTIVE'
      });
      createdOrUpdated.push(created);
      continue;
    }

    let changed = false;

    if (found.name !== policy.name) {
      found.name = policy.name;
      changed = true;
    }

    if (found.durationInDays !== policy.durationInDays) {
      found.durationInDays = policy.durationInDays;
      changed = true;
    }

    const desiredFeatures = getPlanFeatures(policy.name);
    const currentFeatures = Array.isArray(found.features) ? found.features : [];
    const featuresEqual = currentFeatures.length === desiredFeatures.length && currentFeatures.every((v, i) => v === desiredFeatures[i]);
    if (!featuresEqual) {
      found.features = desiredFeatures;
      changed = true;
    }

    if (!found.status) {
      found.status = 'ACTIVE';
      changed = true;
    }

    if (changed) {
      await found.save();
    }

    createdOrUpdated.push(found);
  }

  return createdOrUpdated;
};

const getSubscriptionWindow = ({ subscriptionExpiresAt, durationInDays }) => {
  if (!subscriptionExpiresAt || !durationInDays) {
    return null;
  }

  const end = new Date(subscriptionExpiresAt);
  const start = new Date(end);
  start.setDate(start.getDate() - durationInDays);

  return { start, end };
};

const computeDoctorUsage = async (doctorId, window) => {
  if (!window) {
    return {
      privateConsultations: 0,
      videoConsultations: 0,
      chatSessions: 0
    };
  }

  const statusFilter = { $nin: ['CANCELLED', 'REJECTED'] };

  const [privateConsultations, videoConsultations, chatSessions] = await Promise.all([
    Appointment.countDocuments({
      doctorId,
      bookingType: 'VISIT',
      status: statusFilter,
      createdAt: { $gte: window.start, $lte: window.end }
    }),
    Appointment.countDocuments({
      doctorId,
      bookingType: 'ONLINE',
      status: statusFilter,
      createdAt: { $gte: window.start, $lte: window.end }
    }),
    Conversation.countDocuments({
      doctorId,
      conversationType: 'DOCTOR_PATIENT',
      createdAt: { $gte: window.start, $lte: window.end }
    })
  ]);

  return {
    privateConsultations,
    videoConsultations,
    chatSessions
  };
};

const computeRemaining = (limits, usage) => {
  if (!limits) {
    return null;
  }

  const remainingValue = (limit, used) => {
    if (limit === null) return null;
    const left = limit - (used || 0);
    return left < 0 ? 0 : left;
  };

  return {
    privateConsultations: remainingValue(limits.privateConsultations, usage.privateConsultations),
    videoConsultations: remainingValue(limits.videoConsultations, usage.videoConsultations),
    chatSessions: remainingValue(limits.chatSessions, usage.chatSessions)
  };
};

const getDoctorSubscriptionContext = async (doctorId) => {
  await ensureFixedPlansExist();

  const doctor = await User.findById(doctorId).populate('subscriptionPlan');
  if (!doctor || doctor.role !== 'DOCTOR') {
    const error = new Error('Doctor not found');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const hasActiveSubscription = doctor.subscriptionPlan && doctor.subscriptionExpiresAt && new Date(doctor.subscriptionExpiresAt) > now;
  const planName = normalizePlanName(doctor.subscriptionPlan?.name);
  const policy = getPlanPolicy(planName);

  return {
    doctor,
    hasActiveSubscription,
    planName,
    policy,
    window: getSubscriptionWindow({
      subscriptionExpiresAt: doctor.subscriptionExpiresAt,
      durationInDays: doctor.subscriptionPlan?.durationInDays
    })
  };
};

const enforceAppointmentBookingLimit = async ({ doctorId, bookingType }) => {
  const { hasActiveSubscription, policy, window } = await getDoctorSubscriptionContext(doctorId);

  if (!hasActiveSubscription) {
    const error = new Error('Doctor does not have an active subscription. Please select another doctor.');
    error.statusCode = 403;
    throw error;
  }

  if (!policy || !policy.limits) {
    return;
  }

  const usage = await computeDoctorUsage(doctorId, window);

  if (bookingType === 'VISIT' && policy.limits.privateConsultations !== null) {
    if (usage.privateConsultations >= policy.limits.privateConsultations) {
      const error = new Error('Doctor has reached the monthly Private Consultation limit. Please upgrade your plan.');
      error.statusCode = 403;
      throw error;
    }
  }

  if (bookingType === 'ONLINE' && policy.limits.videoConsultations !== null) {
    if (usage.videoConsultations >= policy.limits.videoConsultations) {
      const error = new Error('Doctor has reached the monthly Video Consultation limit. Please upgrade your plan.');
      error.statusCode = 403;
      throw error;
    }
  }
};

const enforceChatStartLimit = async ({ doctorId }) => {
  const { hasActiveSubscription, policy, window } = await getDoctorSubscriptionContext(doctorId);

  if (!hasActiveSubscription) {
    const error = new Error('Doctor does not have an active subscription. Please renew your plan to use chat.');
    error.statusCode = 403;
    throw error;
  }

  if (!policy || !policy.limits || policy.limits.chatSessions === null) {
    return;
  }

  const usage = await computeDoctorUsage(doctorId, window);

  if (usage.chatSessions >= policy.limits.chatSessions) {
    const error = new Error('Doctor has reached the monthly Chat limit. Please upgrade your plan.');
    error.statusCode = 403;
    throw error;
  }
};

const enforceCrmAccess = async ({ doctorId }) => {
  const { hasActiveSubscription, planName } = await getDoctorSubscriptionContext(doctorId);

  if (!hasActiveSubscription) {
    const error = new Error('Doctor does not have an active subscription.');
    error.statusCode = 403;
    throw error;
  }

  if (planName !== 'PREMIUM') {
    const error = new Error('CRM access is available for PREMIUM plan only.');
    error.statusCode = 403;
    throw error;
  }
};

module.exports = {
  FIXED_PLAN_NAMES,
  normalizePlanName,
  getPlanPolicy,
  getPlanFeatures,
  attachPolicyToPlan,
  ensureFixedPlansExist,
  getSubscriptionWindow,
  computeDoctorUsage,
  computeRemaining,
  getDoctorSubscriptionContext,
  enforceAppointmentBookingLimit,
  enforceChatStartLimit,
  enforceCrmAccess
};
