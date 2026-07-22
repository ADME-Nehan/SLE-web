const express = require("express");
const { db } = require("../config/firebase");

const router = express.Router();

function parseLimit(value, fallback = 60) {
  const limit = Number(value);

  if (Number.isFinite(limit) && limit > 0 && limit <= 200) {
    return Math.round(limit);
  }

  return fallback;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDuplicateKey(article) {
  const title = normalizeText(article.title || article.headline || "");

  if (article.storyKey) {
    return article.storyKey;
  }

  return title;
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());

    url.hash = "";

    const removeParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid"
    ];

    removeParams.forEach((param) => url.searchParams.delete(param));

    let finalUrl = url.href;

    if (finalUrl.endsWith("/")) {
      finalUrl = finalUrl.slice(0, -1);
    }

    return finalUrl;
  } catch {
    return String(value || "").trim();
  }
}

function normalizeSources(article) {
  if (Array.isArray(article.sources) && article.sources.length > 0) {
    return article.sources;
  }

  return [
    {
      sourceName: article.sourceName || "RSS Source",
      sourceUrl: article.sourceUrl || "",
      rssUrl: article.rssUrl || "",
      articleUrl: article.articleUrl || article.url || "",
      title: article.title || article.headline || "Untitled News",
      description:
        article.summary ||
        article.description ||
        article.whyItMatters ||
        "Read the full story from the original source.",
      publishedAt: article.publishedAt || article.createdAt,
      addedAt: article.createdAt || new Date().toISOString()
    }
  ];
}

function mergeSources(existingSources, newSources) {
  const map = new Map();

  [...existingSources, ...newSources].forEach((source) => {
    const sourceName = source.sourceName || "RSS Source";
    const articleUrl = normalizeUrl(source.articleUrl || "");
    const title = normalizeText(source.title || "");

    const key = `${sourceName.toLowerCase()}-${articleUrl || title}`;

    if (!map.has(key)) {
      map.set(key, source);
    }
  });

  return Array.from(map.values());
}

function mergeDuplicateArticles(existing, incoming) {
  const existingSources = normalizeSources(existing);
  const incomingSources = normalizeSources(incoming);
  const mergedSources = mergeSources(existingSources, incomingSources);

  const existingPriority = Number(existing.priority || 0);
  const incomingPriority = Number(incoming.priority || 0);

  return {
    ...existing,

    isTopNews: existing.isTopNews || incoming.isTopNews || false,
    priority: Math.max(existingPriority, incomingPriority),

    sources: mergedSources,
    sourceCount: mergedSources.length,

    allArticleUrls: Array.from(
      new Set([
        ...(Array.isArray(existing.allArticleUrls)
          ? existing.allArticleUrls
          : [existing.articleUrl || existing.url].filter(Boolean)),
        ...(Array.isArray(incoming.allArticleUrls)
          ? incoming.allArticleUrls
          : [incoming.articleUrl || incoming.url].filter(Boolean))
      ])
    ),

    updatedAt: existing.updatedAt || incoming.updatedAt,
    lastSeenAt: existing.lastSeenAt || incoming.lastSeenAt
  };
}

function dedupeArticles(articles) {
  const map = new Map();

  articles.forEach((article) => {
    const key = getDuplicateKey(article);

    if (!key) return;

    if (!map.has(key)) {
      map.set(key, article);
      return;
    }

    const existing = map.get(key);
    const merged = mergeDuplicateArticles(existing, article);

    map.set(key, merged);
  });

  return Array.from(map.values());
}

function sortArticles(articles) {
  return articles.sort((a, b) => {
    const aTop = a.isTopNews ? 1 : 0;
    const bTop = b.isTopNews ? 1 : 0;

    if (aTop !== bTop) return bTop - aTop;

    const aPriority = Number(a.priority || 0);
    const bPriority = Number(b.priority || 0);

    if (aPriority !== bPriority) return bPriority - aPriority;

    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

router.get("/", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 60);

    const snap = await db
      .collection("articles")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    let articles = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    articles = dedupeArticles(articles);
    articles = sortArticles(articles).slice(0, limit);

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

router.put("/:id/priority", async (req, res) => {
  try {
    const isTopNews = req.body.isTopNews === true;
    const priority = Number(req.body.priority || 0);

    await db.collection("articles").doc(req.params.id).update({
      isTopNews,
      priority: Number.isFinite(priority) ? priority : 0,
      topNewsUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: isTopNews
        ? "Article marked as Top News"
        : "Article removed from Top News"
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