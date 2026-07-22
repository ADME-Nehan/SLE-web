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
  ).slice(0, 500);
}

function buildWhyItMatters(item) {
  const category = item.category || "Business";

  const map = {
    Business:
      "This update may help entrepreneurs understand business and market movement.",
    Startups:
      "This update may help startup founders understand opportunities and market direction.",
    SME: "This update may help small business owners plan better decisions.",
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

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "from",
  "by",
  "at",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "this",
  "that",
  "it",
  "its",
  "new",
  "latest",
  "breaking",
  "news",
  "sri",
  "lanka",
  "sri lanka",
  "says",
  "said",
  "will",
  "after",
  "over",
  "into",
  "more",
  "about",
  "ada",
  "derana",
  "hiru",
  "daily",
  "mirror",
  "lankadeepa"
]);

function normalizeForMatch(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleKeywords(title) {
  const words = normalizeForMatch(title)
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word));

  return Array.from(new Set(words)).slice(0, 18);
}

function buildStoryKey(title) {
  const keywords = getTitleKeywords(title);

  if (keywords.length === 0) {
    return normalizeForMatch(title).slice(0, 80);
  }

  return keywords.sort().slice(0, 12).join("-");
}

function getSimilarity(wordsA, wordsB) {
  const a = new Set(wordsA || []);
  const b = new Set(wordsB || []);

  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;

  a.forEach((word) => {
    if (b.has(word)) {
      intersection++;
    }
  });

  const union = new Set([...a, ...b]).size;

  return intersection / union;
}

function buildSourcePayload(item, source) {
  return {
    sourceName: getSourceName(source) || item.sourceName || "RSS Source",
    sourceUrl: getWebsiteUrl(source),
    rssUrl: getRssUrl(source),

    articleUrl: normalizeUrl(item.articleUrl),
    title: cleanText(item.title),
    description: buildSimpleSummary(item),

    category: item.category || source.category || "Business",
    publishedAt: item.publishedAt || null,

    keywordScore: item.keywordScore || 0,
    filterReason: item.filterReason || "accepted_by_keyword_filter",
    hits: item.hits || null,

    addedAt: new Date().toISOString()
  };
}

function buildPrimaryArticlePayload(item, sourcePayload) {
  const category = item.category || sourcePayload.category || "Business";
  const summary = buildSimpleSummary(item);
  const articleUrl = normalizeUrl(item.articleUrl);
  const storyKeywords = getTitleKeywords(item.title);
  const storyKey = buildStoryKey(item.title);

  return {
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

    sourceName: sourcePayload.sourceName,
    sourceUrl: sourcePayload.sourceUrl,
    rssUrl: sourcePayload.rssUrl,

    sources: [sourcePayload],
    sourceCount: 1,
    allArticleUrls: [articleUrl],

    storyKey,
    storyKeywords,

    publishedAt: item.publishedAt || null,

    keywordScore: item.keywordScore || 0,
    relevanceScore: item.keywordScore || 0,
    filterReason: item.filterReason || "accepted_by_keyword_filter",
    hits: item.hits || null,

    whyItMatters: buildWhyItMatters(item),
    isEntrepreneurRelevant: true,
    approvedForSocial: true,

    isTopNews: false,
    priority: 0,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
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

async function findArticleByExactUrl(articleUrl) {
  const finalUrl = normalizeUrl(articleUrl);

  if (!finalUrl) return null;

  const directSnap = await db
    .collection("articles")
    .where("articleUrl", "==", finalUrl)
    .limit(1)
    .get();

  if (!directSnap.empty) {
    return {
      id: directSnap.docs[0].id,
      data: directSnap.docs[0].data()
    };
  }

  const groupedSnap = await db
    .collection("articles")
    .where("allArticleUrls", "array-contains", finalUrl)
    .limit(1)
    .get();

  if (!groupedSnap.empty) {
    return {
      id: groupedSnap.docs[0].id,
      data: groupedSnap.docs[0].data()
    };
  }

  return null;
}

async function findMatchingStory(item) {
  const articleUrl = normalizeUrl(item.articleUrl);
  const exactMatch = await findArticleByExactUrl(articleUrl);

  if (exactMatch) {
    return {
      ...exactMatch,
      matchType: "exact_url"
    };
  }

  const storyKey = buildStoryKey(item.title);

  if (storyKey) {
    const keySnap = await db
      .collection("articles")
      .where("storyKey", "==", storyKey)
      .limit(1)
      .get();

    if (!keySnap.empty) {
      return {
        id: keySnap.docs[0].id,
        data: keySnap.docs[0].data(),
        matchType: "story_key"
      };
    }
  }

  const newKeywords = getTitleKeywords(item.title);

  if (newKeywords.length < 4) {
    return null;
  }

  const recentSnap = await db
    .collection("articles")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  let bestMatch = null;
  let bestScore = 0;

  recentSnap.docs.forEach((doc) => {
    const data = doc.data();
    const existingKeywords =
      Array.isArray(data.storyKeywords) && data.storyKeywords.length
        ? data.storyKeywords
        : getTitleKeywords(data.title || data.headline || "");

    const score = getSimilarity(newKeywords, existingKeywords);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        id: doc.id,
        data
      };
    }
  });

  if (bestMatch && bestScore >= 0.55) {
    return {
      ...bestMatch,
      matchType: "similar_title",
      score: bestScore
    };
  }

  return null;
}

async function mergeArticleIntoExistingStory(existing, item, source) {
  const articleRef = db.collection("articles").doc(existing.id);
  const existingData = existing.data || {};
  const sourcePayload = buildSourcePayload(item, source);
  const articleUrl = normalizeUrl(item.articleUrl);

  const existingSources = Array.isArray(existingData.sources)
    ? existingData.sources
    : [
        {
          sourceName: existingData.sourceName || "RSS Source",
          sourceUrl: existingData.sourceUrl || "",
          rssUrl: existingData.rssUrl || "",
          articleUrl: existingData.articleUrl || existingData.url || "",
          title: existingData.title || existingData.headline || "",
          description:
            existingData.summary ||
            existingData.description ||
            existingData.whyItMatters ||
            "",
          category: existingData.category || "Business",
          publishedAt: existingData.publishedAt || existingData.createdAt,
          addedAt: existingData.createdAt || new Date().toISOString()
        }
      ];

  const newSourceName = cleanText(sourcePayload.sourceName).toLowerCase();

  const alreadyHasSameUrl = existingSources.some((sourceItem) => {
    return normalizeUrl(sourceItem.articleUrl) === articleUrl;
  });

  if (alreadyHasSameUrl) {
    await articleRef.update({
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      saved: false,
      duplicate: true,
      merged: false,
      id: existing.id,
      reason: "same_article_url_already_exists"
    };
  }

  const alreadyHasSameSource = existingSources.some((sourceItem) => {
    const existingSourceName = cleanText(sourceItem.sourceName).toLowerCase();

    return existingSourceName === newSourceName;
  });

  if (alreadyHasSameSource) {
    await articleRef.update({
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      saved: false,
      duplicate: true,
      merged: false,
      id: existing.id,
      reason: "same_source_story_already_exists"
    };
  }

  const updatedSources = [...existingSources, sourcePayload];

  const existingUrls = Array.isArray(existingData.allArticleUrls)
    ? existingData.allArticleUrls
    : [existingData.articleUrl || existingData.url].filter(Boolean);

  const updatedUrls = Array.from(new Set([...existingUrls, articleUrl]));

  await articleRef.update({
    sources: updatedSources,
    sourceCount: updatedSources.length,
    allArticleUrls: updatedUrls,

    keywordScore: Math.max(
      Number(existingData.keywordScore || 0),
      Number(item.keywordScore || 0)
    ),
    relevanceScore: Math.max(
      Number(existingData.relevanceScore || 0),
      Number(item.keywordScore || 0)
    ),

    updatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  });

  return {
    saved: false,
    duplicate: false,
    merged: true,
    id: existing.id,
    reason: `merged_by_${existing.matchType || "story_match"}`
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

  const existingStory = await findMatchingStory(item);

  if (existingStory) {
    return mergeArticleIntoExistingStory(existingStory, item, source);
  }

  const sourcePayload = buildSourcePayload(item, source);
  const payload = buildPrimaryArticlePayload(item, sourcePayload);

  const ref = await db.collection("articles").add(payload);

  return {
    saved: true,
    merged: false,
    duplicate: false,
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
  let mergedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;

  for (const item of result.acceptedItems) {
    const saveResult = await saveAcceptedArticle(item, source);

    if (saveResult.saved) {
      savedCount++;
    } else if (saveResult.merged) {
      mergedCount++;
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
    lastMergedCount: mergedCount,
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
    mergedCount,
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
  let totalMerged = 0;
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
        totalMerged += result.mergedCount;
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
      totalMerged,
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
      totalMerged,
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