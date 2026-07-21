const { cleanText, getNumberEnv } = require("./helpers");

const BUSINESS_KEYWORDS = [
  "business",
  "entrepreneur",
  "entrepreneurs",
  "startup",
  "startups",
  "sme",
  "small business",
  "company",
  "companies",
  "finance",
  "financial",
  "bank",
  "banking",
  "loan",
  "credit",
  "tax",
  "vat",
  "economy",
  "economic",
  "inflation",
  "rupee",
  "dollar",
  "investment",
  "investor",
  "fdi",
  "export",
  "exports",
  "import",
  "imports",
  "trade",
  "market",
  "markets",
  "tourism",
  "tourist",
  "hotel",
  "travel",
  "technology",
  "tech",
  "ai",
  "artificial intelligence",
  "digital",
  "software",
  "policy",
  "government policy",
  "industry",
  "manufacturing",
  "agriculture",
  "paddy",
  "tea",
  "rubber",
  "coconut",
  "fuel",
  "energy",
  "electricity",
  "employment",
  "jobs",
  "foreign employment",
  "remittance",
  "remittances"
];

const SRI_LANKA_KEYWORDS = [
  "sri lanka",
  "srilanka",
  "sri-lanka",
  "lanka",
  "lankan",
  "colombo",
  "ceylon",
  "lk",
  "central bank of sri lanka",
  "cbsl",
  "boi",
  "ceb"
];

const REJECT_KEYWORDS = [
  "football",
  "fifa",
  "cricket",
  "match",
  "player",
  "coach",
  "sports",
  "sport",
  "celebrity",
  "movie",
  "music",
  "entertainment",
  "accident",
  "murder",
  "crime",
  "weather forecast",
  "school admission"
];

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function countHits(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword)).length;
}

function detectCategory(text) {
  if (/startup|founder|entrepreneur|venture/.test(text)) return "Startups";
  if (/tourism|tourist|travel|hotel|hospitality/.test(text)) return "Tourism";
  if (/export|exports|import|imports|trade/.test(text)) return "Exports";
  if (/agriculture|paddy|tea|rubber|coconut|farmer/.test(text)) {
    return "Agriculture";
  }
  if (/investment|investor|fdi/.test(text)) return "Investment";
  if (/finance|financial|bank|banking|loan|credit/.test(text)) return "Finance";
  if (/economy|economic|inflation|rupee|dollar|gdp/.test(text)) {
    return "Economy";
  }
  if (/technology|tech|ai|digital|software|platform/.test(text)) {
    return "Technology";
  }
  if (/policy|government|tax|vat|regulation|budget/.test(text)) {
    return "Policy";
  }
  if (/sme|small business|business owner/.test(text)) return "SME";

  return "Business";
}

function filterRssItem(item) {
  const text = cleanText(
    `${item.title} ${item.description} ${item.sourceName} ${item.articleUrl}`
  ).toLowerCase();

  const businessHits = countHits(text, BUSINESS_KEYWORDS);
  const sriLankaHits = countHits(text, SRI_LANKA_KEYWORDS);
  const rejectHits = countHits(text, REJECT_KEYWORDS);

  let score = 0;

  score += Math.min(businessHits * 12, 65);
  score += sriLankaHits > 0 ? 25 : 0;

  if (rejectHits > 0 && businessHits < 2) {
    score -= 50;
  }

  score = Math.max(0, Math.min(100, score));

  const minScore = getNumberEnv("MIN_KEYWORD_SCORE", 25);
  const accepted = score >= minScore;

  return {
    accepted,
    score,
    category: detectCategory(text),
    reason: accepted ? "accepted_by_keyword_filter" : "rejected_by_keyword_filter",
    hits: {
      businessHits,
      sriLankaHits,
      rejectHits
    }
  };
}

module.exports = {
  filterRssItem
};