const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Admin token required"
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.admin = decoded;

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired admin token"
    });
  }
}

module.exports = {
  requireAdmin
};