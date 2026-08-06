const axios = require("axios");
const cheerio = require("cheerio");
const { normalizeUrl, cleanText } = require("../utils/helpers");

function boundedTimeout(envName, fallback, maximum) {
  const configured = Number(process.env[envName] || fallback);
  const value =
    Number.isFinite(configured) && configured > 0 ? configured : fallback;

  return Math.min(value, maximum);
}

const REQUEST_TIMEOUT_MS = boundedTimeout(
  "RSS_DISCOVERY_TIMEOUT_MS",
  3000,
  3000
);
const TOTAL_TIMEOUT_MS = boundedTimeout(
  "RSS_DISCOVERY_TOTAL_TIMEOUT_MS",
  10000,
  10000
);
const MAX_RESULTS = 10;

const COMMON_PATHS = [
  "/feed",
  "/rss",
  "/rss.xml",
  "/atom.xml",
  "/feed.xml",
  "/news/rss",
  "/category/business/feed",
  "/business/feed"
];

const NO_FEEDS_MESSAGE =
  "No valid RSS/Atom feeds found. You can paste the RSS URL manually.";

function emptyResult(websiteUrl, message = NO_FEEDS_MESSAGE) {
  return {
    websiteUrl,
    foundCount: 0,
    candidates: [],
    message
  };
}

function getAxiosConfig(signal) {
  return {
    timeout: REQUEST_TIMEOUT_MS,
    signal,
    maxRedirects: 5,
    responseType: "text",
    maxContentLength: 2 * 1024 * 1024,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*"
    }
  };
}

function safeAbsoluteUrl(href, baseUrl) {
  try {
    if (!href) return "";
    const url = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function getOriginUrl(inputUrl) {
  try {
    return new URL(inputUrl).origin;
  } catch {
    return "";
  }
}

function looksLikeFeed(xml) {
  const text = String(xml || "").trim().toLowerCase();

  if (!text || text.includes("<html") || text.includes("<body")) return false;
  if (text.includes("cloudflare") || text.includes("access denied")) return false;
  if (text.includes("forbidden") || text.includes("attention required")) {
    return false;
  }

  return (
    text.includes("<rss") ||
    text.includes("<feed") ||
    text.includes("<channel") ||
    text.includes("<item") ||
    text.includes("<entry")
  );
}

function detectFeedType(xml) {
  const text = String(xml || "").toLowerCase();
  return text.includes("<feed") || text.includes("<entry") ? "atom" : "rss";
}

function extractHtmlCandidates(html, baseUrl) {
  const $ = cheerio.load(String(html || ""));
  const candidates = [];

  $("link").each((index, element) => {
    const rel = String($(element).attr("rel") || "").toLowerCase();
    const type = String($(element).attr("type") || "").toLowerCase();
    const href = safeAbsoluteUrl($(element).attr("href"), baseUrl);
    const isAlternateFeed =
      rel.includes("alternate") &&
      (type.includes("rss") || type.includes("atom"));
    const isExplicitFeedType =
      type.includes("application/rss+xml") ||
      type.includes("application/atom+xml");

    if (!href || (!isAlternateFeed && !isExplicitFeedType)) return;

    candidates.push({
      title: cleanText($(element).attr("title")) || "RSS Feed",
      url: href,
      source: "html_link"
    });
  });

  return candidates;
}

function dedupeCandidates(candidates) {
  const seen = new Set();

  return candidates.filter((candidate) => {
    const key = candidate.url.replace(/\/+$/, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function validateCandidate(candidate, signal) {
  try {
    const response = await axios.get(candidate.url, getAxiosConfig(signal));

    if (response.status < 200 || response.status >= 300) return null;

    const body = String(response.data || "");
    if (!looksLikeFeed(body)) return null;

    return {
      title: candidate.title || "RSS Feed",
      url: candidate.url,
      type: detectFeedType(body),
      status: "valid",
      source: candidate.source
    };
  } catch (error) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      console.warn(`[RSS discovery] candidate timeout: ${candidate.url}`);
    }

    return null;
  }
}

async function runDiscovery(normalizedInput, signal) {
  const originUrl = getOriginUrl(normalizedInput);
  const candidates = [];

  // Homepage discovery is best effort. A timeout never prevents common-path checks.
  try {
    const pageResponse = await axios.get(
      normalizedInput,
      getAxiosConfig(signal)
    );

    if (pageResponse.status >= 200 && pageResponse.status < 400) {
      candidates.push(
        ...extractHtmlCandidates(pageResponse.data, normalizedInput)
      );
    }
  } catch (error) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      console.warn(`[RSS discovery] page timeout: ${normalizedInput}`);
    } else {
      console.warn(
        `[RSS discovery] page check skipped: ${normalizedInput}; ${error.message}`
      );
    }
  }

  if (signal.aborted) {
    return emptyResult(originUrl || normalizedInput);
  }

  // Exactly eight bounded common-path checks at most.
  const commonCandidates = COMMON_PATHS.slice(0, 8).map((path) => ({
    title: path.includes("atom") ? "Atom Feed" : "RSS Feed",
    url: `${originUrl}${path}`,
    source: "common_path"
  }));

  const candidatesToValidate = dedupeCandidates([
    ...candidates.slice(0, 12),
    ...commonCandidates
  ]);

  const settled = await Promise.allSettled(
    candidatesToValidate.map((candidate) =>
      validateCandidate(candidate, signal)
    )
  );

  const validCandidates = settled
    .filter((item) => item.status === "fulfilled" && item.value)
    .map((item) => item.value)
    .slice(0, MAX_RESULTS);

  return {
    websiteUrl: originUrl || normalizedInput,
    foundCount: validCandidates.length,
    candidates: validCandidates,
    message:
      validCandidates.length > 0
        ? `${validCandidates.length} valid RSS/Atom feed${
            validCandidates.length === 1 ? "" : "s"
          } found.`
        : NO_FEEDS_MESSAGE
  };
}

async function discoverRssFeeds(websiteUrl) {
  const normalizedInput = normalizeUrl(websiteUrl);

  if (!normalizedInput) {
    return emptyResult(String(websiteUrl || "").trim(), "Website URL is required");
  }

  const controller = new AbortController();
  let timer;

  const totalTimeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      console.warn(
        `[RSS discovery] total timeout after ${TOTAL_TIMEOUT_MS}ms: ${normalizedInput}`
      );
      resolve(emptyResult(getOriginUrl(normalizedInput) || normalizedInput));
    }, TOTAL_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      runDiscovery(normalizedInput, controller.signal),
      totalTimeout
    ]);
  } catch (error) {
    console.warn(`[RSS discovery] failed safely: ${error.message}`);
    return emptyResult(getOriginUrl(normalizedInput) || normalizedInput);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  discoverRssFeeds
};
