const app = require("./app");
const connectDB = require("./config/database");
const config = require("./config/env");

const PORT = config.PORT || 5000;

(async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`MyDoctor API running on port ${PORT}`);
      console.log(`Server accessible on all network interfaces (0.0.0.0:${PORT})`);
    });
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
