const express = require("express");
const { db } = require("../config/firebase");
const { cleanText } = require("../utils/helpers");
const { requireAdmin } = require("../middleware/authMiddleware");
const {
  generateArticleDetailSummary,
  isAiDetailSummaryEnabled
} = require("../services/openAiService");

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

function normalizeUrl(value) {
  try {
    const raw = String(value || "").trim();

    if (!raw) return "";

    const url = new URL(raw);

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

function getDuplicateKey(article) {
  if (article.storyKey) {
    return article.storyKey;
  }

  return normalizeText(article.title || article.headline || "");
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
      imageUrl: article.imageUrl || "",
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
      map.set(key, {
        sourceName,
        sourceUrl: source.sourceUrl || "",
        rssUrl: source.rssUrl || "",
        articleUrl: source.articleUrl || "",
        imageUrl: source.imageUrl || "",
        title: source.title || "",
        description: source.description || "",
        category: source.category || "",
        publishedAt: source.publishedAt || "",
        addedAt: source.addedAt || ""
      });
    }
  });

  return Array.from(map.values());
}

function getBestImage(existing, incoming, sources) {
  if (existing.imageUrl) return existing.imageUrl;
  if (incoming.imageUrl) return incoming.imageUrl;

  const sourceWithImage = sources.find((source) => source.imageUrl);

  return sourceWithImage?.imageUrl || "";
}

function mergeDuplicateArticles(existing, incoming) {
  const existingSources = normalizeSources(existing);
  const incomingSources = normalizeSources(incoming);
  const mergedSources = mergeSources(existingSources, incomingSources);

  const existingPriority = Number(existing.priority || 0);
  const incomingPriority = Number(incoming.priority || 0);

  const mergedImageUrl = getBestImage(existing, incoming, mergedSources);

  return {
    ...existing,

    isTopNews: existing.isTopNews || incoming.isTopNews || false,
    priority: Math.max(existingPriority, incomingPriority),

    category: existing.category || incoming.category || "Business",

    imageUrl: mergedImageUrl,
    imageSourceName:
      existing.imageSourceName ||
      incoming.imageSourceName ||
      mergedSources.find((source) => source.imageUrl === mergedImageUrl)
        ?.sourceName ||
      "",

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

    aiAnalyzed: existing.aiAnalyzed || incoming.aiAnalyzed || false,
    aiConfidence: Math.max(
      Number(existing.aiConfidence || 0),
      Number(incoming.aiConfidence || 0)
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
      .limit(120)
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

router.get("/:id/ai-summary", async (req, res) => {
  try {
    const ref = db.collection("articles").doc(req.params.id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Article not found"
      });
    }

    const article = {
      id: snap.id,
      ...snap.data()
    };

    if (article.aiDetailSummary?.shortSummary) {
      return res.json({
        success: true,
        cached: true,
        aiSummary: article.aiDetailSummary
      });
    }

    if (!isAiDetailSummaryEnabled()) {
      return res.status(400).json({
        success: false,
        error:
          "AI summary is disabled. Add OPENAI_API_KEY and set ENABLE_AI_DETAIL_SUMMARY=true"
      });
    }

    const aiSummary = await generateArticleDetailSummary(article);

    const cleanAiSummary = {
      label: aiSummary.label || "AI Summary",
      title: cleanText(aiSummary.title) || "AI summary",
      shortSummary: cleanText(aiSummary.shortSummary),
      keyPoints: Array.isArray(aiSummary.keyPoints)
        ? aiSummary.keyPoints.map((point) => cleanText(point)).filter(Boolean)
        : [],
      businessImpact:
        cleanText(aiSummary.businessImpact) ||
        "This update may be useful for business readers.",
      readingTime: cleanText(aiSummary.readingTime) || "1 min read",
      model: aiSummary.model || process.env.AI_DETAIL_SUMMARY_MODEL || "",
      generatedAt: aiSummary.generatedAt || new Date().toISOString()
    };

    await ref.update({
      aiDetailSummary: cleanAiSummary,
      aiDetailSummaryUsage: aiSummary.usage || null,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      cached: false,
      aiSummary: cleanAiSummary
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

router.put("/:id/priority", requireAdmin, async (req, res) => {
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

router.delete("/:id", requireAdmin, async (req, res) => {
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