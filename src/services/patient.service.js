const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Transaction = require('../models/transaction.model');
const Review = require('../models/review.model');
const Notification = require('../models/notification.model');
const MedicalRecord = require('../models/medicalRecord.model');
const Favorite = require('../models/favorite.model');

/**
 * Get patient dashboard statistics
 * @param {string} patientId - Patient user ID
 * @returns {Promise<Object>} Dashboard stats
 */
const getPatientDashboard = async (patientId) => {
  const patient = await User.findById(patientId);
  
  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Patient not found');
  }

  const now = new Date();

  // Get appointments
  const [
    upcomingAppointments,
    completedAppointments,
    cancelledAppointments,
    allAppointments
  ] = await Promise.all([
    Appointment.find({
      patientId,
      appointmentDate: { $gte: now },
      status: { $in: ['PENDING', 'CONFIRMED'] }
    })
      .populate({
        path: 'doctorId',
        select: 'fullName email phone profileImage',
        populate: {
          path: 'doctorProfile',
          select: 'title specialization'
        }
      })
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .limit(10),
    Appointment.find({
      patientId,
      status: 'COMPLETED'
    })
      .populate({
        path: 'doctorId',
        select: 'fullName email phone profileImage',
        populate: {
          path: 'doctorProfile',
          select: 'title specialization'
        }
      })
      .sort({ appointmentDate: -1 })
      .limit(10),
    Appointment.find({
      patientId,
      status: 'CANCELLED'
    })
      .populate('doctorId', 'fullName email phone profileImage')
      .sort({ appointmentDate: -1 })
      .limit(5),
    Appointment.find({ patientId })
  ]);

  // Get unique doctors visited
  const uniqueDoctors = new Set();
  allAppointments.forEach(apt => {
    if (apt.doctorId) {
      uniqueDoctors.add(apt.doctorId.toString());
    }
  });
  const totalDoctorsVisited = uniqueDoctors.size;

  // Get recent reviews
  const recentReviews = await Review.find({ patientId })
    .populate('doctorId', 'fullName profileImage')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get unread notifications count
  const unreadNotificationsCount = await Notification.countDocuments({
    userId: patientId,
    isRead: false
  });

  // Get favorite doctors count
  const favoriteDoctorsCount = await Favorite.countDocuments({ patientId });

  return {
    patient: {
      id: patient._id,
      fullName: patient.fullName,
      email: patient.email,
      profileImage: patient.profileImage
    },
    upcomingAppointments: {
      count: upcomingAppointments.length,
      appointments: upcomingAppointments
    },
    completedAppointments: {
      count: completedAppointments.length,
      appointments: completedAppointments
    },
    cancelledAppointments: {
      count: cancelledAppointments.length,
      appointments: cancelledAppointments
    },
    totalCompletedAppointments: completedAppointments.length,
    totalDoctorsVisited,
    recentReviews,
    unreadNotificationsCount,
    favoriteDoctorsCount
  };
};

/**
 * Get patient appointment history
 * @param {string} patientId - Patient user ID
 * @param {Object} options - Filter and pagination options
 * @returns {Promise<Object>} Appointments and pagination info
 */
const getAppointmentHistory = async (patientId, options = {}) => {
  const { status, fromDate, toDate, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { patientId };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (fromDate || toDate) {
    query.appointmentDate = {};
    if (fromDate) {
      query.appointmentDate.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.appointmentDate.$lte = new Date(toDate);
    }
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate({
        path: 'doctorId',
        select: 'fullName email phone profileImage',
        populate: {
          path: 'doctorProfile',
          select: 'title specialization'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ appointmentDate: -1 }),
    Appointment.countDocuments(query)
  ]);

  return {
    appointments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get patient payment history
 * @param {string} patientId - Patient user ID
 * @param {Object} options - Filter and pagination options
 * @returns {Promise<Object>} Transactions and pagination info
 */
const getPaymentHistory = async (patientId, options = {}) => {
  const { status, fromDate, toDate, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { userId: patientId, amount: { $gt: 0 } };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.createdAt.$lte = new Date(toDate);
    }
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('relatedAppointmentId', 'appointmentNumber appointmentDate appointmentTime')
      .populate({
        path: 'relatedAppointmentId',
        populate: {
          path: 'doctorId',
          select: 'fullName email profileImage'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Transaction.countDocuments(query)
  ]);

  // Format transactions with doctor name
  const formattedTransactions = transactions.map(txn => {
    const txnObj = txn.toObject();
    if (txn.relatedAppointmentId && txn.relatedAppointmentId.doctorId) {
      txnObj.doctorName = txn.relatedAppointmentId.doctorId.fullName;
    }
    return txnObj;
  });

  return {
    transactions: formattedTransactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Create medical record
 * @param {string} patientId - Patient user ID
 * @param {Object} data - Medical record data
 * @returns {Promise<Object>} Created medical record
 */
const createMedicalRecord = async (patientId, data) => {
  const { title, description, recordType, fileUrl, fileName, fileSize, relatedAppointmentId, relatedDoctorId } = data;

  const medicalRecord = await MedicalRecord.create({
    patientId,
    title,
    description,
    recordType: recordType || 'OTHER',
    fileUrl,
    fileName,
    fileSize,
    relatedAppointmentId,
    relatedDoctorId,
    uploadedDate: new Date()
  });

  return medicalRecord;
};

/**
 * Get patient medical records
 * @param {string} patientId - Patient user ID
 * @param {Object} options - Filter and pagination options
 * @returns {Promise<Object>} Medical records and pagination info
 */
const getMedicalRecords = async (patientId, options = {}) => {
  const { recordType, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { patientId };

  if (recordType) {
    query.recordType = recordType.toUpperCase();
  }

  const [records, total] = await Promise.all([
    MedicalRecord.find(query)
      .populate('relatedAppointmentId', 'appointmentNumber appointmentDate')
      .populate('relatedDoctorId', 'fullName')
      .skip(skip)
      .limit(limit)
      .sort({ uploadedDate: -1 }),
    MedicalRecord.countDocuments(query)
  ]);

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Delete medical record
 * @param {string} recordId - Medical record ID
 * @param {string} patientId - Patient user ID
 * @returns {Promise<Object>} Success message
 */
const deleteMedicalRecord = async (recordId, patientId) => {
  const record = await MedicalRecord.findOne({ _id: recordId, patientId });
  
  if (!record) {
    throw new Error('Medical record not found or unauthorized');
  }

  await MedicalRecord.findByIdAndDelete(recordId);

  return { message: 'Medical record deleted successfully' };
};

module.exports = {
  getPatientDashboard,
  getAppointmentHistory,
  getPaymentHistory,
  createMedicalRecord,
  getMedicalRecords,
  deleteMedicalRecord
};












