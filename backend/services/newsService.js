const { db } = require("../config/firebase");
const { scrapeNewsSource } = require("./groqService");

/**
 * Category pages to check for every source.
 * Example:
 * If source URL is https://example.com
 * It will also check:
 * https://example.com/sports
 * https://example.com/technology
 * https://example.com/business
 */
const CATEGORY_SCAN_PAGES = [
  { path: "/", category: "Latest News" },
  { path: "/news", category: "Latest News" },
  { path: "/latest", category: "Latest News" },
  { path: "/latest-news", category: "Latest News" },

  { path: "/business", category: "Business" },
  { path: "/business-news", category: "Business" },
  { path: "/category/business", category: "Business" },
  { path: "/news/business", category: "Business" },

  { path: "/finance", category: "Finance" },
  { path: "/financial", category: "Finance" },
  { path: "/economy", category: "Economy" },
  { path: "/market", category: "Finance" },
  { path: "/markets", category: "Finance" },
  { path: "/investment", category: "Investment" },

  { path: "/technology", category: "Technology" },
  { path: "/tech", category: "Technology" },
  { path: "/technology-news", category: "Technology" },
  { path: "/category/technology", category: "Technology" },
  { path: "/news/technology", category: "Technology" },

  { path: "/sports", category: "Sports" },
  { path: "/sport", category: "Sports" },
  { path: "/sports-news", category: "Sports" },
  { path: "/category/sports", category: "Sports" },
  { path: "/category/sport", category: "Sports" },
  { path: "/news/sports", category: "Sports" },
  { path: "/news/sport", category: "Sports" },

  { path: "/politics", category: "Politics" },
  { path: "/political", category: "Politics" },
  { path: "/political-news", category: "Politics" },

  { path: "/world", category: "World" },
  { path: "/international", category: "International" },
  { path: "/international-news", category: "International" },

  { path: "/local", category: "Local News" },
  { path: "/local-news", category: "Local News" },
  { path: "/sri-lanka", category: "Local News" },
  { path: "/srilanka", category: "Local News" },

  { path: "/tourism", category: "Tourism" },
  { path: "/travel", category: "Tourism" },

  { path: "/startup", category: "Startups" },
  { path: "/startups", category: "Startups" },

  { path: "/exports", category: "Exports" },
  { path: "/export", category: "Exports" },

  { path: "/health", category: "Health" },
  { path: "/science", category: "Science" },
  { path: "/entertainment", category: "Entertainment" }
];

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeTitle(title) {
  return cleanString(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const sa = new Set(
    normalizeTitle(a)
      .split(" ")
      .filter((word) => word.length > 2)
  );

  const sb = new Set(
    normalizeTitle(b)
      .split(" ")
      .filter((word) => word.length > 2)
  );

  if (sa.size === 0 || sb.size === 0) return 0;

  const intersection = [...sa].filter((word) => sb.has(word)).length;
  const union = new Set([...sa, ...sb]).size;

  return intersection / union;
}

function normalizeUrl(input, baseUrl = null) {
  try {
    let value = cleanString(input);

    if (!value) return "";

    if (
      !value.startsWith("http://") &&
      !value.startsWith("https://") &&
      !value.startsWith("/")
    ) {
      value = `https://${value}`;
    }

    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    url.hash = "";

    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getSourceName(source) {
  return (
    source.name ||
    source.sourceName ||
    source.websiteName ||
    source.title ||
    "Unknown Source"
  );
}

function getSourceUrl(source) {
  return normalizeUrl(
    source.url ||
      source.websiteUrl ||
      source.sourceUrl ||
      source.siteUrl ||
      source.homepage ||
      ""
  );
}

function getSourceHomepage(source) {
  const sourceUrl = getSourceUrl(source);

  try {
    const url = new URL(sourceUrl);
    return url.origin;
  } catch {
    return sourceUrl;
  }
}

function buildScanPagesForSource(source) {
  const originalSourceUrl = getSourceUrl(source);

  if (!originalSourceUrl) {
    return [];
  }

  let origin = originalSourceUrl;

  try {
    origin = new URL(originalSourceUrl).origin;
  } catch {
    origin = originalSourceUrl;
  }

  const pages = [];
  const seen = new Set();

  function addPage(url, category) {
    const normalized = normalizeUrl(url);

    if (!normalized || seen.has(normalized)) return;

    seen.add(normalized);
    pages.push({
      url: normalized,
      category
    });
  }

  // First scan the exact URL added by admin
  addPage(originalSourceUrl, source.defaultCategory || "Latest News");

  // Then scan common category URLs
  for (const page of CATEGORY_SCAN_PAGES) {
    try {
      const categoryUrl = new URL(page.path, origin).href;
      addPage(categoryUrl, page.category);
    } catch {
      // ignore invalid category URL
    }
  }

  return pages;
}

function normalizeArticle(article, source, scanPage) {
  const sourceName = getSourceName(source);
  const sourceHomepage = getSourceHomepage(source);

  const articleUrl = normalizeUrl(
    article.articleUrl || article.url || article.link || article.originalUrl,
    scanPage.url
  );

  return {
    ...article,
    title: cleanString(article.title || article.headline),
    summary: cleanString(article.summary || article.description),
    category:
      article.category ||
      scanPage.category ||
      source.defaultCategory ||
      "Latest News",
    tags: Array.isArray(article.tags) ? article.tags : [],
    sentiment: article.sentiment || null,
    publishedAt: article.publishedAt || null,

    sourceName,
    sourceUrl: sourceHomepage,
    siteUrl: sourceHomepage,
    sourcePageUrl: scanPage.url,

    articleUrl,
    url: articleUrl,
    originalUrl: articleUrl
  };
}

function sourceEntryFromArticle(article) {
  return {
    name: article.sourceName,
    sourceName: article.sourceName,

    siteUrl: article.siteUrl || article.sourceUrl,
    sourceUrl: article.sourceUrl || article.siteUrl,

    articleUrl: article.articleUrl,
    url: article.articleUrl,
    originalUrl: article.articleUrl,

    scannedFrom: article.sourcePageUrl || null,
    title: article.title || null
  };
}

function sameUrl(a, b) {
  return normalizeUrl(a) === normalizeUrl(b);
}

async function findExistingArticle(articleUrl, title) {
  try {
    if (articleUrl) {
      const byUrl = await db
        .collection("articles")
        .where("articleUrl", "==", articleUrl)
        .limit(1)
        .get();

      if (!byUrl.empty) {
        return byUrl.docs[0].id;
      }
    }

    const recent = await db
      .collection("articles")
      .orderBy("createdAt", "desc")
      .limit(300)
      .get();

    for (const doc of recent.docs) {
      const existingTitle = doc.data().title || "";

      if (similarity(existingTitle, title) > 0.65) {
        return doc.id;
      }
    }
  } catch (error) {
    console.error("Find existing article error:", error.message);
  }

  return null;
}

async function saveArticle(article) {
  if (!article.title || !article.articleUrl) {
    console.log("      ⚠️ Skipped article without title or URL");
    return null;
  }

  const existingId = await findExistingArticle(article.articleUrl, article.title);
  const sourceEntry = sourceEntryFromArticle(article);

  if (existingId) {
    const ref = db.collection("articles").doc(existingId);
    const snap = await ref.get();

    if (!snap.exists) {
      return null;
    }

    const existing = snap.data();
    const sources = Array.isArray(existing.sources) ? existing.sources : [];

    const alreadyHasSource = sources.some((source) => {
      return (
        sameUrl(source.articleUrl, article.articleUrl) ||
        sameUrl(source.url, article.articleUrl) ||
        sameUrl(source.originalUrl, article.articleUrl)
      );
    });

    if (!alreadyHasSource) {
      sources.push(sourceEntry);

      await ref.update({
        sources,
        sourceCount: sources.length,
        updatedAt: new Date().toISOString()
      });

      console.log(
        `      🔗 Merged source into existing: "${article.title.substring(
          0,
          60
        )}"`
      );
    } else {
      console.log(
        `      ⏭️ Already exists: "${article.title.substring(0, 60)}"`
      );
    }

    return existingId;
  }

  const ref = await db.collection("articles").add({
    title: article.title,
    headline: article.title,

    articleUrl: article.articleUrl,
    url: article.articleUrl,
    originalUrl: article.articleUrl,

    summary: article.summary,
    description: article.summary,

    category: article.category || "Latest News",
    tags: article.tags || [],
    sentiment: article.sentiment || null,
    publishedAt: article.publishedAt || null,

    sources: [sourceEntry],
    sourceCount: 1,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log(`      ✅ Saved new article: "${article.title.substring(0, 60)}"`);

  return ref.id;
}

async function getActiveSources() {
  const snap = await db.collection("sources").get();

  return snap.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((source) => source.active !== false);
}

async function scrapeSourceFromAllCategoryPages(source) {
  const sourceName = getSourceName(source);
  const scanPages = buildScanPagesForSource(source);

  const maxArticles = Number(
    source.maxLinksPerRun || process.env.MAX_LINKS_PER_SOURCE || 30
  );

  const collected = [];
  const seenArticleUrls = new Set();

  let pageErrorCount = 0;
  let lastError = null;

  console.log(`  🔎 ${scanPages.length} page(s) will be checked`);

  for (const scanPage of scanPages) {
    if (collected.length >= maxArticles) break;

    try {
      console.log(`  🌐 Checking: ${scanPage.url}`);

      const scanSource = {
        ...source,

        name: sourceName,
        sourceName,

        // Important: scraper will read this URL
        url: scanPage.url,
        websiteUrl: scanPage.url,

        // Keep original homepage separately
        sourceUrl: getSourceHomepage(source),
        siteUrl: getSourceHomepage(source),

        defaultCategory: scanPage.category || source.defaultCategory || "Latest News"
      };

      const scrapedArticles = await scrapeNewsSource(scanSource);

      if (!Array.isArray(scrapedArticles)) {
        continue;
      }

      for (const rawArticle of scrapedArticles) {
        if (collected.length >= maxArticles) break;

        const article = normalizeArticle(rawArticle, scanSource, scanPage);

        if (!article.title || !article.articleUrl) {
          continue;
        }

        if (seenArticleUrls.has(article.articleUrl)) {
          continue;
        }

        seenArticleUrls.add(article.articleUrl);
        collected.push(article);
      }

      console.log(
        `  ✅ Found ${scrapedArticles.length} article(s) from ${scanPage.url}`
      );
    } catch (error) {
      pageErrorCount++;
      lastError = error;
      console.log(`  ⚠️ Failed page: ${scanPage.url} — ${error.message}`);
    }
  }

  if (collected.length === 0 && pageErrorCount === scanPages.length) {
    throw new Error(lastError ? lastError.message : "All source pages failed");
  }

  return collected;
}

async function runNewsPipeline() {
  console.log("\n🔄 ═══════════════════════════════════════");
  console.log("🔄 NEWS PIPELINE STARTED", new Date().toISOString());
  console.log("🔄 ═══════════════════════════════════════");

  const sources = await getActiveSources();

  console.log(`📡 ${sources.length} active source(s) found\n`);

  let totalSaved = 0;
  let totalErrors = 0;

  for (const source of sources) {
    const sourceName = getSourceName(source);
    const sourceUrl = getSourceUrl(source);

    console.log(`\n📰 Processing: ${sourceName} (${sourceUrl})`);

    try {
      if (!sourceUrl) {
        throw new Error("Source URL missing. Add url or websiteUrl field.");
      }

      const articles = await scrapeSourceFromAllCategoryPages(source);

      let savedCount = 0;

      for (const article of articles) {
        const savedId = await saveArticle(article);

        if (savedId) {
          savedCount++;
          totalSaved++;
        }
      }

      await db.collection("sources").doc(source.id).update({
        lastScraped: new Date().toISOString(),
        lastArticleCount: articles.length,
        lastSavedCount: savedCount,
        lastError: null
      });

      console.log(`  💾 Saved ${savedCount} article(s) from ${sourceName}`);
    } catch (error) {
      console.error(`  ❌ Failed: ${sourceName} — ${error.message}`);

      totalErrors++;

      await db.collection("sources").doc(source.id).update({
        lastError: error.message,
        lastErrorAt: new Date().toISOString()
      });
    }
  }

  console.log(
    `\n✅ PIPELINE DONE — ${totalSaved} article(s) saved, ${totalErrors} error(s)\n`
  );

  return {
    totalSaved,
    totalErrors
  };
}

module.exports = {
  runNewsPipeline,
  saveArticle,
  getActiveSources,
  scrapeSourceFromAllCategoryPages
};