const Parser = require("rss-parser");
const axios = require("axios");
const { cleanText, normalizeUrl, getNumberEnv } = require("../utils/helpers");
const { filterRssItem } = require("../utils/keywordFilter");

function boundedTimeout(envName, fallback) {
  const configured = Number(process.env[envName] || fallback);
  const safeValue =
    Number.isFinite(configured) && configured > 0 ? configured : fallback;

  return Math.min(safeValue, 8000);
}

const REQUEST_TIMEOUT_MS = boundedTimeout("RSS_REQUEST_TIMEOUT_MS", 8000);
const IMAGE_LOOKUP_TIMEOUT_MS = boundedTimeout(
  "IMAGE_LOOKUP_TIMEOUT_MS",
  5000
);

const parser = new Parser({
  timeout: REQUEST_TIMEOUT_MS,
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
      ["itunes:image", "itunesImage"],
      ["image", "image"]
    ]
  }
});

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Accept:
    "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

function getSourceNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const name = host.split(".")[0];

    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "RSS Source";
  }
}

function normalizeAssetUrl(value, baseUrl) {
  try {
    const raw = cleanText(value);

    if (!raw) return "";
    if (raw.startsWith("data:")) return "";
    if (raw.startsWith("blob:")) return "";

    return new URL(raw, baseUrl).href;
  } catch {
    return "";
  }
}

function getImageFromObject(value, baseUrl) {
  if (!value) return "";

  if (typeof value === "string") {
    return normalizeAssetUrl(value, baseUrl);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = getImageFromObject(item, baseUrl);
      if (result) return result;
    }

    return "";
  }

  if (typeof value === "object") {
    const direct =
      value.url ||
      value.href ||
      value.link ||
      value.src ||
      value._ ||
      value.$?.url ||
      value.$?.href ||
      value.$?.src;

    return normalizeAssetUrl(direct, baseUrl);
  }

  return "";
}

function extractImageFromHtml(html, baseUrl) {
  const text = String(html || "");

  if (!text) return "";

  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const imageUrl = normalizeAssetUrl(match[1], baseUrl);

      if (imageUrl) {
        return imageUrl;
      }
    }
  }

  return "";
}

function extractRssImage(rawItem, baseUrl) {
  const candidates = [
    rawItem.enclosure,
    rawItem.mediaContent,
    rawItem.mediaThumbnail,
    rawItem.itunesImage,
    rawItem.image
  ];

  for (const candidate of candidates) {
    const imageUrl = getImageFromObject(candidate, baseUrl);

    if (imageUrl) {
      return imageUrl;
    }
  }

  const htmlFields = [
    rawItem.contentEncoded,
    rawItem.content,
    rawItem.description,
    rawItem.summary
  ];

  for (const html of htmlFields) {
    const imageUrl = extractImageFromHtml(html, baseUrl);

    if (imageUrl) {
      return imageUrl;
    }
  }

  return "";
}

async function extractArticleMetaImage(articleUrl) {
  const enabled = process.env.ENABLE_ARTICLE_IMAGE_LOOKUP === "true";

  if (!enabled || !articleUrl) {
    return "";
  }

  try {
    const response = await axios.get(articleUrl, {
      timeout: IMAGE_LOOKUP_TIMEOUT_MS,
      maxRedirects: 5,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400,
      headers: REQUEST_HEADERS
    });

    return extractImageFromHtml(response.data, articleUrl);
  } catch (error) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      console.warn(`[RSS image] timeout: ${articleUrl}`);
    }

    return "";
  }
}

async function normalizeRssItem(rawItem, rssUrl, feedTitle) {
  const articleUrl = normalizeUrl(rawItem.link || rawItem.guid || "");
  const rssImageUrl = extractRssImage(rawItem, rssUrl);
  const articleImageUrl = rssImageUrl || (await extractArticleMetaImage(articleUrl));

  return {
    title: cleanText(rawItem.title),
    description: cleanText(
      rawItem.contentSnippet ||
        rawItem.summary ||
        rawItem.content ||
        rawItem.description ||
        ""
    ),
    articleUrl,
    imageUrl: articleImageUrl,
    sourceName: cleanText(feedTitle) || getSourceNameFromUrl(rssUrl),
    rssUrl,
    publishedAt:
      rawItem.isoDate ||
      rawItem.pubDate ||
      rawItem.published ||
      rawItem.created ||
      null
  };
}

function looksLikeHtml(value) {
  const text = String(value || "").trim().toLowerCase();

  return (
    text.startsWith("<!doctype html") ||
    text.startsWith("<html") ||
    text.includes("<body") ||
    text.includes("cloudflare") ||
    text.includes("access denied") ||
    text.includes("forbidden")
  );
}

function looksLikeRss(value) {
  const text = String(value || "").trim().toLowerCase();

  return (
    text.startsWith("<?xml") ||
    text.startsWith("<rss") ||
    text.startsWith("<feed") ||
    text.includes("<channel") ||
    text.includes("<item") ||
    text.includes("<entry")
  );
}

function looksBlockedPage(value) {
  const text = String(value || "").trim().toLowerCase();

  return (
    text.includes("cloudflare") ||
    text.includes("access denied") ||
    text.includes("forbidden") ||
    text.includes("attention required")
  );
}

function classifyRssError(error) {
  const message = String(error?.message || "").toLowerCase();

  if (
    error?.code === "RSS_TIMEOUT" ||
    error?.code === "ECONNABORTED" ||
    error?.code === "ETIMEDOUT" ||
    /timed?\s*out|timeout/.test(message)
  ) {
    return {
      sourceStatus: "timeout",
      message: "RSS source timed out. The website may be blocking requests."
    };
  }

  if (message.includes("returned html") || message.includes("not rss xml")) {
    return {
      sourceStatus: "invalid_html",
      message:
        "This URL returned HTML, not RSS XML. Use a direct RSS XML feed URL."
    };
  }

  if (
    message.includes("403") ||
    message.includes("blocking") ||
    message.includes("blocked") ||
    message.includes("access denied") ||
    message.includes("forbidden")
  ) {
    return {
      sourceStatus: "blocked",
      message: "Invalid RSS/Atom feed URL."
    };
  }

  return {
    sourceStatus: "failed",
    message: "Invalid RSS/Atom feed URL."
  };
}

async function downloadFeedXml(rssUrl) {
  const finalRssUrl = normalizeUrl(rssUrl);

  if (!finalRssUrl) {
    throw new Error("Valid RSS URL is required");
  }

  try {
    const response = await axios.get(finalRssUrl, {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 5,
      responseType: "text",
      validateStatus: () => true,
      headers: REQUEST_HEADERS
    });

    if (response.status === 403) {
      throw new Error(
        "Status code 403. This RSS source is blocking server requests."
      );
    }

    if (response.status === 404) {
      throw new Error("Status code 404. RSS feed URL not found.");
    }

    if (response.status >= 500) {
      throw new Error(
        `Status code ${response.status}. Source website is unavailable or blocking the request.`
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Status code ${response.status}`);
    }

    const xml = String(response.data || "");

    if (looksBlockedPage(xml)) {
      const blockedError = new Error(
        "RSS source request was blocked by the website."
      );
      blockedError.code = "RSS_BLOCKED";
      throw blockedError;
    }

    if (looksLikeHtml(xml)) {
      throw new Error(
        "This URL returned HTML, not RSS XML. Use a direct RSS XML feed URL."
      );
    }

    if (!looksLikeRss(xml)) {
      throw new Error("This URL does not look like a valid RSS/Atom feed.");
    }

    return {
      url: finalRssUrl,
      xml
    };
  } catch (error) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      const timeoutError = new Error(
        `RSS request timed out after ${REQUEST_TIMEOUT_MS}ms`
      );
      timeoutError.code = "RSS_TIMEOUT";
      throw timeoutError;
    }

    throw new Error(error.message || "Failed to download RSS feed");
  }
}

async function validateRssSource(rssUrl) {
  const normalizedUrl = normalizeUrl(rssUrl);

  if (!normalizedUrl) {
    const error = new Error("RSS URL is required.");
    error.code = "RSS_URL_REQUIRED";
    error.sourceStatus = "failed";
    throw error;
  }

  try {
    const result = await downloadFeedXml(normalizedUrl);

    return {
      valid: true,
      rssUrl: result.url,
      type: String(result.xml || "").toLowerCase().includes("<feed")
        ? "atom"
        : "rss",
      sourceStatus: "active",
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    const classified = classifyRssError(error);
    const validationError = new Error(classified.message);
    validationError.code = error.code || "RSS_VALIDATION_FAILED";
    validationError.sourceStatus = classified.sourceStatus;
    throw validationError;
  }
}

async function readRssFeed(rssUrl) {
  const { url, xml } = await downloadFeedXml(rssUrl);

  let feed;

  try {
    feed = await parser.parseString(xml);
  } catch (error) {
    throw new Error(`RSS parse failed: ${error.message}`);
  }

  const maxItems = getNumberEnv("MAX_RSS_ITEMS_PER_SOURCE", 20);
  const rawItems = Array.isArray(feed.items) ? feed.items : [];

  const items = await Promise.all(
    rawItems.slice(0, maxItems).map((item) => normalizeRssItem(item, url, feed.title))
  );

  const validItems = items.filter((item) => item.title && item.articleUrl);

  if (validItems.length === 0) {
    throw new Error("RSS feed was read, but no valid article items were found.");
  }

  return {
    feedTitle: feed.title || getSourceNameFromUrl(url),
    rssUrl: url,
    totalRawItems: rawItems.length,
    items: validItems
  };
}

async function readAndFilterRssFeed(rssUrl) {
  const result = await readRssFeed(rssUrl);

  const filteredItems = result.items.map((item) => {
    const filter = filterRssItem(item);

    return {
      ...item,
      accepted: filter.accepted,
      keywordScore: filter.score,
      category: filter.category,
      filterReason: filter.reason,
      hits: filter.hits
    };
  });

  const acceptedItems = filteredItems.filter((item) => item.accepted);
  const rejectedItems = filteredItems.filter((item) => !item.accepted);

  return {
    feedTitle: result.feedTitle,
    rssUrl: result.rssUrl,
    totalRawItems: result.totalRawItems,
    checkedItems: filteredItems.length,
    acceptedCount: acceptedItems.length,
    rejectedCount: rejectedItems.length,
    acceptedItems,
    rejectedItems
  };
}

module.exports = {
  readRssFeed,
  readAndFilterRssFeed,
  validateRssSource,
  classifyRssError
};
