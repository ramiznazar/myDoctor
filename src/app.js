const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const requestLogger = require("./middleware/requestLogger");
const languageMiddleware = require("./middleware/language.middleware");

require("./config/env"); // load ENV

const app = express();

// CORS configuration - Allow all origins
app.use(cors({
  origin: "*", // Allow all origins
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Accept-Language", "Origin"],
  credentials: false, // Set to false when using wildcard origin
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files from uploads directory - PUBLIC ACCESS (no authentication required)
// This route must be before requestLogger to ensure public access
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  setHeaders: (res, filePath) => {
    // Explicitly set CORS headers for static files to allow public access
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', '*');
    // Cache static files for better performance
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  },
  // Don't serve directory listings for security
  index: false,
  // Allow requests without authentication
  dotfiles: 'ignore'
}));

app.use(requestLogger); // optional but useful
app.use(languageMiddleware);

// Mount all API routes
app.use("/api", routes);

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "MyDoctor API is running" });
});

// Global error handler (last)
app.use(errorHandler);

module.exports = app;
