const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const sourcesRoutes = require("./routes/sources");
const newsRoutes = require("./routes/news");
const adminRoutes = require("./routes/admin");
const socialPostRoutes = require("./routes/socialPosts");

const app = express();

const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow Postman, server-to-server, and same-origin requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later."
  }
});

app.use("/api", limiter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Sri Lankan Entrepreneur backend running",
    status: "online"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    time: new Date().toISOString()
  });
});

app.use("/api/sources", sourcesRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/social-posts", socialPostRoutes);

// Start scheduler
require("./services/scheduler");

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});