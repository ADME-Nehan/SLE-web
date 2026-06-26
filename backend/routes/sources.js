const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { runNewsPipeline } = require('../services/newsService');

const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
};

// GET all sources (public - just names/urls for display)
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('sources').get();
    const sources = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, sources });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST add source (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url required' });
    new URL(url); // validate

    // Auto-extract name from URL
    const hostname = new URL(url).hostname.replace('www.', '');
    const name = hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);

    const docRef = await db.collection('sources').add({
      name,
      url,
      active: true,
      articleCount: 0,
      createdAt: new Date().toISOString(),
      lastScraped: null,
    });

    res.json({ success: true, id: docRef.id, name, message: 'Source added — scraping started' });

    // Trigger immediate background scrape
    const { scrapeNewsSource } = require('../services/groqService');
    const { saveArticle } = require('../services/newsService');
    scrapeNewsSource({ url, name }).then(async (articles) => {
      for (const article of articles) await saveArticle(article);
      await db.collection('sources').doc(docRef.id).update({
        lastScraped: new Date().toISOString(),
        articleCount: articles.length,
      });
    }).catch(console.error);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT toggle/update source (admin)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const update = {};
    const { active, url } = req.body;
    if (active !== undefined) update.active = active;
    if (url !== undefined) update.url = url;
    update.updatedAt = new Date().toISOString();
    await db.collection('sources').doc(req.params.id).update(update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE source (admin)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await db.collection('sources').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST trigger scrape (admin)
router.post('/scrape', adminAuth, async (req, res) => {
  res.json({ success: true, message: 'Scraping all sources in background' });
  runNewsPipeline().catch(console.error);
});

module.exports = router;
