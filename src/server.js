const app = require("./app");
const connectDB = require("./config/database");
const config = require("./config/env");

const PORT = config.PORT || 5000;

(async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`MyDoctor API running on port ${PORT}`);
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
