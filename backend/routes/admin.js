const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { runNewsPipeline } = require('../services/newsService');

// Simple secret key middleware for admin routes
const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
};

// GET dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [articlesSnap, sourcesSnap] = await Promise.all([
      db.collection('articles').get(),
      db.collection('sources').get(),
    ]);
    const articles = articlesSnap.docs.map(d => d.data());
    const sources = sourcesSnap.docs.map(d => d.data());
    const categories = {};
    articles.forEach(a => {
      categories[a.category || 'World'] = (categories[a.category || 'World'] || 0) + 1;
    });
    res.json({
      success: true,
      stats: {
        totalArticles: articles.length,
        totalSources: sources.length,
        activeSources: sources.filter(s => s.active !== false).length,
        categoriesBreakdown: categories,
        multiSourceArticles: articles.filter(a => (a.sources || []).length > 1).length,
        lastUpdated: articles.map(a => a.createdAt).sort().reverse()[0] || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST trigger manual scrape
router.post('/scrape', adminAuth, async (req, res) => {
  res.json({ success: true, message: 'Pipeline triggered in background' });
  runNewsPipeline().catch(console.error);
});

// DELETE all articles
router.delete('/articles/all', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('articles').get();
    await Promise.all(snap.docs.map(d => db.collection('articles').doc(d.id).delete()));
    res.json({ success: true, message: `Deleted ${snap.docs.length} articles` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify admin key (used by frontend)
router.post('/verify', (req, res) => {
  const { key } = req.body;
  if (key === process.env.ADMIN_SECRET_KEY) {
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false, error: 'Wrong password' });
  }
});

module.exports = router;
