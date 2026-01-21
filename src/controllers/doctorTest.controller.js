const asyncHandler = require('../middleware/asyncHandler');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Order = require('../models/order.model');

/**
 * Get all doctor data for testing
 * Returns: patients, appointments, orders, and stats
 * This is a test endpoint, not for production integration
 */
const getDoctorTestData = asyncHandler(async (req, res) => {
  const doctorId = req.userId;

  // Verify user is a doctor
  const doctor = await User.findById(doctorId);
  if (!doctor || doctor.role !== 'DOCTOR') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only doctors can access this endpoint.'
    });
  }

  // Get all patients (users who have appointments with this doctor)
  const patientIds = await Appointment.distinct('patientId', { doctorId });
  const patients = await User.find({
    _id: { $in: patientIds },
    role: 'PATIENT'
  }).select('fullName email phone profileImage address createdAt');

  // Get all appointments for this doctor
  const appointments = await Appointment.find({ doctorId })
    .populate('patientId', 'fullName email phone')
    .sort({ createdAt: -1 });

  // Get all orders where this doctor is the owner
  const orders = await Order.find({ ownerId: doctorId })
    .populate('patientId', 'fullName email phone')
    .populate('pharmacyId', 'name logo')
    .populate('items.productId', 'name images price discountPrice')
    .sort({ createdAt: -1 });

  // Calculate stats
  const stats = {
    // Patient stats
    totalPatients: patients.length,
    newPatientsThisMonth: patients.filter(p => {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(p.createdAt) >= monthAgo;
    }).length,

    // Appointment stats
    totalAppointments: appointments.length,
    appointmentsByStatus: {
      PENDING: appointments.filter(a => a.status === 'PENDING').length,
      CONFIRMED: appointments.filter(a => a.status === 'CONFIRMED').length,
      COMPLETED: appointments.filter(a => a.status === 'COMPLETED').length,
      CANCELLED: appointments.filter(a => a.status === 'CANCELLED').length,
      NO_SHOW: appointments.filter(a => a.status === 'NO_SHOW').length,
      REJECTED: appointments.filter(a => a.status === 'REJECTED').length
    },
    appointmentsByPaymentStatus: {
      UNPAID: appointments.filter(a => a.paymentStatus === 'UNPAID').length,
      PAID: appointments.filter(a => a.paymentStatus === 'PAID').length,
      REFUNDED: appointments.filter(a => a.paymentStatus === 'REFUNDED').length
    },
    appointmentsThisMonth: appointments.filter(a => {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(a.createdAt) >= monthAgo;
    }).length,
    upcomingAppointments: appointments.filter(a => {
      const now = new Date();
      const apptDate = new Date(a.appointmentDate);
      return apptDate >= now && a.status === 'CONFIRMED';
    }).length,

    // Order stats
    totalOrders: orders.length,
    ordersByStatus: {
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
      PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
      SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
      DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
      REFUNDED: orders.filter(o => o.status === 'REFUNDED').length
    },
    ordersByPaymentStatus: {
      PENDING: orders.filter(o => o.paymentStatus === 'PENDING').length,
      PAID: orders.filter(o => o.paymentStatus === 'PAID').length,
      PARTIAL: orders.filter(o => o.paymentStatus === 'PARTIAL').length,
      REFUNDED: orders.filter(o => o.paymentStatus === 'REFUNDED').length
    },
    totalRevenue: orders
      .filter(o => o.paymentStatus === 'PAID')
      .reduce((sum, order) => sum + (order.total || 0), 0),
    revenueThisMonth: orders
      .filter(o => {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return new Date(o.createdAt) >= monthAgo && o.paymentStatus === 'PAID';
      })
      .reduce((sum, order) => sum + (order.total || 0), 0),
    ordersThisMonth: orders.filter(o => {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(o.createdAt) >= monthAgo;
    }).length
  };

  res.json({
    success: true,
    data: {
      doctor: {
        _id: doctor._id,
        fullName: doctor.fullName,
        email: doctor.email,
        phone: doctor.phone
      },
      patients: patients,
      appointments: appointments,
      orders: orders,
      stats: stats
    },
    message: 'Doctor test data retrieved successfully'
  });
});

module.exports = {
  getDoctorTestData
};
