const express = require("express");
const jwt = require("jsonwebtoken");
const { requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid admin username or password"
      });
    }

    const token = jwt.sign(
      {
        role: "admin",
        username
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      success: true,
      token,
      admin: {
        username,
        role: "admin"
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/me", requireAdmin, async (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

module.exports = router;