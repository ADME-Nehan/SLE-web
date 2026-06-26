const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET all news with filtering & pagination
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);

    let query = db.collection('articles').orderBy('createdAt', 'desc');

    const snap = await query.get();
    let articles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Filter by category
    if (category && category !== 'All') {
      articles = articles.filter((a) => a.category === category);
    }

    // Search by title or tags
    if (search) {
      const q = search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.summary?.toLowerCase().includes(q) ||
          a.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    const total = articles.length;
    const paginated = articles.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      articles: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single article
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('articles').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, article: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET categories with counts
router.get('/meta/categories', async (req, res) => {
  try {
    const snap = await db.collection('articles').get();
    const counts = {};
    snap.docs.forEach((d) => {
      const cat = d.data().category || 'World';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    res.json({ success: true, categories: counts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET trending tags
router.get('/meta/trending', async (req, res) => {
  try {
    const snap = await db.collection('articles').orderBy('createdAt', 'desc').limit(100).get();
    const tagCounts = {};
    snap.docs.forEach((d) => {
      (d.data().tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const trending = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));
    res.json({ success: true, trending });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE article (admin)
router.delete('/:id', async (req, res) => {
  try {
    await db.collection('articles').doc(req.params.id).delete();
    res.json({ success: true, message: 'Article deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
