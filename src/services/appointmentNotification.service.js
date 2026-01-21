const Appointment = require('../models/appointment.model');
const notificationService = require('./notification.service');
const User = require('../models/user.model');
const { parseAppointmentDate } = require('../middleware/appointmentAccess');

/**
 * Send notifications when appointment time arrives
 * This should be called by a scheduled job/cron that runs every minute
 * CRITICAL: Uses timezone-aware comparison to send notifications at the correct user local time
 */
const sendAppointmentTimeNotifications = async () => {
  const nowUTC = new Date(); // Current time in UTC
  
  // Find appointments that:
  // 1. Are CONFIRMED
  // 2. Are ONLINE type
  // 3. Appointment date is today (we'll check this with timezone awareness)
  // 4. Appointment time matches current time (within 1 minute window) - timezone aware
  // 5. Haven't sent notification yet
  
  const appointments = await Appointment.find({
    status: 'CONFIRMED',
    bookingType: 'ONLINE'
  })
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');

  const notificationsToSend = [];

  for (const appointment of appointments) {
    try {
      // Parse appointment date using the same helper as video call validation
      const dateComponents = parseAppointmentDate(appointment.appointmentDate);
      if (!dateComponents) {
        console.log('⚠️ [Notification] Could not parse appointment date for appointment:', appointment._id);
        continue;
      }
      
      const { year, month, day } = dateComponents;
      const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
      
      // Get timezone offset (same logic as video call validation)
      let tzOffsetMinutes;
      if (appointment.timezoneOffset !== null && appointment.timezoneOffset !== undefined) {
        tzOffsetMinutes = appointment.timezoneOffset;
        
        // CRITICAL FIX: Detect and correct wrong timezone offsets (same as video call)
        if (startHours >= 12 && startHours <= 23 && tzOffsetMinutes === 60) {
          console.log('⚠️ [Notification] Correcting wrong timezone offset from UTC+1 to UTC+5 for appointment:', appointment._id);
          tzOffsetMinutes = 300; // Override with correct UTC+5 offset
        }
      } else {
        // Default to UTC+5 (Pakistan) for appointments without timezone
        tzOffsetMinutes = 300;
      }
      
      // Convert appointment time to UTC (same logic as video call validation)
      const appointmentStartDateTimeUTC = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));
      const appointmentStartDateTime = new Date(appointmentStartDateTimeUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
      
      // Check if current UTC time is within 1 minute of appointment UTC time
      const timeDifference = Math.abs(nowUTC.getTime() - appointmentStartDateTime.getTime());
      const timeDifferenceMinutes = timeDifference / (60 * 1000);
      
      if (timeDifferenceMinutes <= 1) { // Within 1 minute
        // Check if we already sent notification (by checking for existing notification)
        const existingNotification = await require('../models/notification.model').findOne({
          userId: { $in: [appointment.doctorId._id, appointment.patientId._id] },
          type: 'APPOINTMENT',
          'data.appointmentId': appointment._id,
          title: { $regex: /appointment.*time|video.*call.*time/i },
          createdAt: {
            $gte: new Date(nowUTC.getTime() - 5 * 60 * 1000) // Within last 5 minutes
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
    } catch (error) {
      console.error('❌ [Notification] Error processing appointment for time notification:', appointment._id, error);
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
 * CRITICAL: Uses timezone-aware comparison to send reminders at the correct user local time
 */
const sendUpcomingAppointmentNotifications = async () => {
  const nowUTC = new Date(); // Current time in UTC
  const fiveMinutesLaterUTC = new Date(nowUTC.getTime() + 5 * 60 * 1000);

  const appointments = await Appointment.find({
    status: 'CONFIRMED',
    bookingType: 'ONLINE'
  })
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');

  const notificationsToSend = [];

  for (const appointment of appointments) {
    try {
      // Parse appointment date using the same helper as video call validation
      const dateComponents = parseAppointmentDate(appointment.appointmentDate);
      if (!dateComponents) {
        console.log('⚠️ [Notification] Could not parse appointment date for appointment:', appointment._id);
        continue;
      }
      
      const { year, month, day } = dateComponents;
      const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
      
      // Get timezone offset (same logic as video call validation)
      let tzOffsetMinutes;
      if (appointment.timezoneOffset !== null && appointment.timezoneOffset !== undefined) {
        tzOffsetMinutes = appointment.timezoneOffset;
        
        // CRITICAL FIX: Detect and correct wrong timezone offsets (same as video call)
        if (startHours >= 12 && startHours <= 23 && tzOffsetMinutes === 60) {
          console.log('⚠️ [Notification] Correcting wrong timezone offset from UTC+1 to UTC+5 for appointment:', appointment._id);
          tzOffsetMinutes = 300; // Override with correct UTC+5 offset
        }
      } else {
        // Default to UTC+5 (Pakistan) for appointments without timezone
        tzOffsetMinutes = 300;
      }
      
      // Convert appointment time to UTC (same logic as video call validation)
      const appointmentStartDateTimeUTC = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));
      const appointmentStartDateTime = new Date(appointmentStartDateTimeUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
      
      // Check if appointment is 5 minutes from now (within 1 minute window)
      const timeDifference = Math.abs(fiveMinutesLaterUTC.getTime() - appointmentStartDateTime.getTime());
      const timeDifferenceMinutes = timeDifference / (60 * 1000);
      
      if (timeDifferenceMinutes <= 1) { // Appointment is 5 minutes away (within 1 minute window)
        // Check if we already sent reminder notification
        const Notification = require('../models/notification.model');
        const existingNotification = await Notification.findOne({
          userId: { $in: [appointment.doctorId._id, appointment.patientId._id] },
          type: 'APPOINTMENT',
          'data.appointmentId': appointment._id,
          title: { $regex: /appointment.*reminder|upcoming.*appointment/i },
          createdAt: {
            $gte: new Date(nowUTC.getTime() - 10 * 60 * 1000) // Within last 10 minutes
          }
        });

        if (!existingNotification) {
          // Format appointment time for display (in user's local timezone)
          const appointmentDateTime = new Date(appointmentStartDateTime);
          const localTimeString = appointmentDateTime.toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          notificationsToSend.push(
            notificationService.createNotification({
              userId: appointment.doctorId._id,
              title: 'Upcoming Video Call Appointment',
              body: `You have a video call appointment with ${appointment.patientId.fullName} in 5 minutes at ${localTimeString}.`,
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
              body: `You have a video call appointment with Dr. ${appointment.doctorId.fullName} in 5 minutes at ${localTimeString}.`,
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
    } catch (error) {
      console.error('❌ [Notification] Error processing appointment for reminder:', appointment._id, error);
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
