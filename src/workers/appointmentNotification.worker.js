const { sendAppointmentTimeNotifications, sendUpcomingAppointmentNotifications } = require('../services/appointmentNotification.service');

/**
 * Worker to send appointment notifications
 * This should be run as a cron job or scheduled task every minute
 */
const runAppointmentNotifications = async () => {
  try {
    console.log('🔔 [Worker] Checking for appointment notifications...');
    
    // Send upcoming appointment notifications (5 minutes before)
    await sendUpcomingAppointmentNotifications();
    
    // Send appointment time notifications (when time arrives)
    await sendAppointmentTimeNotifications();
    
    console.log('✅ [Worker] Appointment notification check completed');
  } catch (error) {
    console.error('❌ [Worker] Error in appointment notifications:', error);
  }
};

// If running as standalone script
if (require.main === module) {
  console.log('🚀 Starting appointment notification worker...');
  runAppointmentNotifications()
    .then(() => {
      console.log('✅ Worker completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Worker failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAppointmentNotifications
};
