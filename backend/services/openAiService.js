const { cleanText, getNumberEnv } = require("../utils/helpers");

let openAiClient = null;

const CATEGORIES = [
  "Business",
  "Startups",
  "SME",
  "Finance",
  "Economy",
  "Investment",
  "Technology",
  "Tourism",
  "Exports",
  "Agriculture",
  "Policy",
  "Local News"
];

function isOpenAiEnabled() {
  return (
    process.env.ENABLE_OPENAI_ANALYSIS === "true" &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

async function getClient() {
  if (openAiClient) return openAiClient;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const imported = await import("openai");
  const OpenAI = imported.default;

  openAiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  return openAiClient;
}

function limitText(value, maxChars) {
  const text = cleanText(value);

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}...`;
}

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

function normalizeCategory(value) {
  const category = cleanText(value);

  if (CATEGORIES.includes(category)) {
    return category;
  }

  return "Business";
}

function normalizeAnalysis(parsed, item) {
  const accepted = parsed.accepted === true;
  const confidence = Number(parsed.confidence || 0);

  return {
    accepted,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    category: normalizeCategory(parsed.category || item.category),
    summary:
      cleanText(parsed.summary) ||
      cleanText(item.description) ||
      cleanText(item.title),
    whyItMatters:
      cleanText(parsed.whyItMatters) ||
      "Useful update for Sri Lankan business readers.",
    canonicalTitle:
      cleanText(parsed.canonicalTitle) || cleanText(item.title),
    reason:
      cleanText(parsed.reason) ||
      (accepted ? "accepted_by_openai" : "rejected_by_openai")
  };
}

async function analyzeRssNewsItem(item) {
  if (!isOpenAiEnabled()) {
    return {
      enabled: false,
      accepted: true,
      category: item.category || "Business",
      summary: item.description || item.title,
      whyItMatters: "OpenAI analysis disabled.",
      canonicalTitle: item.title,
      confidence: 0,
      reason: "openai_disabled",
      usage: null
    };
  }

  const client = await getClient();

  const maxDescriptionChars = getNumberEnv("OPENAI_MAX_DESCRIPTION_CHARS", 450);
  const maxOutputTokens = getNumberEnv("OPENAI_MAX_OUTPUT_TOKENS", 180);

  const payload = {
    title: limitText(item.title, 180),
    description: limitText(item.description, maxDescriptionChars),
    sourceName: limitText(item.sourceName, 80),
    categoryFromKeywordFilter: item.category || "Business",
    keywordScore: item.keywordScore || 0
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      accepted: {
        type: "boolean"
      },
      category: {
        type: "string",
        enum: CATEGORIES
      },
      summary: {
        type: "string"
      },
      whyItMatters: {
        type: "string"
      },
      canonicalTitle: {
        type: "string"
      },
      confidence: {
        type: "number"
      },
      reason: {
        type: "string"
      }
    },
    required: [
      "accepted",
      "category",
      "summary",
      "whyItMatters",
      "canonicalTitle",
      "confidence",
      "reason"
    ]
  };

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    store: false,
    max_output_tokens: maxOutputTokens,
    input: [
      {
        role: "system",
        content:
          "You analyze RSS news for a Sri Lankan entrepreneur/business news website. Be strict. Accept only useful business, economy, startup, finance, tourism, export, agriculture, policy, technology, or important local news. Return short JSON. summary max 28 words. whyItMatters max 20 words. canonicalTitle max 12 words."
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "rss_news_analysis",
        strict: true,
        schema
      }
    }
  });

  const outputText = cleanText(response.output_text || "");
  const parsed = safeJsonParse(outputText);

  if (!parsed) {
    return {
      enabled: true,
      accepted: true,
      category: item.category || "Business",
      summary: item.description || item.title,
      whyItMatters: "AI response parse failed, used local filter result.",
      canonicalTitle: item.title,
      confidence: 0,
      reason: "openai_parse_failed",
      usage: response.usage || null
    };
  }

  return {
    enabled: true,
    ...normalizeAnalysis(parsed, item),
    usage: response.usage || null
  };
}

module.exports = {
  analyzeRssNewsItem,
  isOpenAiEnabled
};