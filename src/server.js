const app = require("./app");
const connectDB = require("./config/database");
const config = require("./config/env");
const { runAppointmentNotifications } = require("./workers/appointmentNotification.worker");
const { runEmailNotifications } = require("./workers/emailNotification.worker");
const { verifySmtpConnection } = require("./services/email.service");

const PORT = config.PORT || 5000;

(async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`MyDoctor API running on port ${PORT}`);
    });

    // This only authenticates to SMTP; it does not send a message.  It exposes
    // a deployment misconfiguration immediately without holding up the API.
    if (config.EMAIL_VERIFY_ON_STARTUP) {
      verifySmtpConnection().catch((error) => console.error('[email] Startup SMTP verification crashed:', error.message));
    }

    // Start appointment notification worker (runs every minute)
    setInterval(async () => {
      try {
        await Promise.all([runAppointmentNotifications(), runEmailNotifications()]);
      } catch (error) {
        console.error("Error in notification worker:", error);
      }
    }, 60 * 1000); // Run every minute

    // Do not wait a minute after a restart before retrying queued emails or
    // catching an appointment/subscription reminder that is already due.
    Promise.all([runAppointmentNotifications(), runEmailNotifications()])
      .catch((error) => console.error("Initial notification worker failed:", error));

    console.log("✅ Appointment and email notification workers started (run every minute)");
  } catch (error) {
    console.error("Server start failed:", error.message);
    process.exit(1);
  }
})();

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION 💥", err);
  process.exit(1);
});
