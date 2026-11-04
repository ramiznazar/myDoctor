const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const SupportTicket = require('../models/supportTicket.model');
const SupportTicketMessage = require('../models/supportTicketMessage.model');
const SupportTicketAttachment = require('../models/supportTicketAttachment.model');
const SupportTicketActivity = require('../models/supportTicketActivity.model');
const Appointment = require('../models/appointment.model');
const Order = require('../models/order.model');
const Transaction = require('../models/transaction.model');
const ProductPrescriptionRequest = require('../models/productPrescriptionRequest.model');
const User = require('../models/user.model');
const { createNotification } = require('./notification.service');

const { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_STATUSES, SUPPORT_TICKET_PRIORITIES, SUPPORT_RELATED_RECORD_TYPES } = SupportTicket;
const MAX_REOPEN_DAYS = 14;
const isId = (value) => mongoose.isValidObjectId(value);
const normalize = (value) => String(value || '').trim();
const enumValue = (value) => normalize(value).toUpperCase();
const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const parseIds = (value) => [...new Set((Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((item) => normalize(item)).filter(Boolean))];
const activity = (ticketId, actorId, type, summary, metadata = null) => SupportTicketActivity.create({ ticketId, actorId: actorId || null, type, summary, metadata });

const assertPatient = (role) => {
  if (enumValue(role) !== 'PATIENT') throw httpError('Only patients can access support tickets', 403);
};

const attachmentDto = (attachment) => ({
  _id: attachment._id,
  name: attachment.originalName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  createdAt: attachment.createdAt,
  downloadUrl: `/support-tickets/attachments/${attachment._id}/download`,
});

const notifyAdmins = async (title, body, data) => {
  const admins = await User.find({ role: 'ADMIN', status: { $nin: ['BLOCKED', 'REJECTED'] } }).select('_id').lean();
  await Promise.allSettled(admins.map((admin) => createNotification({ userId: admin._id, title, body, type: 'SUPPORT_TICKET', data })));
};

const ownedRelatedRecord = async (patientId, typeValue, recordId) => {
  const type = enumValue(typeValue);
  if (!type && !recordId) return { type: null, recordId: null };
  if (!SUPPORT_RELATED_RECORD_TYPES.includes(type)) throw httpError('Unsupported related record type');
  if (type === 'OTHER') return { type, recordId: null };
  if (!isId(recordId)) throw httpError('Choose one of your own records for this ticket');
  let record = null;
  if (type === 'APPOINTMENT') record = await Appointment.exists({ _id: recordId, patientId });
  if (type === 'ORDER') record = await Order.exists({ _id: recordId, patientId });
  if (type === 'TRANSACTION') record = await Transaction.exists({ _id: recordId, userId: patientId });
  if (type === 'PRESCRIPTION') record = await ProductPrescriptionRequest.exists({ _id: recordId, patientId });
  if (!record) throw httpError('The selected related record was not found', 404);
  return { type, recordId };
};

const claimAttachments = async (attachmentIds, userId, ticketId) => {
  if (!attachmentIds.length) return [];
  if (!attachmentIds.every(isId)) throw httpError('One or more attachments are invalid');
  const attachments = await SupportTicketAttachment.find({ _id: { $in: attachmentIds }, uploadedBy: userId, ticketId: null }).select('_id').lean();
  if (attachments.length !== attachmentIds.length) throw httpError('One or more attachments are unavailable');
  await SupportTicketAttachment.updateMany({ _id: { $in: attachmentIds }, uploadedBy: userId, ticketId: null }, { $set: { ticketId } });
  return attachmentIds;
};

const hydrate = async (ticketId) => {
  const ticket = await SupportTicket.findById(ticketId)
    .populate('patientId', 'fullName email phone profileImage')
    .populate('assignedAdminId', 'fullName email')
    .lean();
  if (!ticket) return null;
  const [messages, activities] = await Promise.all([
    SupportTicketMessage.find({ ticketId }).populate('senderId', 'fullName email profileImage role').populate('attachments').sort({ createdAt: 1 }).lean(),
    SupportTicketActivity.find({ ticketId }).populate('actorId', 'fullName email role').sort({ createdAt: 1 }).lean(),
  ]);
  return { ...ticket, messages: messages.map((message) => ({ ...message, attachments: (message.attachments || []).map(attachmentDto) })), activities };
};

const assertReplyAllowed = (ticket) => {
  if (ticket.status === 'CLOSED') throw httpError('This support ticket is closed');
  if (ticket.status === 'RESOLVED') throw httpError('Reopen this resolved ticket before sending a reply');
};

const listMine = async (patientId, role, options = {}) => {
  assertPatient(role);
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query = { patientId };
  const status = enumValue(options.status);
  const category = enumValue(options.category);
  const priority = enumValue(options.priority);
  const search = normalize(options.search);
  if (SUPPORT_TICKET_STATUSES.includes(status)) query.status = status;
  if (SUPPORT_TICKET_CATEGORIES.includes(category)) query.category = category;
  if (SUPPORT_TICKET_PRIORITIES.includes(priority)) query.priority = priority;
  if (search) query.$or = [{ ticketNumber: { $regex: search, $options: 'i' } }, { subject: { $regex: search, $options: 'i' } }];
  const [tickets, total] = await Promise.all([
    SupportTicket.find(query).sort({ lastMessageAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SupportTicket.countDocuments(query),
  ]);
  return { tickets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getMine = async (ticketId, patientId, role) => {
  assertPatient(role);
  if (!isId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findOne({ _id: ticketId, patientId });
  if (!ticket) throw httpError('Support ticket not found', 404);
  if (ticket.unreadForPatient) await SupportTicket.updateOne({ _id: ticketId }, { $set: { unreadForPatient: false } });
  const ticketDetail = await hydrate(ticketId);
  ticketDetail.unreadForPatient = false;
  return ticketDetail;
};

const create = async (patientId, role, payload = {}) => {
  assertPatient(role);
  const subject = normalize(payload.subject);
  const description = normalize(payload.description);
  const category = enumValue(payload.category);
  const priority = enumValue(payload.priority);
  if (subject.length < 4 || subject.length > 180) throw httpError('Subject must be between 4 and 180 characters');
  if (description.length < 10 || description.length > 8000) throw httpError('Description must be between 10 and 8000 characters');
  if (!SUPPORT_TICKET_CATEGORIES.includes(category)) throw httpError('Select a valid support category');
  const relatedRecord = await ownedRelatedRecord(patientId, payload.relatedRecord?.type, payload.relatedRecord?.recordId);
  const ticket = await SupportTicket.create({
    ticketNumber: await SupportTicket.createTicketNumber(), patientId, subject, description, category,
    priority: SUPPORT_TICKET_PRIORITIES.includes(priority) ? priority : 'MEDIUM', relatedRecord, lastMessageAt: new Date(), unreadForAdmin: true,
  });
  const attachments = await claimAttachments(parseIds(payload.attachments), patientId, ticket._id);
  await SupportTicketMessage.create({ ticketId: ticket._id, senderId: patientId, senderRole: 'PATIENT', body: description, attachments });
  await activity(ticket._id, patientId, 'CREATED', `Ticket ${ticket.ticketNumber} was created`);
  if (attachments.length) await activity(ticket._id, patientId, 'ATTACHMENTS_ADDED', `${attachments.length} attachment${attachments.length === 1 ? '' : 's'} added`);
  await notifyAdmins(`New support ticket ${ticket.ticketNumber}`, subject, { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber, category });
  return hydrate(ticket._id);
};

const addPatientMessage = async (ticketId, patientId, role, payload = {}) => {
  assertPatient(role);
  if (!isId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findOne({ _id: ticketId, patientId });
  if (!ticket) throw httpError('Support ticket not found', 404);
  assertReplyAllowed(ticket);
  const body = normalize(payload.body);
  const attachments = await claimAttachments(parseIds(payload.attachments), patientId, ticket._id);
  if (!body && !attachments.length) throw httpError('Write a message or attach a file');
  if (body.length > 8000) throw httpError('Message is too long');
  const priorStatus = ticket.status;
  if (ticket.status === 'WAITING_FOR_PATIENT') ticket.status = 'IN_PROGRESS';
  ticket.unreadForAdmin = true;
  ticket.unreadForPatient = false;
  ticket.lastMessageAt = new Date();
  await ticket.save();
  const message = await SupportTicketMessage.create({ ticketId: ticket._id, senderId: patientId, senderRole: 'PATIENT', body: body || null, attachments });
  await activity(ticket._id, patientId, 'PATIENT_REPLIED', 'Patient sent a reply');
  if (priorStatus !== ticket.status) await activity(ticket._id, patientId, 'STATUS_CHANGED', 'Status changed to In Progress', { from: priorStatus, to: ticket.status });
  await notifyAdmins(`Patient replied to ${ticket.ticketNumber}`, ticket.subject, { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber });
  return message;
};

const reopen = async (ticketId, patientId, role) => {
  assertPatient(role);
  if (!isId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findOne({ _id: ticketId, patientId });
  if (!ticket) throw httpError('Support ticket not found', 404);
  if (ticket.status !== 'RESOLVED') throw httpError('Only resolved tickets can be reopened');
  if (!ticket.resolvedAt || Date.now() - new Date(ticket.resolvedAt).getTime() > MAX_REOPEN_DAYS * 86400000) throw httpError('This ticket can no longer be reopened');
  ticket.status = 'OPEN'; ticket.resolvedAt = null; ticket.unreadForAdmin = true; ticket.lastMessageAt = new Date();
  await ticket.save();
  await activity(ticket._id, patientId, 'REOPENED', 'Patient reopened the ticket');
  await notifyAdmins(`Ticket ${ticket.ticketNumber} reopened`, ticket.subject, { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber });
  return ticket;
};

const getMineUnreadCount = async (patientId, role) => {
  assertPatient(role);
  return { unreadCount: await SupportTicket.countDocuments({ patientId, unreadForPatient: true }) };
};

const listAdmin = async (options = {}) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query = {};
  const status = enumValue(options.status); const category = enumValue(options.category); const priority = enumValue(options.priority); const search = normalize(options.search);
  if (SUPPORT_TICKET_STATUSES.includes(status)) query.status = status;
  if (SUPPORT_TICKET_CATEGORIES.includes(category)) query.category = category;
  if (SUPPORT_TICKET_PRIORITIES.includes(priority)) query.priority = priority;
  if (search) query.$or = [{ ticketNumber: { $regex: search, $options: 'i' } }, { subject: { $regex: search, $options: 'i' } }];
  const [tickets, total] = await Promise.all([
    SupportTicket.find(query).populate('patientId', 'fullName email profileImage').populate('assignedAdminId', 'fullName email').sort({ unreadForAdmin: -1, lastMessageAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SupportTicket.countDocuments(query),
  ]);
  return { tickets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getAdmin = async (ticketId) => {
  if (!isId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw httpError('Support ticket not found', 404);
  if (ticket.unreadForAdmin) await SupportTicket.updateOne({ _id: ticketId }, { $set: { unreadForAdmin: false } });
  const ticketDetail = await hydrate(ticketId);
  ticketDetail.unreadForAdmin = false;
  return ticketDetail;
};

const updateAdmin = async (ticketId, adminId, payload = {}) => {
  if (!isId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw httpError('Support ticket not found', 404);
  const status = enumValue(payload.status); const priority = enumValue(payload.priority); const tasks = [];
  if (status && !SUPPORT_TICKET_STATUSES.includes(status)) throw httpError('Invalid ticket status');
  if (priority && !SUPPORT_TICKET_PRIORITIES.includes(priority)) throw httpError('Invalid ticket priority');
  if (status && status !== ticket.status) {
    const previous = ticket.status; ticket.status = status; ticket.resolvedAt = status === 'RESOLVED' ? new Date() : null; ticket.closedAt = status === 'CLOSED' ? new Date() : null;
    tasks.push(activity(ticket._id, adminId, 'STATUS_CHANGED', `Status changed to ${status.replace(/_/g, ' ')}`, { from: previous, to: status }));
  }
  if (priority && priority !== ticket.priority) {
    const previous = ticket.priority; ticket.priority = priority;
    tasks.push(activity(ticket._id, adminId, 'PRIORITY_CHANGED', `Priority changed to ${priority}`, { from: previous, to: priority }));
  }
  if (payload.assignedAdminId !== undefined) {
    const assigneeId = normalize(payload.assignedAdminId);
    if (assigneeId && !isId(assigneeId)) throw httpError('Invalid assigned admin');
    if (assigneeId && !await User.exists({ _id: assigneeId, role: 'ADMIN' })) throw httpError('Assigned user must be an admin');
    if (String(ticket.assignedAdminId || '') !== assigneeId) { ticket.assignedAdminId = assigneeId || null; tasks.push(activity(ticket._id, adminId, 'ASSIGNED', assigneeId ? 'Ticket assigned to an admin' : 'Ticket assignment cleared')); }
  }
  if (tasks.length) {
    await ticket.save(); await Promise.all(tasks);
    await createNotification({ userId: ticket.patientId, title: `Support ticket ${ticket.ticketNumber} updated`, body: `Its status is now ${ticket.status.replace(/_/g, ' ').toLowerCase()}.`, type: 'SUPPORT_TICKET', data: { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber } });
  }
  return hydrate(ticket._id);
};

const addAdminMessage = async (ticketId, adminId, payload = {}) => {
  if (!isId(ticketId)) throw httpError('Invalid support ticket');
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw httpError('Support ticket not found', 404);
  assertReplyAllowed(ticket);
  const body = normalize(payload.body);
  const attachments = await claimAttachments(parseIds(payload.attachments), adminId, ticket._id);
  if (!body && !attachments.length) throw httpError('Write a message or attach a file');
  if (body.length > 8000) throw httpError('Message is too long');
  const priorStatus = ticket.status;
  if (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') ticket.status = 'WAITING_FOR_PATIENT';
  ticket.unreadForPatient = true; ticket.unreadForAdmin = false; ticket.lastMessageAt = new Date();
  await ticket.save();
  const message = await SupportTicketMessage.create({ ticketId: ticket._id, senderId: adminId, senderRole: 'ADMIN', body: body || null, attachments });
  await activity(ticket._id, adminId, 'ADMIN_REPLIED', 'Admin sent a reply');
  if (priorStatus !== ticket.status) await activity(ticket._id, adminId, 'STATUS_CHANGED', 'Status changed to Waiting for Patient', { from: priorStatus, to: ticket.status });
  await createNotification({ userId: ticket.patientId, title: `Admin replied to support ticket ${ticket.ticketNumber}`, body: ticket.subject, type: 'SUPPORT_TICKET', data: { ticketId: String(ticket._id), ticketNumber: ticket.ticketNumber } });
  return message;
};

const createAttachments = async (files, userId) => {
  if (!files?.length) throw httpError('Select at least one attachment');
  return SupportTicketAttachment.insertMany(files.map((file) => ({ uploadedBy: userId, originalName: file.originalname, storedName: path.basename(file.filename), mimeType: file.mimetype || 'application/octet-stream', size: file.size || 0 })));
};

const attachmentFile = async (attachmentId, userId, role) => {
  if (!isId(attachmentId)) throw httpError('Invalid attachment');
  const attachment = await SupportTicketAttachment.findById(attachmentId).lean();
  if (!attachment?.ticketId) throw httpError('Attachment not found', 404);
  const ticket = await SupportTicket.findById(attachment.ticketId).select('patientId').lean();
  if (!ticket) throw httpError('Attachment not found', 404);
  if (enumValue(role) !== 'ADMIN' && String(ticket.patientId) !== String(userId)) throw httpError('You cannot access this attachment', 403);
  const filePath = path.join(process.cwd(), 'uploads', 'support-tickets', path.basename(attachment.storedName));
  if (!fs.existsSync(filePath)) throw httpError('Attachment file is unavailable', 404);
  return { attachment, filePath };
};

const getAdminUnreadCount = async () => ({ unreadCount: await SupportTicket.countDocuments({ unreadForAdmin: true }) });

module.exports = { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_STATUSES, SUPPORT_TICKET_PRIORITIES, listMine, getMine, create, addPatientMessage, reopen, getMineUnreadCount, listAdmin, getAdmin, updateAdmin, addAdminMessage, createAttachments, attachmentFile, getAdminUnreadCount, attachmentDto };
