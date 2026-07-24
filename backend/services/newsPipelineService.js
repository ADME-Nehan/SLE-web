const { db } = require("../config/firebase");
const { readAndFilterRssFeed } = require("./rssService");
const { analyzeRssNewsItem, isOpenAiEnabled } = require("./openAiService");
const { cleanText, normalizeUrl, getNumberEnv } = require("../utils/helpers");

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "are",
  "was",
  "were",
  "will",
  "has",
  "have",
  "had",
  "into",
  "over",
  "after",
  "before",
  "says",
  "said",
  "sri",
  "lanka",
  "lankan",
  "new",
  "news",
  "latest",
  "update",
  "report",
  "reports"
]);

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitleKeywords(title) {
  return normalizeText(title)
    .split(" ")
    .filter((word) => word.length >= 4)
    .filter((word) => !STOP_WORDS.has(word))
    .slice(0, 14);
}

function buildStoryKey(title) {
  const keywords = getTitleKeywords(title);

  if (keywords.length === 0) {
    return normalizeText(title).slice(0, 80);
  }

  return Array.from(new Set(keywords)).sort().join("-");
}

function calculateSimilarity(wordsA, wordsB) {
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;

  setA.forEach((word) => {
    if (setB.has(word)) {
      intersection += 1;
    }
  });

  const union = new Set([...setA, ...setB]).size;

  return intersection / union;
}

function getRssUrl(source) {
  return normalizeUrl(source.rssUrl || source.url || "");
}

function getWebsiteUrl(source) {
  return normalizeUrl(source.websiteUrl || source.sourceUrl || "");
}

function getSourceName(source) {
  return cleanText(source.name || source.sourceName || "RSS Source");
}

function buildSimpleSummary(item) {
  const summary = cleanText(
    item.aiSummary ||
      item.summary ||
      item.description ||
      item.contentSnippet ||
      item.title
  );

  if (summary.length <= 260) {
    return summary;
  }

  return `${summary.slice(0, 260)}...`;
}

function buildSourcePayload(item, source) {
  return {
    sourceName: getSourceName(source) || item.sourceName || "RSS Source",
    sourceUrl: getWebsiteUrl(source),
    rssUrl: getRssUrl(source),

    articleUrl: normalizeUrl(item.articleUrl),
    imageUrl: normalizeUrl(item.imageUrl || ""),

    title: cleanText(item.title),
    description: buildSimpleSummary(item),

    category: item.category || "Business",
    publishedAt: item.publishedAt || null,

    keywordScore: item.keywordScore || 0,
    aiAnalyzed: item.aiAnalyzed === true,
    aiConfidence: item.aiConfidence || 0,
    filterReason: item.filterReason || "accepted_by_keyword_filter",
    hits: item.hits || null,

    addedAt: new Date().toISOString()
  };
}

function buildPrimaryArticlePayload(item, sourcePayload) {
  const articleUrl = normalizeUrl(item.articleUrl);
  const title = cleanText(item.aiCanonicalTitle || item.title);
  const storyKeywords = getTitleKeywords(title);
  const storyKey = buildStoryKey(title);

  return {
    title,
    headline: title,

    summary: buildSimpleSummary(item),
    description: buildSimpleSummary(item),
    whyItMatters:
      cleanText(item.whyItMatters) ||
      "Useful update for Sri Lankan business readers.",

    category: item.category || "Business",

    articleUrl,
    url: articleUrl,
    originalUrl: articleUrl,

    imageUrl: sourcePayload.imageUrl || "",
    imageSourceName: sourcePayload.imageUrl ? sourcePayload.sourceName : "",

    sourceName: sourcePayload.sourceName,
    sourceUrl: sourcePayload.sourceUrl,
    rssUrl: sourcePayload.rssUrl,

    sourceCount: 1,
    sources: [sourcePayload],
    allArticleUrls: [articleUrl].filter(Boolean),

    storyKey,
    storyKeywords,

    keywordScore: item.keywordScore || 0,
    relevanceScore: item.aiConfidence || item.keywordScore || 0,

    aiAnalyzed: item.aiAnalyzed === true,
    aiConfidence: item.aiConfidence || 0,
    aiReason: item.aiReason || "",

    isTopNews: false,
    priority: 0,

    publishedAt: item.publishedAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
}

async function findArticleByExactUrl(articleUrl) {
  const url = normalizeUrl(articleUrl);

  if (!url) return null;

  const directSnap = await db
    .collection("articles")
    .where("articleUrl", "==", url)
    .limit(1)
    .get();

  if (!directSnap.empty) {
    const doc = directSnap.docs[0];

    return {
      id: doc.id,
      data: doc.data(),
      matchType: "exact_url"
    };
  }

  const arraySnap = await db
    .collection("articles")
    .where("allArticleUrls", "array-contains", url)
    .limit(1)
    .get();

  if (!arraySnap.empty) {
    const doc = arraySnap.docs[0];

    return {
      id: doc.id,
      data: doc.data(),
      matchType: "exact_url_array"
    };
  }

  return null;
}

async function findArticleByStoryKey(storyKey) {
  if (!storyKey) return null;

  const snap = await db
    .collection("articles")
    .where("storyKey", "==", storyKey)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];

  return {
    id: doc.id,
    data: doc.data(),
    matchType: "story_key"
  };
}

async function findRecentSimilarStory(item) {
  const enabled = process.env.ENABLE_RECENT_SIMILARITY_CHECK !== "false";

  if (!enabled) return null;

  const limit = getNumberEnv("RECENT_SIMILARITY_LIMIT", 120);
  const threshold = Number(process.env.STORY_SIMILARITY_THRESHOLD || 0.55);

  const incomingTitle = item.aiCanonicalTitle || item.title;
  const incomingKeywords = getTitleKeywords(incomingTitle);

  if (incomingKeywords.length < 3) return null;

  const snap = await db
    .collection("articles")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  let bestMatch = null;
  let bestScore = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data();

    const existingKeywords = Array.isArray(data.storyKeywords)
      ? data.storyKeywords
      : getTitleKeywords(data.title || data.headline || "");

    const score = calculateSimilarity(incomingKeywords, existingKeywords);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        id: doc.id,
        data,
        matchType: "title_similarity",
        score
      };
    }
  });

  if (bestMatch && bestScore >= threshold) {
    return bestMatch;
  }

  return null;
}

async function findMatchingStory(item) {
  const exactMatch = await findArticleByExactUrl(item.articleUrl);

  if (exactMatch) return exactMatch;

  const title = item.aiCanonicalTitle || item.title;
  const storyKey = buildStoryKey(title);

  const storyKeyMatch = await findArticleByStoryKey(storyKey);

  if (storyKeyMatch) return storyKeyMatch;

  const similarMatch = await findRecentSimilarStory(item);

  if (similarMatch) return similarMatch;

  return null;
}

function normalizeExistingSources(existingData) {
  if (Array.isArray(existingData.sources) && existingData.sources.length > 0) {
    return existingData.sources;
  }

  return [
    {
      sourceName: existingData.sourceName || "RSS Source",
      sourceUrl: existingData.sourceUrl || "",
      rssUrl: existingData.rssUrl || "",
      articleUrl: existingData.articleUrl || existingData.url || "",
      imageUrl: existingData.imageUrl || "",
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
}

function mergeUniqueUrls(existingUrls, newUrl) {
  return Array.from(
    new Set([...(Array.isArray(existingUrls) ? existingUrls : []), newUrl].filter(Boolean))
  );
}

async function mergeArticleIntoExistingStory(existing, item, source) {
  const articleRef = db.collection("articles").doc(existing.id);
  const existingData = existing.data || {};
  const sourcePayload = buildSourcePayload(item, source);
  const articleUrl = normalizeUrl(item.articleUrl);

  const existingSources = normalizeExistingSources(existingData);
  const newSourceName = cleanText(sourcePayload.sourceName).toLowerCase();

  const alreadyHasSameUrl = existingSources.some((sourceItem) => {
    return normalizeUrl(sourceItem.articleUrl) === articleUrl;
  });

  if (alreadyHasSameUrl) {
    await articleRef.update({
      allArticleUrls: mergeUniqueUrls(existingData.allArticleUrls, articleUrl),
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
      allArticleUrls: mergeUniqueUrls(existingData.allArticleUrls, articleUrl),
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

  const updatedUrls = Array.from(new Set([...existingUrls, articleUrl].filter(Boolean)));

  await articleRef.update({
    sources: updatedSources,
    sourceCount: updatedSources.length,
    allArticleUrls: updatedUrls,

    imageUrl: existingData.imageUrl || sourcePayload.imageUrl || "",
    imageSourceName:
      existingData.imageSourceName ||
      (sourcePayload.imageUrl ? sourcePayload.sourceName : ""),

    keywordScore: Math.max(
      Number(existingData.keywordScore || 0),
      Number(item.keywordScore || 0)
    ),
    relevanceScore: Math.max(
      Number(existingData.relevanceScore || 0),
      Number(item.aiConfidence || item.keywordScore || 0)
    ),

    aiAnalyzed: existingData.aiAnalyzed || item.aiAnalyzed === true,
    aiConfidence: Math.max(
      Number(existingData.aiConfidence || 0),
      Number(item.aiConfidence || 0)
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

async function createNewArticle(item, source) {
  const sourcePayload = buildSourcePayload(item, source);
  const payload = buildPrimaryArticlePayload(item, sourcePayload);

  const ref = await db.collection("articles").add(payload);

  return {
    saved: true,
    duplicate: false,
    merged: false,
    id: ref.id,
    reason: "created_new_article"
  };
}

async function saveOrMergeArticle(item, source) {
  const matchingStory = await findMatchingStory(item);

  if (matchingStory) {
    return mergeArticleIntoExistingStory(matchingStory, item, source);
  }

  return createNewArticle(item, source);
}

async function saveRejectedArticle(item, source, reason) {
  if (process.env.SAVE_REJECTED_ARTICLES !== "true") {
    return;
  }

  await db.collection("rejectedArticles").add({
    title: cleanText(item.title),
    description: cleanText(item.description),
    articleUrl: normalizeUrl(item.articleUrl),
    imageUrl: normalizeUrl(item.imageUrl || ""),
    sourceName: getSourceName(source),
    rssUrl: getRssUrl(source),
    category: item.category || "Business",
    keywordScore: item.keywordScore || 0,
    filterReason: reason || item.filterReason || "rejected",
    aiAnalyzed: item.aiAnalyzed === true,
    aiConfidence: item.aiConfidence || 0,
    createdAt: new Date().toISOString()
  });
}

function shouldAnalyzeWithOpenAI(item, aiState) {
  if (!isOpenAiEnabled()) return false;

  const maxCalls = getNumberEnv("MAX_OPENAI_CALLS_PER_RUN", 10);

  if (aiState.calls >= maxCalls) {
    return false;
  }

  const score = Number(item.keywordScore || 0);
  const minScore = getNumberEnv("OPENAI_ANALYZE_MIN_SCORE", 5);
  const maxScore = getNumberEnv("OPENAI_ANALYZE_MAX_SCORE", 70);

  return score >= minScore && score <= maxScore;
}

function addUsage(aiState, usage) {
  if (!usage) return;

  aiState.inputTokens +=
    Number(usage.input_tokens || usage.prompt_tokens || 0) || 0;

  aiState.outputTokens +=
    Number(usage.output_tokens || usage.completion_tokens || 0) || 0;

  aiState.totalTokens +=
    Number(usage.total_tokens || 0) ||
    Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0) ||
    0;
}

async function prepareItemWithOpenAI(item, aiState) {
  if (!shouldAnalyzeWithOpenAI(item, aiState)) {
    return {
      ...item,
      aiAnalyzed: false,
      aiSkipped: true
    };
  }

  aiState.calls += 1;

  try {
    const analysis = await analyzeRssNewsItem(item);
    addUsage(aiState, analysis.usage);

    if (analysis.accepted === false) {
      return {
        ...item,
        accepted: false,
        aiAnalyzed: true,
        aiConfidence: analysis.confidence,
        aiReason: analysis.reason,
        filterReason: "rejected_by_openai"
      };
    }

    return {
      ...item,
      accepted: true,
      aiAnalyzed: true,
      aiConfidence: analysis.confidence,
      aiReason: analysis.reason,
      aiSummary: analysis.summary,
      summary: analysis.summary,
      whyItMatters: analysis.whyItMatters,
      aiCanonicalTitle: analysis.canonicalTitle,
      category: analysis.category || item.category
    };
  } catch (error) {
    return {
      ...item,
      accepted: true,
      aiAnalyzed: false,
      aiError: error.message,
      aiSkipped: true
    };
  }
}

async function resolveSource(sourceOrId) {
  if (typeof sourceOrId === "string") {
    const snap = await db.collection("sources").doc(sourceOrId).get();

    if (!snap.exists) {
      throw new Error("Source not found");
    }

    return {
      id: snap.id,
      ...snap.data()
    };
  }

  return sourceOrId;
}

async function updateSourceStatus(source, update) {
  if (!source?.id) return;

  await db.collection("sources").doc(source.id).update({
    ...update,
    updatedAt: new Date().toISOString()
  });
}

async function saveRunLog(payload) {
  await db.collection("rssRuns").add({
    ...payload,
    createdAt: new Date().toISOString()
  });
}

async function fetchOneSource(sourceOrId, options = {}) {
  const source = await resolveSource(sourceOrId);
  const rssUrl = getRssUrl(source);
  const sourceName = getSourceName(source);

  if (!rssUrl) {
    throw new Error("Source RSS URL is missing");
  }

  const aiState =
    options.aiState || {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };

  let savedCount = 0;
  let mergedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;
  let openAiRejectedCount = 0;

  try {
    const result = await readAndFilterRssFeed(rssUrl);

    rejectedCount += result.rejectedCount || 0;

    for (const rejectedItem of result.rejectedItems || []) {
      await saveRejectedArticle(
        rejectedItem,
        source,
        rejectedItem.filterReason || "rejected_by_keyword_filter"
      );
    }

    for (const rawItem of result.acceptedItems || []) {
      const item = await prepareItemWithOpenAI(
        {
          ...rawItem,
          sourceName
        },
        aiState
      );

      if (item.accepted === false) {
        rejectedCount += 1;
        openAiRejectedCount += 1;

        await saveRejectedArticle(
          item,
          source,
          item.filterReason || "rejected_by_openai"
        );

        continue;
      }

      const saveResult = await saveOrMergeArticle(item, source);

      if (saveResult.saved) {
        savedCount += 1;
      }

      if (saveResult.merged) {
        mergedCount += 1;
      }

      if (saveResult.duplicate) {
        duplicateCount += 1;
      }
    }

    const finalResult = {
      sourceId: source.id,
      sourceName,
      rssUrl,
      checkedItems: result.checkedItems || 0,
      acceptedCount: result.acceptedCount || 0,
      rejectedCount,
      savedCount,
      mergedCount,
      duplicateCount,
      openAiEnabled: isOpenAiEnabled(),
      openAiCalls: aiState.calls,
      openAiRejectedCount,
      openAiUsage: {
        inputTokens: aiState.inputTokens,
        outputTokens: aiState.outputTokens,
        totalTokens: aiState.totalTokens
      }
    };

    await updateSourceStatus(source, {
      lastFetchedAt: new Date().toISOString(),
      lastStatus: "success",
      lastItemCount: result.checkedItems || 0,
      lastAcceptedCount: result.acceptedCount || 0,
      lastRejectedCount: rejectedCount,
      lastSavedCount: savedCount,
      lastMergedCount: mergedCount,
      lastDuplicateCount: duplicateCount,
      lastOpenAiCalls: aiState.calls,
      lastError: null
    });

    await saveRunLog({
      type: "single_source",
      status: "success",
      ...finalResult
    });

    return finalResult;
  } catch (error) {
    await updateSourceStatus(source, {
      lastFetchedAt: new Date().toISOString(),
      lastStatus: "failed",
      lastError: error.message
    });

    await saveRunLog({
      type: "single_source",
      status: "failed",
      sourceId: source.id || null,
      sourceName,
      rssUrl,
      error: error.message
    });

    throw error;
  }
}

async function runRssPipeline() {
  const maxSources = getNumberEnv("MAX_SOURCES_PER_RUN", 20);

  const snap = await db.collection("sources").get();

  const sources = snap.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .filter((source) => source.active !== false)
    .slice(0, maxSources);

  const aiState = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };

  const results = [];

  let totalChecked = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalSaved = 0;
  let totalMerged = 0;
  let totalDuplicates = 0;
  let failedSources = 0;

  for (const source of sources) {
    try {
      const result = await fetchOneSource(source, { aiState });

      results.push(result);

      totalChecked += result.checkedItems || 0;
      totalAccepted += result.acceptedCount || 0;
      totalRejected += result.rejectedCount || 0;
      totalSaved += result.savedCount || 0;
      totalMerged += result.mergedCount || 0;
      totalDuplicates += result.duplicateCount || 0;
    } catch (error) {
      failedSources += 1;

      results.push({
        sourceId: source.id,
        sourceName: getSourceName(source),
        status: "failed",
        error: error.message
      });
    }
  }

  const finalResult = {
    sourceCount: sources.length,
    failedSources,
    totalChecked,
    totalAccepted,
    totalRejected,
    totalSaved,
    totalMerged,
    totalDuplicates,
    openAiEnabled: isOpenAiEnabled(),
    totalOpenAiCalls: aiState.calls,
    openAiUsage: {
      inputTokens: aiState.inputTokens,
      outputTokens: aiState.outputTokens,
      totalTokens: aiState.totalTokens
    },
    results
  };

  await saveRunLog({
    type: "all_sources",
    status: failedSources > 0 ? "completed_with_errors" : "success",
    ...finalResult
  });

  return finalResult;
}

module.exports = {
  fetchOneSource,
  runRssPipeline
};