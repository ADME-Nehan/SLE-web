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
  "http://localhost:5173",
  "https://testsrilankanentrepreneur.netlify.app",
  "https://sle-web.vercel.app",
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow Postman, mobile apps, server-to-server, and Render health checks
    if (!origin) {
      return callback(null, true);
    }

    // Allow exact frontend domains
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any Netlify preview/custom deploy domain
    if (origin.endsWith(".netlify.app")) {
      return callback(null, true);
    }

    // Allow any Vercel preview/custom deploy domain
    if (origin.endsWith(".vercel.app")) {
      return callback(null, true);
    }

    console.log("❌ CORS blocked origin:", origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-admin-key",
    "Origin",
    "Accept"
  ],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Important: handle browser preflight requests
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
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
  console.log("✅ Allowed CORS origins:", allowedOrigins);
});