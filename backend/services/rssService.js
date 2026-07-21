const Parser = require("rss-parser");
const axios = require("axios");
const cheerio = require("cheerio");
const { cleanText, normalizeUrl, getNumberEnv } = require("../utils/helpers");
const { filterRssItem } = require("../utils/keywordFilter");

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*"
  }
});

function getSourceNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    const name = host.split(".")[0];

    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "RSS Source";
  }
}

function normalizeRssItem(rawItem, rssUrl, feedTitle) {
  const articleUrl = normalizeUrl(rawItem.link || rawItem.guid || "");

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

function isHtmlInsteadOfRss(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("attribute without value") ||
    message.includes("non-whitespace before first tag") ||
    message.includes("unexpected close tag") ||
    message.includes("text data outside of root node") ||
    message.includes("invalid character in entity name")
  );
}

async function readHtmlCategoryPage(pageUrl) {
  const finalUrl = normalizeUrl(pageUrl);

  if (!finalUrl) {
    throw new Error("Valid URL is required");
  }

  const response = await axios.get(finalUrl, {
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  const $ = cheerio.load(response.data);
  const pageTitle = cleanText($("title").first().text()) || getSourceNameFromUrl(finalUrl);

  const origin = new URL(finalUrl).origin;
  const maxItems = getNumberEnv("MAX_RSS_ITEMS_PER_SOURCE", 20);
  const seen = new Set();
  const items = [];

  $("a").each((_, el) => {
    if (items.length >= maxItems) return;

    const title = cleanText($(el).text());
    const href = cleanText($(el).attr("href"));

    if (!title || title.length < 18 || !href) return;

    let articleUrl = "";

    try {
      articleUrl = new URL(href, origin).href;
    } catch {
      return;
    }

    const parsed = new URL(articleUrl);
    const path = parsed.pathname.toLowerCase();

    if (!articleUrl.includes("ft.lk")) return;
    if (path.includes("/rss")) return;
    if (path.includes("/search")) return;
    if (path.includes("/about")) return;
    if (path.includes("/contact")) return;
    if (path.includes("/advertise")) return;
    if (seen.has(articleUrl)) return;

    seen.add(articleUrl);

    items.push({
      title,
      description: title,
      articleUrl,
      sourceName: getSourceNameFromUrl(finalUrl),
      rssUrl: finalUrl,
      publishedAt: null
    });
  });

  if (items.length === 0) {
    throw new Error("No article links found from this page.");
  }

  return {
    feedTitle: pageTitle,
    rssUrl: finalUrl,
    totalRawItems: items.length,
    items
  };
}

async function readRssFeed(rssUrl) {
  const finalRssUrl = normalizeUrl(rssUrl);

  if (!finalRssUrl) {
    throw new Error("Valid RSS URL is required");
  }

  let feed;

  try {
    feed = await parser.parseURL(finalRssUrl);
  } catch (error) {
    if (
      error?.response?.status === 404 ||
      String(error?.message || "").includes("Status code 404")
    ) {
      console.log("RSS URL 404. Trying HTML category page fallback...");
      return readHtmlCategoryPage(finalRssUrl);
    }

    if (isHtmlInsteadOfRss(error)) {
      console.log("URL is HTML, not RSS. Trying HTML category page fallback...");
      return readHtmlCategoryPage(finalRssUrl);
    }

    throw error;
  }

  const maxItems = getNumberEnv("MAX_RSS_ITEMS_PER_SOURCE", 20);
  const rawItems = Array.isArray(feed.items) ? feed.items : [];

  const items = rawItems
    .map((item) => normalizeRssItem(item, finalRssUrl, feed.title))
    .filter((item) => item.title && item.articleUrl)
    .slice(0, maxItems);

  if (items.length === 0) {
    throw new Error(
      "RSS feed was read, but no valid article items were found. Try another category feed URL."
    );
  }

  return {
    feedTitle: feed.title || getSourceNameFromUrl(finalRssUrl),
    rssUrl: finalRssUrl,
    totalRawItems: rawItems.length,
    items
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
  readAndFilterRssFeed
};