/**
 * Central transactional email service.
 *
 * Workflow services call the named helpers below instead of creating SMTP
 * transports or HTML inline. Non-blocking emails are placed in a durable
 * outbox; security codes are sent synchronously so unusable codes are never
 * issued when email delivery is unavailable.
 */
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const env = require('../config/env');
const EmailNotification = require('../models/emailNotification.model');

let transporter = null;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const plainText = (html) => String(html || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/\n{3,}/g, '\n\n').trim();

const money = (value, currency = 'EUR') => new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: currency || 'EUR',
}).format(Number(value || 0));

const dateTime = (value, timeZone = 'Europe/Rome', includeTime = true) => {
  if (!value) return 'Non specificato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const options = { day: '2-digit', month: 'long', year: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}) };
  try { return new Intl.DateTimeFormat('it-IT', { ...options, timeZone: timeZone || 'Europe/Rome' }).format(date); }
  catch (_) { return new Intl.DateTimeFormat('it-IT', { ...options, timeZone: 'Europe/Rome' }).format(date); }
};

const nameOf = (user, fallback = 'utente') => user?.fullName || user?.name || user?.email || fallback;
const idOf = (value) => String(value?._id || value || '');
const roleLabel = (role) => ({ DOCTOR: 'medico', PHARMACY: 'farmacia', PARAPHARMACY: 'parafarmacia', PATIENT: 'paziente' }[String(role || '').toUpperCase()] || 'account');
const statusLabel = (status) => ({
  PENDING: 'in attesa', PENDING_PAYMENT: 'in attesa di pagamento', CONFIRMED: 'confermato', PROCESSING: 'in preparazione', SHIPPED: 'spedito', DELIVERED: 'consegnato', CANCELLED: 'annullato', REJECTED: 'rifiutato', COMPLETED: 'completato', PAID: 'pagato', SUCCESS: 'eseguito', REFUNDED: 'rimborsato', APPROVED: 'approvato', FAILED: 'non riuscito',
}[String(status || '').toUpperCase()] || String(status || 'aggiornato').toLowerCase());
const transactionTypeLabel = (type) => ({
  APPOINTMENT: 'Appuntamento', ORDER: 'Ordine', PRODUCT: 'Prodotto',
  SUBSCRIPTION: 'Abbonamento', REFUND: 'Rimborso', TOPUP: 'Ricarica',
  BALANCE_CREDIT: 'Accredito sul saldo', BALANCE_DEBIT: 'Addebito sul saldo',
}[String(type || '').toUpperCase()] || String(type || 'Transazione'));

const detailsTable = (rows = []) => {
  const content = rows.filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `<tr><td style="padding:10px 0;color:#607083;font-size:14px;line-height:1.45;vertical-align:top;width:43%;">${escapeHtml(label)}</td><td style="padding:10px 0;color:#183449;font-size:14px;font-weight:650;line-height:1.45;vertical-align:top;">${escapeHtml(value)}</td></tr>`).join('');
  return content ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #e5edf2;border-bottom:1px solid #e5edf2;margin:23px 0;">${content}</table>` : '';
};

const button = (url, label) => url ? `<p style="margin:28px 0 2px;text-align:center;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#087f94;color:#fff;padding:13px 23px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.1px;">${escapeHtml(label)}</a></p>` : '';

const layout = ({ eyebrow = 'MY DOCTOR', title, preview, body }) => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f2f7f9;font-family:Arial,Helvetica,sans-serif;color:#183449;"><span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;color:transparent;">${escapeHtml(preview || title)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f7f9;padding:30px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(22,69,88,.11);"><tr><td style="padding:27px 34px;background:linear-gradient(135deg,#0a3f58 0%,#087f94 55%,#22b6b7 100%);color:#fff;"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.18);text-align:center;vertical-align:middle;font-size:24px;font-weight:700;line-height:38px;">✚</td><td style="padding-left:11px;"><div style="font-size:19px;font-weight:700;letter-spacing:.2px;">mydoctor<span style="color:#88fff3;">+</span></div><div style="font-size:11px;letter-spacing:1.2px;font-weight:700;opacity:.84;margin-top:2px;">${escapeHtml(eyebrow)}</div></td></tr></table></td></tr><tr><td style="padding:34px 34px 30px;"><h1 style="font-size:25px;line-height:1.3;letter-spacing:-.35px;margin:0 0 17px;color:#153147;">${escapeHtml(title)}</h1>${body}</td></tr><tr><td style="padding:18px 34px;background:#f7fafb;border-top:1px solid #e5edf2;color:#6b7e8c;font-size:12px;line-height:1.65;">Questa è una comunicazione automatica di My Doctor. Per proteggere il tuo account, non condividere mai codici di verifica o credenziali.</td></tr></table></td></tr></table></body></html>`;

const smtpConfigured = () => Boolean(env.EMAIL_ENABLED && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const getTransporter = () => {
  if (transporter) return transporter;
  if (!smtpConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Boolean(env.SMTP_SECURE),
    requireTLS: Boolean(env.SMTP_REQUIRE_TLS),
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    tls: { minVersion: 'TLSv1.2', servername: env.SMTP_HOST },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html, text, from }) => {
  if (!to || !subject) throw new Error('Recipient and subject are required');
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('[email] SMTP is not configured; email delivery was skipped', { subject, recipient: to });
    return { skipped: true, reason: 'SMTP_NOT_CONFIGURED' };
  }
  try {
    const info = await mailer.sendMail({
      from: from || { address: env.SMTP_FROM || env.SMTP_USER, name: env.SMTP_FROM_NAME || 'My Doctor' },
      to, subject, text: text || plainText(html), html,
    });
    console.info('[email] delivered', { subject, recipient: to, messageId: info.messageId });
    return { messageId: info.messageId, accepted: info.accepted || [] };
  } catch (error) {
    console.error('[email] SMTP delivery failed', { recipient: to, subject, code: error?.code, responseCode: error?.responseCode, message: error?.message });
    throw error;
  }
};

const queueEmail = async ({ key, type, to, subject, html, text, metadata = {} }) => {
  if (!to) return { skipped: true, reason: 'NO_RECIPIENT' };
  const dedupeKey = key || `${type}:${String(to).toLowerCase()}:${crypto.randomUUID()}`;
  const document = {
    dedupeKey,
    type,
    recipient: String(to).trim().toLowerCase(),
    subject,
    html,
    text: text || plainText(html),
    metadata,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: new Date(),
  };
  let created = false;
  try {
    const result = await EmailNotification.updateOne({ dedupeKey }, { $setOnInsert: document }, { upsert: true });
    created = Boolean(result.upsertedCount || result.upsertedId);
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  const notification = await EmailNotification.findOne({ dedupeKey });
  if (created && notification?._id) setImmediate(() => processEmailNotification(notification._id).catch((error) => console.error('[email] outbox processor failed', error.message)));
  return { queued: created, notification };
};

const retryDelayMs = (attempt) => Math.min(60 * 60 * 1000, 30 * 1000 * (2 ** Math.max(0, attempt - 1)));
const processEmailNotification = async (notificationId) => {
  const now = new Date();
  const notification = await EmailNotification.findOneAndUpdate(
    { _id: notificationId, status: { $in: ['PENDING', 'FAILED'] }, attempts: { $lt: 5 }, nextAttemptAt: { $lte: now } },
    { $set: { status: 'SENDING', lastError: null, lastAttemptAt: now }, $inc: { attempts: 1 } }, { new: true },
  );
  if (!notification) return { processed: false };
  try {
    const delivery = await sendEmail({ to: notification.recipient, subject: notification.subject, html: notification.html, text: notification.text });
    if (delivery?.skipped) {
      await EmailNotification.updateOne({ _id: notification._id }, { $set: { status: 'SKIPPED', lastError: delivery.reason || 'SMTP_NOT_CONFIGURED' } });
      return { processed: true, skipped: true };
    }
    await EmailNotification.updateOne({ _id: notification._id }, { $set: { status: 'SENT', messageId: delivery.messageId || null, sentAt: new Date(), lastError: null } });
    return { processed: true, sent: true };
  } catch (error) {
    const exhausted = notification.attempts >= notification.maxAttempts;
    await EmailNotification.updateOne({ _id: notification._id }, { $set: { status: 'FAILED', lastError: String(error?.message || 'SMTP delivery failed').slice(0, 2000), nextAttemptAt: exhausted ? new Date('9999-12-31T00:00:00.000Z') : new Date(Date.now() + retryDelayMs(notification.attempts)) } });
    return { processed: true, sent: false, error: error?.message };
  }
};

const processPendingEmails = async (limit = 25) => {
  // A worker can be interrupted after atomically acquiring a record.  Release
  // only genuinely stale locks so a restart cannot strand a notification in
  // SENDING forever, while an active SMTP request remains exclusive.
  const now = new Date();
  const staleBefore = new Date(now.getTime() - (10 * 60 * 1000));
  await EmailNotification.updateMany(
    { status: 'SENDING', $or: [{ lastAttemptAt: { $lte: staleBefore } }, { lastAttemptAt: null }] },
    { $set: { status: 'FAILED', nextAttemptAt: now, lastError: 'Recovered a stale email delivery attempt' } },
  );
  const records = await EmailNotification.find({ status: { $in: ['PENDING', 'FAILED'] }, attempts: { $lt: 5 }, nextAttemptAt: { $lte: now } }).sort({ nextAttemptAt: 1 }).limit(Math.max(1, Math.min(100, Number(limit) || 25))).select('_id');
  const results = await Promise.all(records.map((record) => processEmailNotification(record._id)));
  return { checked: records.length, sent: results.filter((result) => result.sent).length };
};

// Transactional events must never turn a completed business action into a
// failed HTTP response.  Security-code emails deliberately use sendEmail()
// directly; every other template is persisted in the outbox and failures are
// logged for the worker to retry without interrupting the caller.
const queueTemplate = ({ key, type, to, subject, title, preview, body, metadata, eyebrow }) => queueEmail({ key, type, to, subject, html: layout({ title, preview, body, eyebrow }), metadata })
  .catch((error) => {
    console.error('[email] unable to queue transactional notification', { type, recipient: to, message: error?.message });
    return { queued: false, error: error?.message || 'OUTBOX_QUEUE_FAILED' };
  });

const verificationEmail = ({ name, email, code, purpose }) => {
  const changing = purpose === 'change';
  const verifying = purpose === 'verify';
  const title = verifying ? 'Verifica il tuo indirizzo email' : changing ? 'Conferma la modifica della password' : 'Reimposta la tua password';
  const message = verifying ? 'Usa il codice qui sotto per attivare il tuo account My Doctor.' : changing ? 'Hai richiesto di modificare la password del tuo account My Doctor.' : 'Abbiamo ricevuto una richiesta di reimpostazione della password del tuo account My Doctor.';
  const html = layout({ title, preview: 'Il tuo codice di sicurezza My Doctor.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(name || 'utente')},</p><p style="font-size:15px;line-height:1.7;">${escapeHtml(message)}</p><div style="margin:25px 0;padding:21px 16px;background:#edf8f9;border:1px solid #bce5e5;border-radius:12px;text-align:center;"><div style="font-size:12px;color:#50717b;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;">Codice di verifica</div><div style="font-size:34px;letter-spacing:8px;color:#087f94;font-weight:800;line-height:1.1;">${escapeHtml(code)}</div></div><p style="font-size:14px;line-height:1.65;color:#526876;margin:0;">Il codice scade tra <strong>10 minuti</strong> e può essere utilizzato una sola volta. Se non hai avviato questa richiesta, ignora questa email.</p>` });
  return sendEmail({ to: email, subject: `${title} · My Doctor`, html });
};

const sendEmailVerificationCodeEmail = ({ name, email, code }) => verificationEmail({ name, email, code, purpose: 'verify' });
const sendPasswordVerificationCodeEmail = ({ name, email, code, purpose = 'reset' }) => verificationEmail({ name, email, code, purpose });
const sendPasswordResetOTP = (email, code, userName) => sendPasswordVerificationCodeEmail({ email, code, name: userName, purpose: 'reset' });
const sendPasswordResetSuccess = ({ email, name } = {}) => queueTemplate({ key: `password-reset-success:${String(email || '').toLowerCase()}:${Date.now()}`, type: 'PASSWORD_RESET_SUCCESS', to: email, subject: 'Password aggiornata con successo · My Doctor', title: 'La tua password è stata aggiornata', preview: 'La password del tuo account My Doctor è stata modificata.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(name || 'utente')},</p><p style="font-size:15px;line-height:1.7;">La password del tuo account è stata aggiornata con successo.</p><div style="padding:15px 17px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#8a4117;font-size:14px;line-height:1.6;">Se non hai effettuato tu questa modifica, contatta immediatamente il supporto My Doctor.</div>` });

const sendWelcomeEmail = ({ user, name, email }) => queueTemplate({ key: `welcome:${idOf(user) || String(email || '').toLowerCase()}`, type: 'WELCOME', to: email || user?.email, subject: 'Benvenuto in My Doctor', title: 'Benvenuto in My Doctor', preview: 'Il tuo account è pronto per iniziare.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(name || nameOf(user))},</p><p style="font-size:16px;line-height:1.7;">Siamo felici di darti il benvenuto. My Doctor riunisce medici, pazienti e servizi sanitari in un unico spazio semplice e sicuro.</p><div style="padding:19px 20px;background:#edf8f9;border:1px solid #c2e7e6;border-radius:11px;font-size:14px;line-height:1.7;"><strong>Il tuo account è pronto.</strong><br>Accedi per gestire appuntamenti, comunicazioni, documenti sanitari e i servizi disponibili per il tuo profilo.</div>${button(`${env.APP_URL}/login`, 'Accedi a My Doctor')}` });
const sendApprovalEmail = ({ user, name, email, role }) => queueTemplate({ key: `account-approved:${idOf(user) || String(email || '').toLowerCase()}`, type: 'ACCOUNT_APPROVED', to: email || user?.email, subject: 'Il tuo account My Doctor è stato approvato', title: 'Il tuo account è stato approvato', preview: 'La verifica del tuo account My Doctor è completata.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(name || nameOf(user))},</p><p style="font-size:16px;line-height:1.7;">La verifica del tuo account ${escapeHtml(roleLabel(role || user?.role))} è stata completata con successo.</p><div style="padding:18px 20px;background:#ecfdf5;border:1px solid #b7ead1;border-radius:11px;color:#14532d;font-size:14px;line-height:1.65;"><strong>Account approvato.</strong><br>Ora puoi accedere alle funzionalità disponibili per il tuo ruolo su My Doctor.</div>${button(`${env.APP_URL}/login`, 'Accedi al tuo account')}` });

const appointmentDetails = (appointment, doctor, patient) => detailsTable([
  ['Riferimento', appointment?.appointmentNumber || idOf(appointment)], ['Medico', `Dott. ${nameOf(doctor, 'Medico')}`], ['Paziente', nameOf(patient, 'Paziente')], ['Data e ora', `${dateTime(appointment?.appointmentDate, 'UTC', false)}${appointment?.appointmentTime ? `, ${appointment.appointmentTime}` : ''}`], ['Tipo', appointment?.bookingType === 'ONLINE' ? 'Visita online' : 'Visita in presenza'], ['Importo', appointment?.totalAmount !== undefined ? money(appointment.totalAmount, appointment.currency) : null],
]);
const sendAppointmentBookedEmails = async ({ appointment, patient, doctor }) => Promise.all([
  queueTemplate({ key: `appointment-booked:${idOf(appointment)}:patient`, type: 'APPOINTMENT_BOOKED_PATIENT', to: patient?.email, subject: 'Richiesta di appuntamento ricevuta · My Doctor', title: 'La tua richiesta è stata ricevuta', preview: 'Stiamo inviando la richiesta al medico.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(patient))},</p><p style="font-size:15px;line-height:1.7;">Abbiamo ricevuto la tua richiesta di appuntamento. Ti avviseremo non appena il medico la aggiornerà.</p>${appointmentDetails(appointment, doctor, patient)}${button(`${env.APP_URL}/patient/appointments`, 'Vedi i miei appuntamenti')}`, metadata: { appointmentId: idOf(appointment), recipientRole: 'PATIENT' } }),
  queueTemplate({ key: `appointment-booked:${idOf(appointment)}:doctor`, type: 'APPOINTMENT_BOOKED_DOCTOR', to: doctor?.email, subject: 'Nuova richiesta di appuntamento · My Doctor', title: 'Hai una nuova richiesta di appuntamento', preview: 'Un paziente ha inviato una richiesta di visita.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao Dott. ${escapeHtml(nameOf(doctor))},</p><p style="font-size:15px;line-height:1.7;">${escapeHtml(nameOf(patient))} ha inviato una nuova richiesta di appuntamento.</p>${appointmentDetails(appointment, doctor, patient)}${button(`${env.APP_URL}/doctor/appointments`, 'Gestisci la richiesta')}`, metadata: { appointmentId: idOf(appointment), recipientRole: 'DOCTOR' } }),
]);
const sendAppointmentStatusEmail = ({ appointment, patient, doctor, status, reason }) => {
  const accepted = String(status || appointment?.status).toUpperCase() === 'CONFIRMED';
  const statusText = accepted ? 'confermato' : String(status || appointment?.status).toUpperCase() === 'REJECTED' ? 'rifiutato' : statusLabel(status || appointment?.status);
  return queueTemplate({ key: `appointment-status:${idOf(appointment)}:${String(status || appointment?.status).toUpperCase()}:patient`, type: 'APPOINTMENT_STATUS', to: patient?.email, subject: `Appuntamento ${statusText} · My Doctor`, title: `Il tuo appuntamento è stato ${statusText}`, preview: `Aggiornamento per l'appuntamento ${appointment?.appointmentNumber || ''}.`, body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(patient))},</p><p style="font-size:15px;line-height:1.7;">Il Dott. ${escapeHtml(nameOf(doctor))} ha ${escapeHtml(statusText)} il tuo appuntamento.</p>${appointmentDetails(appointment, doctor, patient)}${reason ? `<div style="padding:15px 17px;background:#f8fafc;border-left:4px solid #087f94;border-radius:5px;font-size:14px;line-height:1.6;"><strong>Nota del medico</strong><br>${escapeHtml(reason)}</div>` : ''}${button(`${env.APP_URL}/patient/appointments`, 'Apri appuntamento')}`, metadata: { appointmentId: idOf(appointment), status: String(status || appointment?.status).toUpperCase() } });
};
const sendAppointmentReminderEmails = ({ appointment, patient, doctor }) => Promise.all([
  queueTemplate({ key: `appointment-reminder-15:${idOf(appointment)}:patient`, type: 'APPOINTMENT_REMINDER', to: patient?.email, subject: 'Promemoria: appuntamento tra 15 minuti · My Doctor', title: 'Il tuo appuntamento inizia tra 15 minuti', preview: 'Preparati per il tuo appuntamento My Doctor.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(patient))},</p><p style="font-size:15px;line-height:1.7;">Il tuo appuntamento con il Dott. ${escapeHtml(nameOf(doctor))} inizia tra 15 minuti.</p>${appointmentDetails(appointment, doctor, patient)}${button(`${env.APP_URL}/patient/appointments`, appointment?.bookingType === 'ONLINE' ? 'Apri la video visita' : 'Apri appuntamento')}`, metadata: { appointmentId: idOf(appointment), recipientRole: 'PATIENT' } }),
  queueTemplate({ key: `appointment-reminder-15:${idOf(appointment)}:doctor`, type: 'APPOINTMENT_REMINDER', to: doctor?.email, subject: 'Promemoria: appuntamento tra 15 minuti · My Doctor', title: 'Il tuo appuntamento inizia tra 15 minuti', preview: 'Preparati per la prossima visita.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao Dott. ${escapeHtml(nameOf(doctor))},</p><p style="font-size:15px;line-height:1.7;">Il tuo appuntamento con ${escapeHtml(nameOf(patient))} inizia tra 15 minuti.</p>${appointmentDetails(appointment, doctor, patient)}${button(`${env.APP_URL}/doctor/appointments`, appointment?.bookingType === 'ONLINE' ? 'Apri la video visita' : 'Apri appuntamento')}`, metadata: { appointmentId: idOf(appointment), recipientRole: 'DOCTOR' } }),
]);

const orderRows = (order) => (order?.items || []).map((item) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e8eef1;font-size:14px;"><strong>${escapeHtml(item?.productId?.name || item?.name || 'Prodotto')}</strong>${item?.variantName ? `<br><span style="font-size:12px;color:#6b7e8c;">${escapeHtml(item.variantName)}</span>` : ''}</td><td style="padding:10px 0;border-bottom:1px solid #e8eef1;text-align:center;font-size:14px;">${escapeHtml(item?.quantity || 0)}</td><td style="padding:10px 0;border-bottom:1px solid #e8eef1;text-align:right;font-size:14px;font-weight:700;">${escapeHtml(money(item?.total || (Number(item?.price || 0) * Number(item?.quantity || 0)), order?.currency))}</td></tr>`).join('');
const orderTable = (order) => `<h2 style="font-size:16px;margin:24px 0 8px;color:#153147;">Prodotti</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr><th align="left" style="padding:8px 0;border-bottom:1px solid #cddbe0;font-size:11px;color:#607083;text-transform:uppercase;">Prodotto</th><th align="center" style="padding:8px 0;border-bottom:1px solid #cddbe0;font-size:11px;color:#607083;text-transform:uppercase;">Qtà</th><th align="right" style="padding:8px 0;border-bottom:1px solid #cddbe0;font-size:11px;color:#607083;text-transform:uppercase;">Totale</th></tr>${orderRows(order)}</table>`;
const orderDetails = (order, patient, seller) => detailsTable([
  ['Riferimento ordine', order?.orderNumber || idOf(order)], ['Paziente', patient ? nameOf(patient) : null], ['Venditore', seller ? nameOf(seller) : null], ['Subtotale', money(order?.subtotal, order?.currency)], ['Spedizione', order?.finalShipping === null || order?.finalShipping === undefined ? 'Da definire' : money(order?.finalShipping, order?.currency)], ['Totale', money(order?.total, order?.currency)], ['Stato', statusLabel(order?.status)],
]);
const sendOrderConfirmationEmail = ({ order, patient, seller }) => queueTemplate({ key: `order-created:${idOf(order)}:patient`, type: 'ORDER_CONFIRMATION', to: patient?.email, subject: `Ordine ricevuto ${order?.orderNumber || ''} · My Doctor`.trim(), title: 'Il tuo ordine è stato ricevuto', preview: 'La farmacia preparerà la proposta di spedizione.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(patient))},</p><p style="font-size:15px;line-height:1.7;">Abbiamo inviato il tuo ordine a ${escapeHtml(nameOf(seller, 'la farmacia'))}. Riceverai un aggiornamento quando saranno disponibili costo di spedizione e tempi di consegna.</p>${orderDetails(order, patient, seller)}${orderTable(order)}${button(`${env.APP_URL}/patient/orders`, 'Segui il mio ordine')}`, metadata: { orderId: idOf(order), recipientRole: 'PATIENT' } });
const sendNewOrderEmail = ({ order, patient, seller }) => queueTemplate({ key: `order-created:${idOf(order)}:seller`, type: 'NEW_ORDER', to: seller?.email, subject: `Nuovo ordine ricevuto ${order?.orderNumber || ''} · My Doctor`.trim(), title: 'Hai ricevuto un nuovo ordine', preview: 'Imposta spedizione e impegno di consegna per procedere.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(seller, 'farmacia'))},</p><p style="font-size:15px;line-height:1.7;">${escapeHtml(nameOf(patient, 'Un paziente'))} ha inviato un nuovo ordine. Imposta il costo di spedizione e l'impegno di consegna per consentire il pagamento.</p>${orderDetails(order, patient, seller)}${orderTable(order)}${button(`${env.APP_URL}/pharmacy/orders`, 'Gestisci ordine')}`, metadata: { orderId: idOf(order), recipientRole: 'SELLER' } });
const sendShippingFeeSetEmail = ({ order, patient, seller }) => queueTemplate({ key: `shipping-updated:${idOf(order)}:${order?.shippingUpdatedAt ? new Date(order.shippingUpdatedAt).getTime() : ''}:patient`, type: 'SHIPPING_UPDATED', to: patient?.email, subject: `Spedizione pronta per l'ordine ${order?.orderNumber || ''} · My Doctor`.trim(), title: 'Il tuo ordine è pronto per il pagamento', preview: 'Sono disponibili costo di spedizione e data stimata di consegna.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(patient))},</p><p style="font-size:15px;line-height:1.7;">${escapeHtml(nameOf(seller, 'La farmacia'))} ha impostato il costo di spedizione e l'impegno di consegna per il tuo ordine.</p>${orderDetails(order, patient, seller)}${detailsTable([['Impegno di consegna', order?.promisedDeliveryDays ? `${order.promisedDeliveryDays} giorni` : null], ['Consegna stimata', dateTime(order?.expectedDeliveryDate, 'Europe/Rome', false)]])}${button(`${env.APP_URL}/patient/orders`, 'Completa il pagamento')}`, metadata: { orderId: idOf(order), recipientRole: 'PATIENT' } });
const sendPrescriptionReceivedEmail = ({ request, product, patient, seller }) => queueTemplate({ key: `prescription-received:${idOf(request)}:seller`, type: 'PRESCRIPTION_RECEIVED', to: seller?.email, subject: 'Nuova prescrizione da esaminare · My Doctor', title: 'Hai una nuova prescrizione da esaminare', preview: 'Un paziente ha inviato una prescrizione per un prodotto.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(seller, 'farmacia'))},</p><p style="font-size:15px;line-height:1.7;">${escapeHtml(nameOf(patient, 'Un paziente'))} ha inviato una prescrizione per <strong>${escapeHtml(product?.name || 'un prodotto')}</strong>.</p>${detailsTable([['Prodotto', product?.name || 'Prodotto'], ['Paziente', nameOf(patient, 'Paziente')], ['Stato', 'In attesa di revisione']])}${button(`${env.APP_URL}/pharmacy/prescriptions`, 'Esamina la prescrizione')}`, metadata: { prescriptionRequestId: idOf(request), recipientRole: 'SELLER' } });
const sendPrescriptionStatusEmail = ({ request, product, patient, seller }) => {
  const approved = String(request?.status).toUpperCase() === 'APPROVED';
  return queueTemplate({ key: `prescription-reviewed:${idOf(request)}:${String(request?.status).toUpperCase()}:patient`, type: 'PRESCRIPTION_REVIEWED', to: patient?.email, subject: approved ? 'La tua prescrizione è stata approvata · My Doctor' : 'Aggiornamento sulla tua prescrizione · My Doctor', title: approved ? 'La tua prescrizione è stata approvata' : 'La tua prescrizione richiede attenzione', preview: approved ? 'Ora puoi acquistare il prodotto.' : 'Consulta le note della farmacia.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(patient))},</p><p style="font-size:15px;line-height:1.7;">${approved ? `La prescrizione per <strong>${escapeHtml(product?.name || 'il prodotto')}</strong> è stata approvata. Ora puoi procedere con l'acquisto.` : `La prescrizione per <strong>${escapeHtml(product?.name || 'il prodotto')}</strong> non è stata approvata.`}</p>${detailsTable([['Prodotto', product?.name || 'Prodotto'], ['Farmacia', nameOf(seller, 'Farmacia')], ['Stato', approved ? 'Approvata' : 'Non approvata'], ['Nota', request?.reviewNotes || null]])}${button(`${env.APP_URL}/products/${idOf(product)}`, approved ? 'Acquista il prodotto' : 'Apri il prodotto')}`, metadata: { prescriptionRequestId: idOf(request), status: request?.status } });
};
const sendPaymentConfirmationEmail = ({ recipient, transaction, context = {}, role }) => queueTemplate({ key: `payment:${idOf(transaction)}:${idOf(recipient) || String(recipient?.email || '').toLowerCase()}:${context.kind || 'transaction'}`, type: 'PAYMENT_CONFIRMATION', to: recipient?.email, subject: 'Conferma transazione · My Doctor', title: 'La tua transazione è stata registrata', preview: 'Consulta i dettagli della transazione.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(recipient))},</p><p style="font-size:15px;line-height:1.7;">${escapeHtml(context.message || `Abbiamo registrato correttamente una transazione relativa al tuo account ${roleLabel(role || recipient?.role)}.`)}</p>${detailsTable([['Riferimento', transaction?.providerReference || idOf(transaction)], ['Importo', money(transaction?.amount, transaction?.currency)], ['Stato', statusLabel(transaction?.status || 'SUCCESS')], ['Metodo', transaction?.provider || null], ['Dettaglio', context.label || null]])}${button(context.url || `${env.APP_URL}/patient/payments-history`, 'Vedi dettagli')}`, metadata: { transactionId: idOf(transaction), recipientRole: role || recipient?.role, kind: context.kind } });
const balanceUrlFor = (role) => {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'DOCTOR') return `${env.APP_URL}/doctor/payments-history`;
  if (normalized === 'PHARMACY' || normalized === 'PARAPHARMACY') return `${env.APP_URL}/pharmacy/payments-history`;
  return `${env.APP_URL}/patient/payments-history`;
};
const sendBalanceChangeEmail = ({ user, transaction, balance, action = 'CREDIT', label }) => {
  const normalizedAction = String(action).toUpperCase();
  const credited = normalizedAction === 'CREDIT' || normalizedAction === 'TOP_UP';
  const refunded = normalizedAction === 'REFUND';
  const title = refunded ? 'È stato registrato un rimborso' : credited ? 'Il tuo saldo è stato aggiornato' : 'È stata registrata una variazione di saldo';
  const message = refunded
    ? 'È stato registrato un rimborso e il saldo associato è stato aggiornato.'
    : credited
      ? 'Abbiamo accreditato un importo sul tuo saldo My Doctor.'
      : 'Abbiamo registrato un addebito sul tuo saldo My Doctor.';
  return queueTemplate({ key: `balance-change:${idOf(transaction)}:${normalizedAction}`, type: 'BALANCE_CHANGE', to: user?.email, subject: `${title} · My Doctor`, title, preview: 'Consulta i dettagli del tuo saldo.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(user))},</p><p style="font-size:15px;line-height:1.7;">${message}</p>${detailsTable([['Riferimento', transaction?.providerReference || idOf(transaction)], ['Importo', money(Math.abs(Number(transaction?.amount || 0)), transaction?.currency)], ['Operazione', refunded ? 'Rimborso' : credited ? 'Accredito' : 'Addebito'], ['Causale', label ? transactionTypeLabel(label) : transactionTypeLabel(transaction?.metadata?.transactionType)], ['Saldo disponibile', balance !== undefined && balance !== null ? money(balance, transaction?.currency) : null]])}${button(balanceUrlFor(user?.role), 'Apri il mio saldo')}`, metadata: { transactionId: idOf(transaction), recipientRole: user?.role, action: normalizedAction } });
};
const sendRefundEmail = ({ recipient, transaction, label }) => queueTemplate({ key: `refund:${idOf(transaction)}:${idOf(recipient) || String(recipient?.email || '').toLowerCase()}`, type: 'PAYMENT_REFUND', to: recipient?.email, subject: 'Il tuo rimborso è stato elaborato · My Doctor', title: 'Il tuo rimborso è stato elaborato', preview: 'Consulta i dettagli della transazione rimborsata.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(recipient))},</p><p style="font-size:15px;line-height:1.7;">Abbiamo registrato il rimborso della tua transazione. I tempi di disponibilità dell’importo dipendono dal metodo di pagamento utilizzato.</p>${detailsTable([['Riferimento', transaction?.providerReference || idOf(transaction)], ['Importo rimborsato', money(transaction?.amount, transaction?.currency)], ['Stato', 'Rimborsato'], ['Dettaglio', label || null]])}${button(balanceUrlFor(recipient?.role), 'Vedi le transazioni')}`, metadata: { transactionId: idOf(transaction), recipientRole: recipient?.role } });
const sendWithdrawalStatusEmail = ({ user, request, event }) => queueTemplate({ key: `withdrawal:${idOf(request)}:${event}`, type: 'WITHDRAWAL_STATUS', to: user?.email, subject: `Aggiornamento prelievo: ${statusLabel(event)} · My Doctor`, title: `Prelievo ${statusLabel(event)}`, preview: 'Aggiornamento sulla tua richiesta di prelievo.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(user))},</p><p style="font-size:15px;line-height:1.7;">La tua richiesta di prelievo è stata ${escapeHtml(statusLabel(event))}.</p>${detailsTable([['Riferimento', idOf(request)], ['Importo richiesto', money(request?.amount)], ['Importo netto', request?.netAmount !== null && request?.netAmount !== undefined ? money(request.netAmount) : null], ['Metodo', request?.paymentMethod || null], ['Motivo', request?.rejectionReason || null]])}${button(`${env.APP_URL}/balance`, 'Apri il mio saldo')}`, metadata: { withdrawalRequestId: idOf(request), event } });
const sendSubscriptionPurchaseEmail = ({ user, plan, expiresAt, role }) => queueTemplate({ key: `subscription-purchased:${idOf(user)}:${idOf(plan)}:${new Date(expiresAt || 0).getTime()}`, type: 'SUBSCRIPTION_PURCHASED', to: user?.email, subject: 'Il tuo abbonamento My Doctor è attivo', title: 'Il tuo abbonamento è attivo', preview: 'Il piano è stato attivato correttamente.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(user))},</p><p style="font-size:15px;line-height:1.7;">Il tuo abbonamento ${escapeHtml(roleLabel(role || user?.role))} è stato attivato con successo.</p>${detailsTable([['Piano', plan?.name || 'Abbonamento'], ['Importo', money(plan?.price)], ['Scadenza', dateTime(expiresAt, 'Europe/Rome', false)], ['Stato', 'Attivo']])}${button(`${env.APP_URL}/subscription`, 'Gestisci abbonamento')}`, metadata: { userId: idOf(user), planId: idOf(plan), expiresAt } });
const sendSubscriptionExpiryReminder = ({ user, plan, expiresAt, expired = false }) => queueTemplate({ key: `subscription-${expired ? 'expired' : 'reminder'}:${idOf(user)}:${new Date(expiresAt || 0).getTime()}`, type: expired ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_EXPIRING', to: user?.email, subject: expired ? 'Il tuo abbonamento My Doctor è scaduto' : 'Il tuo abbonamento My Doctor scade tra 7 giorni', title: expired ? 'Il tuo abbonamento è scaduto' : 'Il tuo abbonamento scade tra 7 giorni', preview: expired ? 'Rinnova per continuare a utilizzare i servizi.' : 'Rinnova in tempo il tuo abbonamento.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(nameOf(user))},</p><p style="font-size:15px;line-height:1.7;">${expired ? 'Il tuo abbonamento è scaduto. Rinnova per continuare a utilizzare le funzionalità incluse nel tuo piano.' : 'Il tuo abbonamento scadrà tra 7 giorni. Ti consigliamo di rinnovarlo per non interrompere l’accesso ai servizi.'}</p>${detailsTable([['Piano', plan?.name || 'Abbonamento'], ['Scadenza', dateTime(expiresAt, 'Europe/Rome', false)]])}${button(`${env.APP_URL}/subscription`, expired ? 'Rinnova abbonamento' : 'Gestisci abbonamento')}`, metadata: { userId: idOf(user), planId: idOf(plan), expiresAt, expired } });

const sendContactQueryReceivedEmail = ({ query }) => queueTemplate({ key: `contact-query-received:${idOf(query)}`, type: 'CONTACT_QUERY_RECEIVED', to: query?.email, subject: 'Abbiamo ricevuto il tuo messaggio · My Doctor', title: 'Il tuo messaggio è stato ricevuto', preview: 'Il team My Doctor ti risponderà il prima possibile.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(query?.name || 'utente')},</p><p style="font-size:15px;line-height:1.7;">Grazie per aver contattato My Doctor. La tua richiesta è stata ricevuta dal nostro team e ti risponderemo appena possibile.</p>${detailsTable([['Servizio', query?.services || 'Informazioni generali'], ['Stato', 'Ricevuta'], ['Riferimento', idOf(query)]])}`, metadata: { contactQueryId: idOf(query) } });
const sendContactQueryStatusEmail = ({ query }) => {
  const status = String(query?.status || '').toUpperCase();
  if (!['RESOLVED', 'CLOSED'].includes(status)) return Promise.resolve({ skipped: true, reason: 'STATUS_NOT_NOTIFIABLE' });
  const resolved = status === 'RESOLVED';
  return queueTemplate({ key: `contact-query-status:${idOf(query)}:${status}`, type: 'CONTACT_QUERY_STATUS', to: query?.email, subject: resolved ? 'La tua richiesta è stata gestita · My Doctor' : 'Aggiornamento sulla tua richiesta · My Doctor', title: resolved ? 'La tua richiesta è stata gestita' : 'La tua richiesta è stata chiusa', preview: 'È disponibile un aggiornamento dal team My Doctor.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(query?.name || 'utente')},</p><p style="font-size:15px;line-height:1.7;">${resolved ? 'Il nostro team ha completato la gestione della tua richiesta.' : 'La tua richiesta è stata chiusa dal nostro team.'} Per ulteriore assistenza, puoi inviarci un nuovo messaggio dalla pagina Contattaci.</p>${detailsTable([['Riferimento', idOf(query)], ['Stato', resolved ? 'Gestita' : 'Chiusa']])}${button(`${env.APP_URL}/contact-us`, 'Contatta My Doctor')}`, metadata: { contactQueryId: idOf(query), status } });
};
const sendContactQueryResolutionEmail = ({ query, responseMessage }) => queueTemplate({ key: `contact-query-resolution:${idOf(query)}`, type: 'CONTACT_QUERY_RESOLUTION', to: query?.email, subject: 'Risposta alla tua richiesta · My Doctor', title: 'Risposta alla tua richiesta', preview: 'Il team My Doctor ha risposto al tuo messaggio.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao ${escapeHtml(query?.name || 'utente')},</p><p style="font-size:15px;line-height:1.7;">Grazie per aver contattato My Doctor. Il nostro team ha esaminato la tua richiesta e ti ha lasciato la seguente risposta:</p><div style="margin:22px 0;padding:18px 20px;background:#f4fafb;border-left:4px solid #087f94;border-radius:7px;font-size:15px;line-height:1.7;color:#183449;">${escapeHtml(responseMessage).replace(/\r?\n/g, '<br />')}</div>${detailsTable([['Servizio', query?.services || 'Informazioni generali'], ['Il tuo messaggio', query?.message || '—'], ['Stato', 'Gestita']])}${button(`${env.APP_URL}/contact-us`, 'Contatta My Doctor')}`, metadata: { contactQueryId: idOf(query) } });

// Compatibility helpers retained for existing callers.
const sendDoctorApprovalNotification = (doctor, status, message) => String(status).toUpperCase() === 'APPROVED' ? sendApprovalEmail({ user: doctor, role: 'DOCTOR' }) : queueTemplate({ key: `account-status:${idOf(doctor)}:${String(status).toUpperCase()}`, type: 'ACCOUNT_STATUS', to: doctor?.email, subject: 'Aggiornamento account My Doctor', title: 'Aggiornamento sul tuo account', preview: 'È disponibile un aggiornamento per il tuo account.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao Dott. ${escapeHtml(nameOf(doctor))},</p><p style="font-size:15px;line-height:1.7;">Lo stato della tua richiesta è: <strong>${escapeHtml(statusLabel(status))}</strong>.</p>${message ? `<div style="padding:15px;background:#f8fafc;border-left:4px solid #087f94;border-radius:5px;">${escapeHtml(message)}</div>` : ''}` });
const sendIncompleteProfileNotification = (doctor, missing = []) => queueTemplate({ key: `profile-incomplete:${idOf(doctor)}:${missing.join('|')}`, type: 'PROFILE_INCOMPLETE', to: doctor?.email, subject: 'Completa il tuo profilo My Doctor', title: 'Completa il tuo profilo', preview: 'Alcune informazioni del profilo sono mancanti.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao Dott. ${escapeHtml(nameOf(doctor))},</p><p style="font-size:15px;line-height:1.7;">Per completare il tuo profilo, aggiungi le seguenti informazioni:</p><ul style="font-size:15px;line-height:1.8;color:#425b68;">${missing.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>${button(`${env.APP_URL}/doctor/profile-settings`, 'Completa il profilo')}` });
const sendMissingDocumentsNotification = (doctor) => queueTemplate({ key: `documents-missing:${idOf(doctor)}`, type: 'MISSING_DOCUMENTS', to: doctor?.email, subject: 'Documenti richiesti · My Doctor', title: 'Carica i documenti richiesti', preview: 'Sono necessari documenti per completare la verifica.', body: `<p style="font-size:16px;line-height:1.7;margin:0;">Ciao Dott. ${escapeHtml(nameOf(doctor))},</p><p style="font-size:15px;line-height:1.7;">Carica i documenti richiesti per consentire al nostro team di completare la verifica del tuo account.</p>${button(`${env.APP_URL}/doctor-verification-upload`, 'Carica documenti')}` });

module.exports = { sendEmail, queueEmail, processEmailNotification, processPendingEmails, sendEmailVerificationCodeEmail, sendPasswordVerificationCodeEmail, sendPasswordResetOTP, sendPasswordResetSuccess, sendWelcomeEmail, sendApprovalEmail, sendAppointmentBookedEmails, sendAppointmentStatusEmail, sendAppointmentReminderEmails, sendOrderConfirmationEmail, sendNewOrderEmail, sendShippingFeeSetEmail, sendPrescriptionReceivedEmail, sendPrescriptionStatusEmail, sendPaymentConfirmationEmail, sendBalanceChangeEmail, sendRefundEmail, sendWithdrawalStatusEmail, sendSubscriptionPurchaseEmail, sendSubscriptionExpiryReminder, sendContactQueryReceivedEmail, sendContactQueryStatusEmail, sendContactQueryResolutionEmail, sendDoctorApprovalNotification, sendIncompleteProfileNotification, sendMissingDocumentsNotification };
