const cheerio = require("cheerio");
const { db } = require("../config/firebase");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    const match = String(value || "").match(/\{[\s\S]*\}/);

    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeUrl(input) {
  let value = String(input || "").trim();

  if (!value) return "";

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    value = `https://${value}`;
  }

  const url = new URL(value);
  url.hash = "";

  return url.href;
}

async function fetchPageData(inputUrl) {
  const finalUrl = normalizeUrl(inputUrl);

  if (!finalUrl) {
    throw new Error("Invalid URL");
  }

  const response = await fetch(finalUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read URL. Status ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe, svg").remove();

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text() ||
    $("h1").first().text() ||
    "";

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  const bodyText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  return {
    url: finalUrl,
    title: String(title).trim(),
    description: String(description).trim(),
    text: bodyText
  };
}

function getPlatformInfo(platform) {
  const value = String(platform || "instagram").toLowerCase();

  if (value === "facebook") {
    return {
      platform: "facebook",
      platformLabel: "Facebook Post",
      size: "1200x630",
      ratio: "1.91:1"
    };
  }

  if (value === "whatsapp") {
    return {
      platform: "whatsapp",
      platformLabel: "WhatsApp Status",
      size: "1080x1920",
      ratio: "9:16"
    };
  }

  return {
    platform: "instagram",
    platformLabel: "Instagram Post",
    size: "1080x1080",
    ratio: "1:1"
  };
}

async function generateSocialPostPreview({ url, platform }) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY in backend environment");
  }

  const page = await fetchPageData(url);
  const platformInfo = getPlatformInfo(platform);

  const prompt = `
You are a professional social media content creator for Sri Lankan Entrepreneur .COM.

Create a text-only social media post from this article/page.

Rules:
- No image.
- Make it suitable for ${platformInfo.platformLabel}.
- Target design size: ${platformInfo.size}.
- Ratio: ${platformInfo.ratio}.
- Make the post short, clean, professional, and engaging.
- Audience: Sri Lankan business, startup, entrepreneurship, and news audience.
- Do not copy the full article.
- Return ONLY valid JSON.

Return JSON:
{
  "title": "short strong title",
  "hook": "attention grabbing first line",
  "bodyLines": ["line 1", "line 2", "line 3"],
  "caption": "full caption for social media",
  "hashtags": ["SriLanka", "Business", "Entrepreneur"],
  "callToAction": "short call to action",
  "tone": "professional"
}

Article/page:
URL: ${page.url}
Title: ${page.title}
Description: ${page.description}
Text: ${page.text}
`;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "You generate professional social media post content. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.45,
      response_format: {
        type: "json_object"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || "{}";
  const parsed = safeJsonParse(content) || {};

  return {
    title: String(parsed.title || page.title || "Untitled Post").slice(0, 90),
    hook: String(parsed.hook || "").slice(0, 160),
    bodyLines: Array.isArray(parsed.bodyLines)
      ? parsed.bodyLines.map((line) => String(line)).slice(0, 5)
      : [],
    caption: String(parsed.caption || "").slice(0, 2200),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((tag) => String(tag).replace("#", "")).slice(0, 10)
      : [],
    callToAction: String(parsed.callToAction || "Read more").slice(0, 80),
    tone: String(parsed.tone || "professional"),

    platform: platformInfo.platform,
    platformLabel: platformInfo.platformLabel,
    size: platformInfo.size,
    ratio: platformInfo.ratio,

    sourceUrl: page.url,
    sourceTitle: page.title,
    createdAt: new Date().toISOString()
  };
}

async function saveSocialPost(post) {
  const ref = await db.collection("social_posts").add({
    title: post.title || "Untitled Post",
    hook: post.hook || "",
    bodyLines: Array.isArray(post.bodyLines) ? post.bodyLines : [],
    caption: post.caption || "",
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    callToAction: post.callToAction || "",
    tone: post.tone || "professional",

    platform: post.platform || "instagram",
    platformLabel: post.platformLabel || "Instagram Post",
    size: post.size || "1080x1080",
    ratio: post.ratio || "1:1",

    sourceUrl: post.sourceUrl || "",
    sourceTitle: post.sourceTitle || "",

    savedAt: new Date().toISOString(),
    createdAt: post.createdAt || new Date().toISOString()
  });

  return ref.id;
}

async function getSocialPosts() {
  const snap = await db
    .collection("social_posts")
    .orderBy("savedAt", "desc")
    .limit(100)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function deleteSocialPost(id) {
  await db.collection("social_posts").doc(id).delete();
}

module.exports = {
  generateSocialPostPreview,
  saveSocialPost,
  getSocialPosts,
  deleteSocialPost
};