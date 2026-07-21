const express = require("express");
const { db } = require("../config/firebase");

const router = express.Router();

function parseLimit(value, fallback = 30) {
  const limit = Number(value);

  if (Number.isFinite(limit) && limit > 0 && limit <= 100) {
    return Math.round(limit);
  }

  return fallback;
}

router.get("/", async (req, res) => {
  try {
    const category = req.query.category || "All";
    const limit = parseLimit(req.query.limit, 30);

    let query = db.collection("articles").orderBy("createdAt", "desc").limit(limit);

    if (category && category !== "All") {
      query = db
        .collection("articles")
        .where("category", "==", category)
        .orderBy("createdAt", "desc")
        .limit(limit);
    }

    const snap = await query.get();

    const articles = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      articles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const snap = await db.collection("articles").limit(300).get();

    const categories = new Set();

    snap.docs.forEach((doc) => {
      const category = doc.data().category;

      if (category) {
        categories.add(category);
      }
    });

    res.json({
      success: true,
      categories: ["All", ...Array.from(categories).sort()]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const snap = await db.collection("articles").doc(req.params.id).get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Article not found"
      });
    }

    res.json({
      success: true,
      article: {
        id: snap.id,
        ...snap.data()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.collection("articles").doc(req.params.id).delete();

    res.json({
      success: true,
      message: "Article deleted"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;