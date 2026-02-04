const SubscriptionPlan = require('../models/subscriptionPlan.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Conversation = require('../models/conversation.model');
const DoctorSubscription = require('../models/doctorSubscription.model');

const TARGET_ROLES = {
  DOCTOR: 'DOCTOR',
  PHARMACY: 'PHARMACY'
};

const FIXED_PLAN_NAMES_BY_ROLE = {
  [TARGET_ROLES.DOCTOR]: ['BASIC', 'PRO', 'PREMIUM'],
  [TARGET_ROLES.PHARMACY]: ['STARTER', 'PRO', 'PREMIUM']
};

const FIXED_PLANS_BY_ROLE = {
  [TARGET_ROLES.DOCTOR]: {
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
  },
  [TARGET_ROLES.PHARMACY]: {
    STARTER: {
      name: 'STARTER',
      defaultPrice: 29,
      durationInDays: 30,
      limits: null,
      crmAccess: false
    },
    PRO: {
      name: 'PRO',
      defaultPrice: 59,
      durationInDays: 60,
      limits: null,
      crmAccess: false
    },
    PREMIUM: {
      name: 'PREMIUM',
      defaultPrice: 89,
      durationInDays: 150,
      limits: null,
      crmAccess: false
    }
  }
};

const FIXED_PLAN_NAMES = FIXED_PLAN_NAMES_BY_ROLE[TARGET_ROLES.DOCTOR];

const getFixedPlanNames = (targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  return FIXED_PLAN_NAMES_BY_ROLE[role] || FIXED_PLAN_NAMES_BY_ROLE[TARGET_ROLES.DOCTOR];
};

const getPlanAliases = (targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  if (role === TARGET_ROLES.DOCTOR) {
    return ['FULL', 'MEDIUM'];
  }
  return [];
};

const normalizePlanName = (planName, targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  const name = (planName || '').toString().trim().toUpperCase();

  if (role === TARGET_ROLES.DOCTOR) {
    if (name === 'FULL') return 'PREMIUM';
    if (name === 'MEDIUM') return 'PRO';
  }

  return name;
};

const getPlanPolicy = (planName, targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  const normalized = normalizePlanName(planName, role);
  const policies = FIXED_PLANS_BY_ROLE[role] || FIXED_PLANS_BY_ROLE[TARGET_ROLES.DOCTOR];
  return policies[normalized] || null;
};

const getPlanFeatures = (planName, targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  const policy = getPlanPolicy(planName, role);
  if (!policy) return [];

  if (role === TARGET_ROLES.PHARMACY) {
    return ['Full access'];
  }

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

const attachPolicyToPlan = (planDoc, targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || planDoc?.targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  const planObj = planDoc?.toObject ? planDoc.toObject() : planDoc;
  const policy = getPlanPolicy(planObj?.name, role);

  return {
    ...planObj,
    limits: policy ? policy.limits : null,
    crmAccess: policy ? policy.crmAccess : false
  };
};

const ensureFixedPlansExist = async (targetRole = TARGET_ROLES.DOCTOR) => {
  const role = String(targetRole || TARGET_ROLES.DOCTOR).toUpperCase();
  const fixedNames = getFixedPlanNames(role);
  const aliases = getPlanAliases(role);

  const baseQuery = {
    name: { $in: [...fixedNames, ...aliases] }
  };

  const roleQuery = role === TARGET_ROLES.DOCTOR
    ? {
        $or: [
          { targetRole: TARGET_ROLES.DOCTOR },
          { targetRole: { $exists: false } },
          { targetRole: null }
        ]
      }
    : { targetRole: role };

  const existing = await SubscriptionPlan.find({
    ...baseQuery,
    ...roleQuery
  }).sort({ createdAt: 1 });

  const existingByName = new Map();

  for (const planName of fixedNames) {
    const candidates = existing.filter((p) => normalizePlanName(p.name, role) === planName);
    if (candidates.length === 0) continue;

    const canonical = candidates.find((p) => p.name === planName && p.status === 'ACTIVE')
      || candidates.find((p) => p.status === 'ACTIVE')
      || candidates.find((p) => p.name === planName)
      || candidates[0];

    const duplicates = candidates.filter((p) => p._id.toString() !== canonical._id.toString());

    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        await User.updateMany(
          { subscriptionPlan: dup._id },
          { $set: { subscriptionPlan: canonical._id } }
        );

        if (role === TARGET_ROLES.DOCTOR) {
          await DoctorSubscription.updateMany(
            { planId: dup._id, status: 'ACTIVE' },
            { $set: { planId: canonical._id } }
          );
        }

        dup.status = 'INACTIVE';
        dup.targetRole = role;
        dup.name = `ARCHIVED_${role}_${planName}_${dup._id.toString()}`;
        await dup.save();
      }
    }

    if (!canonical.targetRole) {
      canonical.targetRole = role;
      await canonical.save();
    }

    existingByName.set(planName, canonical);
  }

  const createdOrUpdated = [];

  for (const planName of fixedNames) {
    const policy = FIXED_PLANS_BY_ROLE[role][planName];
    const found = existingByName.get(planName);

    if (!found) {
      const created = await SubscriptionPlan.create({
        targetRole: role,
        name: policy.name,
        price: policy.defaultPrice,
        durationInDays: policy.durationInDays,
        features: getPlanFeatures(policy.name, role),
        status: 'ACTIVE'
      });
      createdOrUpdated.push(created);
      continue;
    }

    let changed = false;

    if (!found.targetRole) {
      found.targetRole = role;
      changed = true;
    }

    if (found.targetRole !== role) {
      found.targetRole = role;
      changed = true;
    }

    if (found.name !== policy.name) {
      found.name = policy.name;
      changed = true;
    }

    if (found.durationInDays !== policy.durationInDays) {
      found.durationInDays = policy.durationInDays;
      changed = true;
    }

    const desiredFeatures = getPlanFeatures(policy.name, role);
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

    if (found.status !== 'ACTIVE') {
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

const enforcePharmacySubscriptionActive = async ({ pharmacyUserId }) => {
  await ensureFixedPlansExist(TARGET_ROLES.PHARMACY);

  const pharmacyUser = await User.findById(pharmacyUserId).populate('subscriptionPlan');
  if (!pharmacyUser || pharmacyUser.role !== TARGET_ROLES.PHARMACY) {
    const error = new Error('Pharmacy not found');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const hasActiveSubscription = pharmacyUser.subscriptionPlan && pharmacyUser.subscriptionExpiresAt && new Date(pharmacyUser.subscriptionExpiresAt) > now;
  if (!hasActiveSubscription) {
    const error = new Error('Pharmacy does not have an active subscription. Please subscribe to continue.');
    error.statusCode = 403;
    throw error;
  }

  const planTargetRole = pharmacyUser.subscriptionPlan?.targetRole;
  if (String(planTargetRole || '').toUpperCase() !== TARGET_ROLES.PHARMACY) {
    const error = new Error('Invalid subscription plan for pharmacy');
    error.statusCode = 403;
    throw error;
  }

  return {
    pharmacyUser,
    subscriptionPlan: attachPolicyToPlan(pharmacyUser.subscriptionPlan, TARGET_ROLES.PHARMACY),
    subscriptionExpiresAt: pharmacyUser.subscriptionExpiresAt,
    hasActiveSubscription
  };
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
  await ensureFixedPlansExist(TARGET_ROLES.DOCTOR);

  const doctor = await User.findById(doctorId).populate('subscriptionPlan');
  if (!doctor || doctor.role !== 'DOCTOR') {
    const error = new Error('Doctor not found');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const hasActiveSubscription = doctor.subscriptionPlan && doctor.subscriptionExpiresAt && new Date(doctor.subscriptionExpiresAt) > now;
  const planName = normalizePlanName(doctor.subscriptionPlan?.name, TARGET_ROLES.DOCTOR);
  const policy = getPlanPolicy(planName, TARGET_ROLES.DOCTOR);

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
  TARGET_ROLES,
  getFixedPlanNames,
  normalizePlanName,
  getPlanPolicy,
  getPlanFeatures,
  attachPolicyToPlan,
  ensureFixedPlansExist,
  enforcePharmacySubscriptionActive,
  getSubscriptionWindow,
  computeDoctorUsage,
  computeRemaining,
  getDoctorSubscriptionContext,
  enforceAppointmentBookingLimit,
  enforceChatStartLimit,
  enforceCrmAccess
};
