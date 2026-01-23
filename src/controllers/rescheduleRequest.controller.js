const asyncHandler = require('../middleware/asyncHandler');
const rescheduleRequestService = require('../services/rescheduleRequest.service');

/**
 * Get appointments eligible for reschedule (patient)
 */
exports.getEligibleAppointments = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.getEligibleAppointmentsForReschedule(req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Create reschedule request (patient)
 */
exports.create = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
    patientId: req.userId
  };
  const result = await rescheduleRequestService.createRescheduleRequest(data);
  res.json({ 
    success: true, 
    message: 'Reschedule request created successfully', 
    data: result 
  });
});

/**
 * List reschedule requests (filtered by role)
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.listRescheduleRequests(
    req.userId,
    req.userRole,
    req.query
  );
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get reschedule request by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.getRescheduleRequestById(
    req.params.id,
    req.userId,
    req.userRole
  );
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Approve reschedule request (doctor)
 */
exports.approve = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.approveRescheduleRequest(
    req.params.id,
    req.userId,
    req.body
  );
  res.json({ 
    success: true, 
    message: 'Reschedule request approved successfully', 
    data: result 
  });
});

/**
 * Reject reschedule request (doctor)
 */
exports.reject = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.rejectRescheduleRequest(
    req.params.id,
    req.userId,
    req.body.rejectionReason
  );
  res.json({ 
    success: true, 
    message: 'Reschedule request rejected successfully', 
    data: result 
  });
});

/**
 * Pay reschedule fee (patient)
 */
exports.pay = asyncHandler(async (req, res) => {
  const result = await rescheduleRequestService.processReschedulePayment(
    req.params.id,
    req.userId,
    req.body.paymentMethod || 'DUMMY'
  );
  res.json({ 
    success: true, 
    message: 'Reschedule fee paid successfully', 
    data: result 
  });
});
