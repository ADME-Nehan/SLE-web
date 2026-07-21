const express = require("express");
const cors = require("cors");
require("dotenv").config();

const rssRoutes = require("./routes/rssRoutes");
const sourceRoutes = require("./routes/sourceRoutes");
const newsRoutes = require("./routes/newsRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SLE RSS backend running",
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

app.use("/api/rss", rssRoutes);
app.use("/api/sources", sourceRoutes);
app.use("/api/news", newsRoutes);

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
  console.log(`🚀 SLE RSS backend running on port ${PORT}`);
});