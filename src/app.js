const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");

require("./config/env"); // load ENV

const app = express();

// CORS configuration - Allow all origins
app.use(cors({
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: false, // Set to false when using wildcard origin
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use(requestLogger); // optional but useful

// Mount all API routes
app.use("/api", routes);

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "MyDoctor API is running" });
});

// Global error handler (last)
app.use(errorHandler);

module.exports = app;
