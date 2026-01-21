const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Order = require('../models/order.model');

/**
 * Get comprehensive CRM data for external CRM system
 * Returns all patients, appointments, orders, and statistics
 */
const getCrmData = async (filters = {}) => {
  try {
    // Extract filters
    const {
      startDate,
      endDate,
      patientId,
      doctorId,
      orderStatus,
      appointmentStatus
    } = filters;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all patients
    const patientFilter = { role: 'PATIENT' };
    if (patientId) patientFilter._id = patientId;
    
    const patients = await User.find(patientFilter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Get all appointments with populated doctor and patient
    const appointmentFilter = { ...dateFilter };
    if (doctorId) appointmentFilter.doctorId = doctorId;
    if (patientId) appointmentFilter.patientId = patientId;
    if (appointmentStatus) appointmentFilter.status = appointmentStatus;

    const appointments = await Appointment.find(appointmentFilter)
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .sort({ createdAt: -1 })
      .lean();

    // Get all orders with populated patient, pharmacy, and owner
    const orderFilter = { ...dateFilter };
    if (patientId) orderFilter.patientId = patientId;
    if (orderStatus) orderFilter.status = orderStatus;

    const orders = await Order.find(orderFilter)
      .populate('patientId', 'fullName email phone')
      .populate('pharmacyId', 'name logo')
      .populate('ownerId', 'fullName email')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const stats = {
      patients: {
        total: patients.length,
        active: patients.filter(p => p.status === 'APPROVED').length,
        pending: patients.filter(p => p.status === 'PENDING').length,
        blocked: patients.filter(p => p.status === 'BLOCKED').length
      },
      appointments: {
        total: appointments.length,
        pending: appointments.filter(a => a.status === 'PENDING').length,
        confirmed: appointments.filter(a => a.status === 'CONFIRMED').length,
        completed: appointments.filter(a => a.status === 'COMPLETED').length,
        cancelled: appointments.filter(a => a.status === 'CANCELLED').length,
        byType: {
          visit: appointments.filter(a => a.bookingType === 'VISIT').length,
          online: appointments.filter(a => a.bookingType === 'ONLINE').length
        },
        byPaymentStatus: {
          unpaid: appointments.filter(a => a.paymentStatus === 'UNPAID').length,
          paid: appointments.filter(a => a.paymentStatus === 'PAID').length,
          refunded: appointments.filter(a => a.paymentStatus === 'REFUNDED').length
        }
      },
      orders: {
        total: orders.length,
        totalRevenue: orders
          .filter(o => o.paymentStatus === 'PAID')
          .reduce((sum, o) => sum + (o.total || 0), 0),
        byStatus: {
          pending: orders.filter(o => o.status === 'PENDING').length,
          confirmed: orders.filter(o => o.status === 'CONFIRMED').length,
          processing: orders.filter(o => o.status === 'PROCESSING').length,
          shipped: orders.filter(o => o.status === 'SHIPPED').length,
          delivered: orders.filter(o => o.status === 'DELIVERED').length,
          cancelled: orders.filter(o => o.status === 'CANCELLED').length,
          refunded: orders.filter(o => o.status === 'REFUNDED').length
        },
        byPaymentStatus: {
          pending: orders.filter(o => o.paymentStatus === 'PENDING').length,
          paid: orders.filter(o => o.paymentStatus === 'PAID').length,
          partial: orders.filter(o => o.paymentStatus === 'PARTIAL').length,
          refunded: orders.filter(o => o.paymentStatus === 'REFUNDED').length
        },
        averageOrderValue: orders.length > 0
          ? orders.reduce((sum, o) => sum + (o.total || 0), 0) / orders.length
          : 0
      },
      recentActivity: {
        newPatientsLast30Days: patients.filter(p => {
          const daysAgo = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length,
        newAppointmentsLast30Days: appointments.filter(a => {
          const daysAgo = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length,
        newOrdersLast30Days: orders.filter(o => {
          const daysAgo = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length
      }
    };

    return {
      patients,
      appointments,
      orders,
      stats,
      generatedAt: new Date().toISOString(),
      filters: filters
    };
  } catch (error) {
    console.error('Error fetching CRM data:', error);
    throw error;
  }
};

module.exports = {
  getCrmData
};
