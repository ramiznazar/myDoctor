const Prescription = require('../models/prescription.model');
const Appointment = require('../models/appointment.model');
const notificationService = require('./notification.service');

const assertAppointmentAccess = async ({ appointmentId, userId, role }) => {
  if (!['DOCTOR', 'PATIENT'].includes((role || '').toString().toUpperCase())) {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage dob gender address');

  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  if (role === 'DOCTOR' && appointment.doctorId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized: This appointment does not belong to you');
    error.statusCode = 403;
    throw error;
  }

  if (role === 'PATIENT' && appointment.patientId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized: This appointment does not belong to you');
    error.statusCode = 403;
    throw error;
  }

  return appointment;
};

const upsertPrescriptionForAppointment = async (doctorId, appointmentId, data) => {
  const appointment = await assertAppointmentAccess({ appointmentId, userId: doctorId, role: 'DOCTOR' });

  if (appointment.status !== 'COMPLETED') {
    const error = new Error('Prescription can only be created after the appointment is completed');
    error.statusCode = 403;
    throw error;
  }

  const existing = await Prescription.findOne({ appointmentId });

  const nextStatus = data?.status || 'ISSUED';

  if (!existing) {
    const created = await Prescription.create({
      appointmentId,
      doctorId,
      patientId: appointment.patientId._id,
      issuedAt: new Date(),
      diagnosis: data?.diagnosis ?? null,
      clinicalNotes: data?.clinicalNotes ?? null,
      allergies: data?.allergies ?? null,
      medications: Array.isArray(data?.medications) ? data.medications : [],
      tests: Array.isArray(data?.tests) ? data.tests : [],
      advice: data?.advice ?? null,
      followUp: data?.followUp ?? null,
      status: nextStatus
    });

    if (created.status === 'ISSUED') {
      await notificationService.createNotification({
        userId: appointment.patientId._id.toString(),
        title: 'New Prescription',
        body: `A prescription has been issued for your appointment ${appointment.appointmentNumber || ''}`.trim(),
        type: 'PRESCRIPTION',
        data: { prescriptionId: created._id.toString(), appointmentId: appointment._id.toString() }
      });
    }

    return Prescription.findById(created._id)
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage dob gender address')
      .populate('appointmentId');
  }

  const previousStatus = existing.status;

  existing.diagnosis = data?.diagnosis ?? existing.diagnosis;
  existing.clinicalNotes = data?.clinicalNotes ?? existing.clinicalNotes;
  existing.allergies = data?.allergies ?? existing.allergies;
  if (Array.isArray(data?.medications)) {
    existing.medications = data.medications;
  }
  if (Array.isArray(data?.tests)) {
    existing.tests = data.tests;
  }
  existing.advice = data?.advice ?? existing.advice;
  existing.followUp = data?.followUp ?? existing.followUp;

  if (data?.status) {
    existing.status = data.status;
  }

  if (existing.status === 'ISSUED' && previousStatus !== 'ISSUED') {
    existing.issuedAt = new Date();
  }

  await existing.save();

  if (existing.status === 'ISSUED' && previousStatus !== 'ISSUED') {
    await notificationService.createNotification({
      userId: appointment.patientId._id.toString(),
      title: 'New Prescription',
      body: `A prescription has been issued for your appointment ${appointment.appointmentNumber || ''}`.trim(),
      type: 'PRESCRIPTION',
      data: { prescriptionId: existing._id.toString(), appointmentId: appointment._id.toString() }
    });
  }

  return Prescription.findById(existing._id)
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage dob gender address')
    .populate('appointmentId');
};

const getPrescriptionByAppointment = async (appointmentId, userId, role) => {
  await assertAppointmentAccess({ appointmentId, userId, role });

  const prescription = await Prescription.findOne({ appointmentId })
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage dob gender address')
    .populate('appointmentId');

  if (!prescription) {
    const error = new Error('Prescription not found');
    error.statusCode = 404;
    throw error;
  }

  return prescription;
};

const getPrescriptionById = async (id, userId, role) => {
  const normalizedRole = (role || '').toString().toUpperCase();
  if (!['DOCTOR', 'PATIENT'].includes(normalizedRole)) {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  const prescription = await Prescription.findById(id)
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage dob gender address')
    .populate('appointmentId');

  if (!prescription) {
    const error = new Error('Prescription not found');
    error.statusCode = 404;
    throw error;
  }

  if (normalizedRole === 'DOCTOR' && prescription.doctorId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized');
    error.statusCode = 403;
    throw error;
  }

  if (normalizedRole === 'PATIENT' && prescription.patientId?._id?.toString() !== userId.toString()) {
    const error = new Error('Unauthorized');
    error.statusCode = 403;
    throw error;
  }

  return prescription;
};

const listPrescriptionsForPatient = async (patientId, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query = { patientId };

  const [prescriptions, total] = await Promise.all([
    Prescription.find(query)
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('appointmentId', 'appointmentNumber appointmentDate appointmentTime bookingType status')
      .sort({ issuedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Prescription.countDocuments(query)
  ]);

  return {
    prescriptions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  upsertPrescriptionForAppointment,
  getPrescriptionByAppointment,
  getPrescriptionById,
  listPrescriptionsForPatient
};
