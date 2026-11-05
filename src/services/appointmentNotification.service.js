const Appointment = require('../models/appointment.model');
const Notification = require('../models/notification.model');
const notificationService = require('./notification.service');
const { sendAppointmentReminderEmails } = require('./email.service');
const { computeAppointmentWindow } = require('../utils/appointmentTime');

const userName = (user, fallback) => user?.fullName || user?.name || user?.email || fallback;

/**
 * Notifications are idempotent per participant and action. The worker runs
 * every minute, so checking the persisted action avoids duplicate reminders
 * when a process restarts or runs slightly early/late.
 */
const sendOnce = async ({ userId, appointmentId, action, title, body, data = {} }) => {
  if (!userId) return false;

  const exists = await Notification.exists({
    userId,
    type: 'APPOINTMENT',
    'data.action': action,
    'data.appointmentId': String(appointmentId),
  });
  if (exists) return false;

  await notificationService.createNotification({
    userId,
    title,
    body,
    type: 'APPOINTMENT',
    data: { appointmentId: String(appointmentId), action, ...data },
  });
  return true;
};

const confirmedAppointments = (onlineOnly = false) => Appointment.find({
  status: 'CONFIRMED',
  ...(onlineOnly ? { bookingType: 'ONLINE' } : {}),
})
  .populate('doctorId', 'fullName name email')
  .populate('patientId', 'fullName name email');

/**
 * All appointment clocks are converted through the shared appointment-time
 * utility. It honours the IANA timezone captured from the device and the
 * correct offset for the appointment date, including daylight saving time.
 */
const sendUpcomingAppointmentNotifications = async () => {
  const now = new Date();
  const appointments = await confirmedAppointments();
  let sent = 0;

  for (const appointment of appointments) {
    try {
      const { start } = computeAppointmentWindow(appointment);
      const minutesUntilStart = (start.getTime() - now.getTime()) / 60000;
      // The worker runs every minute. A narrow two-minute window makes the
      // required fifteen-minute reminder reliable without duplicating it.
      if (minutesUntilStart < 13.5 || minutesUntilStart > 15.5) continue;

      const doctorName = userName(appointment.doctorId, 'your doctor');
      const patientName = userName(appointment.patientId, 'your patient');
      const data = { appointmentTime: appointment.appointmentTime, minutesBefore: 15 };
      const created = await Promise.all([
        sendOnce({
          userId: appointment.doctorId?._id,
          appointmentId: appointment._id,
          action: 'APPOINTMENT_REMINDER_15_MIN',
          title: 'Appointment starts in 15 minutes',
          body: `Your appointment with ${patientName} starts at ${appointment.appointmentTime}.`,
          data,
        }),
        sendOnce({
          userId: appointment.patientId?._id,
          appointmentId: appointment._id,
          action: 'APPOINTMENT_REMINDER_15_MIN',
          title: 'Appointment starts in 15 minutes',
          body: `Your appointment with Dr. ${doctorName} starts at ${appointment.appointmentTime}.`,
          data,
        }),
      ]);
      await sendAppointmentReminderEmails({
        appointment,
        doctor: appointment.doctorId,
        patient: appointment.patientId,
      }).catch((error) => console.error('[email] appointment reminder queue failed:', error.message));
      sent += created.filter(Boolean).length;
    } catch (error) {
      console.error('Appointment reminder failed:', appointment?._id, error);
    }
  }

  return { sent };
};

const sendAppointmentTimeNotifications = async () => {
  const now = new Date();
  const appointments = await confirmedAppointments(true);
  let sent = 0;

  for (const appointment of appointments) {
    try {
      const { start, end } = computeAppointmentWindow(appointment);
      const minutesFromStart = (now.getTime() - start.getTime()) / 60000;
      if (minutesFromStart < -0.25 || minutesFromStart > 1 || now > end) continue;

      const doctorName = userName(appointment.doctorId, 'your doctor');
      const patientName = userName(appointment.patientId, 'your patient');
      const data = { appointmentTime: appointment.appointmentTime };
      const created = await Promise.all([
        sendOnce({
          userId: appointment.doctorId?._id,
          appointmentId: appointment._id,
          action: 'VIDEO_CALL_START',
          title: 'Video call appointment time',
          body: `Your video appointment with ${patientName} is ready to join.`,
          data,
        }),
        sendOnce({
          userId: appointment.patientId?._id,
          appointmentId: appointment._id,
          action: 'VIDEO_CALL_START',
          title: 'Video call appointment time',
          body: `Your video appointment with Dr. ${doctorName} is ready to join.`,
          data,
        }),
      ]);
      sent += created.filter(Boolean).length;
    } catch (error) {
      console.error('Appointment start notification failed:', appointment?._id, error);
    }
  }

  return { sent };
};

module.exports = {
  sendAppointmentTimeNotifications,
  sendUpcomingAppointmentNotifications,
};
