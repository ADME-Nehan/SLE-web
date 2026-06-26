const { db } = require('../config/firebase');
const { scrapeNewsSource } = require('./groqService');

// Normalize title for comparison
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Jaccard similarity between two titles
function similarity(a, b) {
  const sa = new Set(normalizeTitle(a).split(' ').filter(w => w.length > 3));
  const sb = new Set(normalizeTitle(b).split(' ').filter(w => w.length > 3));
  if (sa.size === 0 || sb.size === 0) return 0;
  const inter = [...sa].filter(w => sb.has(w)).length;
  return inter / new Set([...sa, ...sb]).size;
}

// Check if article already exists — by articleUrl or similar title
async function findExistingArticle(articleUrl, title) {
  try {
    // Check by exact article URL
    const byUrl = await db.collection('articles').where('articleUrl', '==', articleUrl).get();
    if (!byUrl.empty) return byUrl.docs[0].id;

    // Check by title similarity in recent 300 articles
    const recent = await db.collection('articles').orderBy('createdAt', 'desc').limit(300).get();
    for (const doc of recent.docs) {
      if (similarity(doc.data().title, title) > 0.65) return doc.id;
    }
  } catch {}
  return null;
}

// Save or merge article into Firestore
async function saveArticle(article) {
  const existingId = await findExistingArticle(article.articleUrl, article.title);

  if (existingId) {
    // Same story reported by multiple sources → add this source
    const ref = db.collection('articles').doc(existingId);
    const existing = (await ref.get()).data();
    const sources = existing.sources || [];
    const alreadyHas = sources.some(s => s.siteUrl === article.sourceUrl);
    if (!alreadyHas) {
      sources.push({
        name: article.sourceName,
        siteUrl: article.sourceUrl,      // homepage
        articleUrl: article.articleUrl,  // direct link to this source's article
      });
      await ref.update({ sources, updatedAt: new Date().toISOString() });
      console.log(`      🔗 Merged into existing: "${article.title.substring(0, 50)}"`);
    }
    return existingId;
  }

  // New article
  const ref = await db.collection('articles').add({
    title: article.title,
    articleUrl: article.articleUrl,  // direct article link
    summary: article.summary,
    category: article.category,
    tags: article.tags,
    sentiment: article.sentiment,
    publishedAt: article.publishedAt,
    sources: [{
      name: article.sourceName,
      siteUrl: article.sourceUrl,       // source homepage
      articleUrl: article.articleUrl,   // direct article link
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return ref.id;
}

// Get all active sources
async function getActiveSources() {
  const snap = await db.collection('sources').get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.active !== false);
}

// Main pipeline: go through all sources one by one
async function runNewsPipeline() {
  console.log('\n🔄 ═══════════════════════════════════════');
  console.log('🔄 NEWS PIPELINE STARTED', new Date().toISOString());
  console.log('🔄 ═══════════════════════════════════════');

  const sources = await getActiveSources();
  console.log(`📡 ${sources.length} active source(s) found\n`);

  let totalSaved = 0;
  let totalErrors = 0;

  for (const source of sources) {
    console.log(`\n📰 Processing: ${source.name} (${source.url})`);
    try {
      const articles = await scrapeNewsSource(source);

      let savedCount = 0;
      for (const article of articles) {
        await saveArticle(article);
        savedCount++;
        totalSaved++;
      }

      await db.collection('sources').doc(source.id).update({
        lastScraped: new Date().toISOString(),
        lastArticleCount: articles.length,
        lastError: null,
      });

      console.log(`  💾 Saved ${savedCount} articles from ${source.name}`);

    } catch (err) {
      console.error(`  ❌ Failed: ${source.name} — ${err.message}`);
      totalErrors++;
      await db.collection('sources').doc(source.id).update({
        lastError: err.message,
        lastErrorAt: new Date().toISOString(),
      });
    }
  }

  console.log(`\n✅ PIPELINE DONE — ${totalSaved} articles saved, ${totalErrors} errors\n`);
  return { totalSaved, totalErrors };
}

module.exports = { runNewsPipeline, saveArticle, getActiveSources };