const ContactQuery = require('../models/contactQuery.model');
const { sendContactQueryReceivedEmail, sendContactQueryStatusEmail, sendContactQueryResolutionEmail } = require('./email.service');

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const clean = (value, max) => String(value || '').trim().slice(0, max);
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const createContactQuery = async (payload = {}) => {
  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const phone = clean(payload.phone, 80);
  const services = clean(payload.services, 160);
  const message = clean(payload.message, 5000);
  if (name.length < 2) throw error('Enter your name');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw error('Enter a valid email address');
  if (message.length < 10) throw error('Please provide at least 10 characters so we can help.');
  const query = await ContactQuery.create({ name, email, phone, services, message });
  await sendContactQueryReceivedEmail({ query });
  return query;
};

const listContactQueries = async (options = {}) => {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const query = {};
  const status = clean(options.status, 30).toUpperCase();
  const search = clean(options.search, 160);
  if (STATUSES.includes(status)) query.status = status;
  if (search) query.$or = ['name', 'email', 'phone', 'services', 'message'].map((field) => ({ [field]: { $regex: search, $options: 'i' } }));
  const [queries, total] = await Promise.all([
    ContactQuery.find(query).populate('resolvedBy', 'fullName email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ContactQuery.countDocuments(query),
  ]);
  return { queries, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getContactQuery = async (id) => {
  const query = await ContactQuery.findById(id).populate('resolvedBy', 'fullName email').lean();
  if (!query) throw error('Contact inquiry not found', 404);
  return query;
};

const updateContactQuery = async (id, adminId, payload = {}) => {
  const query = await ContactQuery.findById(id);
  if (!query) throw error('Contact inquiry not found', 404);
  const status = payload.status === undefined ? query.status : clean(payload.status, 30).toUpperCase();
  if (!STATUSES.includes(status)) throw error('Select a valid inquiry status');
  query.status = status;
  if (payload.adminNotes !== undefined) query.adminNotes = clean(payload.adminNotes, 5000);
  if (status === 'RESOLVED' && !query.resolvedAt) { query.resolvedAt = new Date(); query.resolvedBy = adminId; }
  if (status !== 'RESOLVED') { query.resolvedAt = null; query.resolvedBy = null; }
  await query.save();
  await sendContactQueryStatusEmail({ query });
  return getContactQuery(query._id);
};

const resolveContactQuery = async (id, adminId, payload = {}) => {
  const responseMessage = clean(payload.responseMessage, 5000);
  if (!responseMessage) throw error('Write a response for the requester before resolving this inquiry');
  const query = await ContactQuery.findById(id);
  if (!query) throw error('Contact inquiry not found', 404);
  if (query.status === 'RESOLVED') throw error('This inquiry has already been resolved');

  query.status = 'RESOLVED';
  query.resolutionMessage = responseMessage;
  query.responseQueuedAt = new Date();
  query.resolvedAt = new Date();
  query.resolvedBy = adminId;
  if (payload.adminNotes !== undefined) query.adminNotes = clean(payload.adminNotes, 5000);
  await query.save();
  await sendContactQueryResolutionEmail({ query, responseMessage });
  return getContactQuery(query._id);
};

const deleteContactQuery = async (id) => {
  const deleted = await ContactQuery.findByIdAndDelete(id);
  if (!deleted) throw error('Contact inquiry not found', 404);
  return { message: 'Contact inquiry deleted' };
};

module.exports = { createContactQuery, listContactQueries, getContactQuery, updateContactQuery, resolveContactQuery, deleteContactQuery };
