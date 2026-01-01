/**
 * Email notification service
 * Uses nodemailer for sending emails via SMTP
 */

const nodemailer = require('nodemailer');
const env = require('../config/env');

// Create reusable transporter
let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  // Check if SMTP is configured
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn('⚠️  SMTP not configured. Emails will be logged to console only.');
    console.warn('⚠️  Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in your .env file');
    return null;
  }

  // Create transporter
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT) || 587,
    secure: parseInt(env.SMTP_PORT) === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    // For Gmail, you might need:
    // service: 'gmail',
    // For other providers, use host and port
  });

  return transporter;
};

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email plain text content
 * @param {string} options.from - Sender email (optional, defaults to SMTP_USER)
 * @returns {Promise<Object>} Success message
 */
const sendEmail = async (options) => {
  const { to, subject, html, text, from } = options;

  if (!to || !subject) {
    throw new Error('Recipient email and subject are required');
  }

  const emailTransporter = getTransporter();

  // If SMTP is not configured, log the email
  if (!emailTransporter) {
    console.log('📧 Email would be sent (SMTP not configured):', {
      to,
      subject,
      html: html || text,
      timestamp: new Date().toISOString()
    });
    return {
      success: true,
      message: 'Email logged (SMTP not configured)',
      to,
      subject
    };
  }

  try {
    // Send email
    const mailOptions = {
      from: from || env.SMTP_USER || 'noreply@mydoctor.com',
      to,
      subject,
      html: html || text,
      text: text || html?.replace(/<[^>]*>/g, '') || '',
    };

    const info = await emailTransporter.sendMail(mailOptions);
    
    console.log('📧 Email sent successfully:', {
      to,
      subject,
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Email sent successfully',
      to,
      subject,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
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

/**
 * Send password reset OTP code
 * @param {string} email - User email
 * @param {string} code - OTP code
 * @param {string} userName - User's full name (optional)
 * @returns {Promise<Object>} Success message
 */
const sendPasswordResetOTP = async (email, code, userName = null) => {
  const subject = 'Password Reset Verification Code';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0d6efd;">Password Reset Request</h2>
      <p>Dear ${userName || 'User'},</p>
      <p>You have requested to reset your password. Please use the following verification code:</p>
      <div style="background-color: #f8f9fa; border: 2px solid #0d6efd; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <h1 style="color: #0d6efd; margin: 0; font-size: 32px; letter-spacing: 5px;">${code}</h1>
      </div>
      <p><strong>This code will expire in 10 minutes.</strong></p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <p>Best regards,<br>MyDoctor Platform Team</p>
      <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
      <p style="color: #6c757d; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject,
    html,
    text: `Password Reset Verification Code: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you did not request a password reset, please ignore this email.`
  });
};

/**
 * Send password reset success notification
 * @param {string} email - User email
 * @param {string} userName - User's full name (optional)
 * @returns {Promise<Object>} Success message
 */
const sendPasswordResetSuccess = async (email, userName = null) => {
  const subject = 'Password Reset Successful';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #28a745;">Password Reset Successful</h2>
      <p>Dear ${userName || 'User'},</p>
      <p>Your password has been successfully reset.</p>
      <p>If you did not make this change, please contact our support team immediately.</p>
      <p>Best regards,<br>MyDoctor Platform Team</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject,
    html,
    text: `Your password has been successfully reset. If you did not make this change, please contact support immediately.`
  });
};

module.exports = {
  sendEmail,
  sendDoctorApprovalNotification,
  sendIncompleteProfileNotification,
  sendMissingDocumentsNotification,
  sendSubscriptionExpiryReminder,
  sendPasswordResetOTP,
  sendPasswordResetSuccess
};














