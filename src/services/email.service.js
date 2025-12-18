/**
 * Email notification service
 * Placeholder for Gmail/SMTP integration
 * In production, integrate with nodemailer or similar service
 */

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email plain text content
 * @returns {Promise<Object>} Success message
 */
const sendEmail = async (options) => {
  const { to, subject, html, text } = options;

  if (!to || !subject) {
    throw new Error('Recipient email and subject are required');
  }

  // TODO: Integrate with nodemailer or similar service
  // For now, log the email (in production, send via SMTP/Gmail API)
  console.log('📧 Email would be sent:', {
    to,
    subject,
    html: html || text,
    timestamp: new Date().toISOString()
  });

  // Placeholder: In production, use nodemailer:
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   service: 'gmail',
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASSWORD
  //   }
  // });
  // await transporter.sendMail({ to, subject, html, text });

  return {
    success: true,
    message: 'Email sent successfully',
    to,
    subject
  };
};

/**
 * Send doctor approval notification
 * @param {Object} doctor - Doctor user object
 * @param {string} status - Approval status (APPROVED/REJECTED)
 * @param {string} message - Optional message from admin
 * @returns {Promise<Object>} Success message
 */
const sendDoctorApprovalNotification = async (doctor, status, message = null) => {
  const subject = status === 'APPROVED' 
    ? 'Your Doctor Account Has Been Approved'
    : 'Your Doctor Account Application Status';

  const html = status === 'APPROVED'
    ? `
      <h2>Account Approved!</h2>
      <p>Dear Dr. ${doctor.fullName},</p>
      <p>Congratulations! Your doctor account has been approved. You can now:</p>
      <ul>
        <li>Access your dashboard</li>
        <li>Accept appointment requests</li>
        <li>Appear in patient search results</li>
      </ul>
      ${message ? `<p><strong>Admin Message:</strong> ${message}</p>` : ''}
      <p>Best regards,<br>MyDoctor Platform Team</p>
    `
    : `
      <h2>Account Status Update</h2>
      <p>Dear Dr. ${doctor.fullName},</p>
      <p>Your doctor account application status: <strong>${status}</strong></p>
      ${message ? `<p><strong>Admin Message:</strong> ${message}</p>` : ''}
      <p>If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>MyDoctor Platform Team</p>
    `;

  return await sendEmail({
    to: doctor.email,
    subject,
    html,
    text: html.replace(/<[^>]*>/g, '')
  });
};

/**
 * Send incomplete profile notification
 * @param {Object} doctor - Doctor user object
 * @param {Array} missingFields - List of missing fields
 * @returns {Promise<Object>} Success message
 */
const sendIncompleteProfileNotification = async (doctor, missingFields = []) => {
  const subject = 'Complete Your Doctor Profile';
  
  const html = `
    <h2>Profile Incomplete</h2>
    <p>Dear Dr. ${doctor.fullName},</p>
    <p>Your doctor profile is incomplete. Please complete the following fields:</p>
    <ul>
      ${missingFields.map(field => `<li>${field}</li>`).join('')}
    </ul>
    <p>You can complete your profile by logging into your dashboard.</p>
    <p>Best regards,<br>MyDoctor Platform Team</p>
  `;

  return await sendEmail({
    to: doctor.email,
    subject,
    html,
    text: html.replace(/<[^>]*>/g, '')
  });
};

/**
 * Send missing documents notification
 * @param {Object} doctor - Doctor user object
 * @returns {Promise<Object>} Success message
 */
const sendMissingDocumentsNotification = async (doctor) => {
  const subject = 'Upload Required Documents';
  
  const html = `
    <h2>Documents Required</h2>
    <p>Dear Dr. ${doctor.fullName},</p>
    <p>Please upload the required documents to complete your profile verification:</p>
    <ul>
      <li>Medical License</li>
      <li>ID Proof</li>
      <li>Educational Certificates</li>
    </ul>
    <p>You can upload documents from your dashboard.</p>
    <p>Best regards,<br>MyDoctor Platform Team</p>
  `;

  return await sendEmail({
    to: doctor.email,
    subject,
    html,
    text: html.replace(/<[^>]*>/g, '')
  });
};

/**
 * Send subscription expiry reminder
 * @param {Object} doctor - Doctor user object
 * @param {number} daysUntilExpiry - Days until subscription expires
 * @returns {Promise<Object>} Success message
 */
const sendSubscriptionExpiryReminder = async (doctor, daysUntilExpiry) => {
  const subject = `Your Subscription Expires in ${daysUntilExpiry} Days`;
  
  const html = `
    <h2>Subscription Expiry Reminder</h2>
    <p>Dear Dr. ${doctor.fullName},</p>
    <p>Your subscription plan will expire in <strong>${daysUntilExpiry} days</strong>.</p>
    <p>Please renew your subscription to continue using all platform features.</p>
    <p>Best regards,<br>MyDoctor Platform Team</p>
  `;

  return await sendEmail({
    to: doctor.email,
    subject,
    html,
    text: html.replace(/<[^>]*>/g, '')
  });
};

module.exports = {
  sendEmail,
  sendDoctorApprovalNotification,
  sendIncompleteProfileNotification,
  sendMissingDocumentsNotification,
  sendSubscriptionExpiryReminder
};












