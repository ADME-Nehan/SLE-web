const { db } = require("../config/firebase");
const { readAndFilterRssFeed } = require("./rssService");
const { cleanText, normalizeUrl, getNumberEnv } = require("../utils/helpers");

function getSourceName(source) {
  return cleanText(source.name || source.sourceName || "RSS Source");
}

function getRssUrl(source) {
  return normalizeUrl(source.rssUrl || source.url || "");
}

function getWebsiteUrl(source) {
  return normalizeUrl(source.websiteUrl || source.siteUrl || "");
}

function buildSimpleSummary(item) {
  return (
    cleanText(item.description) ||
    cleanText(item.title) ||
    "Read the latest update from Sri Lankan Entrepreneur."
  ).slice(0, 420);
}

function buildWhyItMatters(item) {
  const category = item.category || "Business";

  const map = {
    Business:
      "This update may help entrepreneurs understand business and market movement.",
    Startups:
      "This update may help startup founders understand opportunities and market direction.",
    SME:
      "This update may help small business owners plan better decisions.",
    Finance:
      "This update may affect business cash flow, banking, or investment planning.",
    Economy:
      "This update may affect pricing, demand, and business confidence.",
    Investment:
      "This update may show investment opportunities or market direction.",
    Technology:
      "This update may help businesses understand digital and technology changes.",
    Tourism:
      "This update may affect tourism-related businesses and local demand.",
    Exports:
      "This update may affect exporters, importers, and trade-focused SMEs.",
    Agriculture:
      "This update may affect agri businesses, supply, pricing, or income.",
    Policy:
      "This update may affect business rules, tax, compliance, or planning."
  };

  return map[category] || map.Business;
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

async function findArticleByUrl(articleUrl) {
  const finalUrl = normalizeUrl(articleUrl);

  if (!finalUrl) return null;

  const snap = await db
    .collection("articles")
    .where("articleUrl", "==", finalUrl)
    .limit(1)
    .get();

  if (snap.empty) return null;

  return {
    id: snap.docs[0].id,
    data: snap.docs[0].data()
  };
}

async function saveAcceptedArticle(item, source) {
  const articleUrl = normalizeUrl(item.articleUrl);

  if (!item.title || !articleUrl) {
    return {
      saved: false,
      reason: "missing_title_or_url"
    };
  }

  const existing = await findArticleByUrl(articleUrl);

  if (existing) {
    await db.collection("articles").doc(existing.id).update({
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      saved: false,
      duplicate: true,
      id: existing.id,
      reason: "duplicate_article"
    };
  }

  const category = item.category || source.category || "Business";
  const summary = buildSimpleSummary(item);

  const payload = {
    title: cleanText(item.title),
    originalTitle: cleanText(item.title),
    headline: cleanText(item.title),

    summary,
    description: summary,

    category,
    tags: ["SriLanka", category.replace(/\s+/g, ""), "Business"],

    articleUrl,
    url: articleUrl,
    originalUrl: articleUrl,

    sourceName: getSourceName(source) || item.sourceName,
    sourceUrl: getWebsiteUrl(source),
    rssUrl: getRssUrl(source),

    publishedAt: item.publishedAt || null,

    keywordScore: item.keywordScore || 0,
    relevanceScore: item.keywordScore || 0,
    filterReason: item.filterReason || "accepted_by_keyword_filter",
    hits: item.hits || null,

    whyItMatters: buildWhyItMatters(item),
    isEntrepreneurRelevant: true,
    approvedForSocial: true,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };

  const ref = await db.collection("articles").add(payload);

  return {
    saved: true,
    id: ref.id
  };
}

async function saveRejectedArticle(item, source) {
  if (process.env.SAVE_REJECTED_ARTICLES !== "true") {
    return null;
  }

  const payload = {
    title: cleanText(item.title),
    description: cleanText(item.description),
    articleUrl: normalizeUrl(item.articleUrl),
    sourceName: getSourceName(source),
    rssUrl: getRssUrl(source),
    keywordScore: item.keywordScore || 0,
    filterReason: item.filterReason || "rejected_by_keyword_filter",
    hits: item.hits || null,
    createdAt: new Date().toISOString()
  };

  const ref = await db.collection("rejectedArticles").add(payload);

  return ref.id;
}

async function updateSourceStatus(sourceId, data) {
  await db.collection("sources").doc(sourceId).update({
    ...data,
    updatedAt: new Date().toISOString()
  });
}

async function createRunLog(data) {
  const ref = await db.collection("rssRuns").add({
    ...data,
    createdAt: new Date().toISOString()
  });

  return ref.id;
}

async function updateRunLog(runId, data) {
  if (!runId) return;

  await db.collection("rssRuns").doc(runId).update({
    ...data,
    updatedAt: new Date().toISOString()
  });
}

async function fetchOneSource(source) {
  const rssUrl = getRssUrl(source);
  const sourceName = getSourceName(source);

  if (!rssUrl) {
    throw new Error("RSS URL missing");
  }

  const result = await readAndFilterRssFeed(rssUrl);

  let savedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;

  for (const item of result.acceptedItems) {
    const saveResult = await saveAcceptedArticle(item, source);

    if (saveResult.saved) {
      savedCount++;
    } else if (saveResult.duplicate) {
      duplicateCount++;
    }
  }

  for (const item of result.rejectedItems) {
    await saveRejectedArticle(item, source);
    rejectedCount++;
  }

  await updateSourceStatus(source.id, {
    lastFetchedAt: new Date().toISOString(),
    lastStatus: "success",
    lastItemCount: result.checkedItems,
    lastAcceptedCount: result.acceptedCount,
    lastRejectedCount: result.rejectedCount,
    lastSavedCount: savedCount,
    lastDuplicateCount: duplicateCount,
    lastError: null
  });

  return {
    sourceId: source.id,
    sourceName,
    rssUrl,
    checkedItems: result.checkedItems,
    acceptedCount: result.acceptedCount,
    rejectedCount,
    savedCount,
    duplicateCount
  };
}

async function runRssPipeline() {
  const runId = await createRunLog({
    type: "manual_rss_run",
    status: "running",
    startedAt: new Date().toISOString()
  });

  let totalSources = 0;
  let totalChecked = 0;
  let totalSaved = 0;
  let totalRejected = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;

  try {
    const sources = await getActiveSources();
    const maxSources = getNumberEnv("MAX_SOURCES_PER_RUN", sources.length);
    const selectedSources = sources.slice(0, maxSources);

    totalSources = selectedSources.length;

    const sourceResults = [];

    for (const source of selectedSources) {
      try {
        const result = await fetchOneSource(source);

        totalChecked += result.checkedItems;
        totalSaved += result.savedCount;
        totalRejected += result.rejectedCount;
        totalDuplicates += result.duplicateCount;

        sourceResults.push(result);
      } catch (error) {
        totalErrors++;

        await updateSourceStatus(source.id, {
          lastStatus: "failed",
          lastError: error.message,
          lastErrorAt: new Date().toISOString()
        });

        sourceResults.push({
          sourceId: source.id,
          sourceName: getSourceName(source),
          error: error.message
        });
      }
    }

    await updateRunLog(runId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      totalSources,
      totalChecked,
      totalSaved,
      totalRejected,
      totalDuplicates,
      totalErrors,
      sourceResults
    });

    return {
      runId,
      totalSources,
      totalChecked,
      totalSaved,
      totalRejected,
      totalDuplicates,
      totalErrors,
      sourceResults
    };
  } catch (error) {
    await updateRunLog(runId, {
      status: "failed",
      error: error.message,
      completedAt: new Date().toISOString()
    });

    throw error;
  }
}

module.exports = {
  getActiveSources,
  fetchOneSource,
  runRssPipeline,
  saveAcceptedArticle
};