const Appointment = require('../models/appointment.model');
const notificationService = require('./notification.service');
const User = require('../models/user.model');

/**
 * Send notifications when appointment time arrives
 * This should be called by a scheduled job/cron that runs every minute
 */
const sendAppointmentTimeNotifications = async () => {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find appointments that:
  // 1. Are CONFIRMED
  // 2. Are ONLINE type
  // 3. Appointment date is today
  // 4. Appointment time matches current time (within 1 minute window)
  // 5. Haven't sent notification yet (we'll track this with a flag or check notification existence)
  
  const appointments = await Appointment.find({
    status: 'CONFIRMED',
    bookingType: 'ONLINE',
    appointmentDate: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) // Next day
    }
  })
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');

  const notificationsToSend = [];

  for (const appointment of appointments) {
    // Check if appointment time matches current time (within 1 minute window)
    const appointmentTime = appointment.appointmentTime;
    const [apptHours, apptMinutes] = appointmentTime.split(':').map(Number);
    const [currHours, currMinutes] = currentTime.split(':').map(Number);
    
    // Check if current time is within 1 minute of appointment time
    const appointmentTimeMinutes = apptHours * 60 + apptMinutes;
    const currentTimeMinutes = currHours * 60 + currMinutes;
    const timeDifference = Math.abs(currentTimeMinutes - appointmentTimeMinutes);
    
    if (timeDifference <= 1) { // Within 1 minute
      // Check if we already sent notification (by checking for existing notification)
      const existingNotification = await require('../models/notification.model').findOne({
        userId: { $in: [appointment.doctorId._id, appointment.patientId._id] },
        type: 'APPOINTMENT',
        'data.appointmentId': appointment._id,
        title: { $regex: /appointment.*time|video.*call.*time/i },
        createdAt: {
          $gte: new Date(now.getTime() - 5 * 60 * 1000) // Within last 5 minutes
        }
      });

      if (!existingNotification) {
        // Send notifications to both doctor and patient
        notificationsToSend.push(
          notificationService.createNotification({
            userId: appointment.doctorId._id,
            title: 'Video Call Appointment Time',
            body: `Your video call appointment with ${appointment.patientId.fullName} is starting now. Click to join the call.`,
            type: 'APPOINTMENT',
            data: { 
              appointmentId: appointment._id,
              action: 'VIDEO_CALL_START',
              appointmentTime: appointment.appointmentTime
            }
          }),
          notificationService.createNotification({
            userId: appointment.patientId._id,
            title: 'Video Call Appointment Time',
            body: `Your video call appointment with Dr. ${appointment.doctorId.fullName} is starting now. Click to join the call.`,
            type: 'APPOINTMENT',
            data: { 
              appointmentId: appointment._id,
              action: 'VIDEO_CALL_START',
              appointmentTime: appointment.appointmentTime
            }
          })
        );
      }
    }
  }

  if (notificationsToSend.length > 0) {
    await Promise.all(notificationsToSend);
    console.log(`✅ Sent ${notificationsToSend.length} appointment time notifications`);
  }

  return { sent: notificationsToSend.length };
};

/**
 * Check and send notifications for upcoming appointments (5 minutes before)
 */
const sendUpcomingAppointmentNotifications = async () => {
  const now = new Date();
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
  const fiveMinutesLaterTime = `${fiveMinutesLater.getHours().toString().padStart(2, '0')}:${fiveMinutesLater.getMinutes().toString().padStart(2, '0')}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const appointments = await Appointment.find({
    status: 'CONFIRMED',
    bookingType: 'ONLINE',
    appointmentDate: {
      $gte: today,
      $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
    },
    appointmentTime: fiveMinutesLaterTime
  })
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');

  const notificationsToSend = [];

  for (const appointment of appointments) {
    // Check if we already sent reminder notification
    const Notification = require('../models/notification.model');
    const existingNotification = await Notification.findOne({
      userId: { $in: [appointment.doctorId._id, appointment.patientId._id] },
      type: 'APPOINTMENT',
      'data.appointmentId': appointment._id,
      title: { $regex: /appointment.*reminder|upcoming.*appointment/i },
      createdAt: {
        $gte: new Date(now.getTime() - 10 * 60 * 1000) // Within last 10 minutes
      }
    });

    if (!existingNotification) {
      const appointmentDateTime = new Date(appointment.appointmentDate);
      const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
      appointmentDateTime.setHours(hours, minutes, 0, 0);

      notificationsToSend.push(
        notificationService.createNotification({
          userId: appointment.doctorId._id,
          title: 'Upcoming Video Call Appointment',
          body: `You have a video call appointment with ${appointment.patientId.fullName} in 5 minutes at ${appointmentDateTime.toLocaleString()}.`,
          type: 'APPOINTMENT',
          data: { 
            appointmentId: appointment._id,
            action: 'VIDEO_CALL_REMINDER',
            appointmentTime: appointment.appointmentTime
          }
        }),
        notificationService.createNotification({
          userId: appointment.patientId._id,
          title: 'Upcoming Video Call Appointment',
          body: `You have a video call appointment with Dr. ${appointment.doctorId.fullName} in 5 minutes at ${appointmentDateTime.toLocaleString()}.`,
          type: 'APPOINTMENT',
          data: { 
            appointmentId: appointment._id,
            action: 'VIDEO_CALL_REMINDER',
            appointmentTime: appointment.appointmentTime
          }
        })
      );
    }
  }

  if (notificationsToSend.length > 0) {
    await Promise.all(notificationsToSend);
    console.log(`✅ Sent ${notificationsToSend.length} upcoming appointment notifications`);
  }

  return { sent: notificationsToSend.length };
};

module.exports = {
  sendAppointmentTimeNotifications,
  sendUpcomingAppointmentNotifications
};
