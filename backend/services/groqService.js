const Groq = require('groq-sdk');
const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const rssParser = new RSSParser({ timeout: 10000 });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ── Fetch a page HTML ──────────────────────────────────
async function fetchHTML(url) {
  const res = await axios.get(url, { timeout: 15000, headers: HEADERS });
  return res.data;
}

// ── Extract clean readable text from HTML ──────────────
function extractText(html) {
  const $ = cheerio.load(html);
  $('script,style,nav,footer,header,aside,iframe,noscript,form,button').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().substring(0, 6000);
}

// ── Detect RSS feed from homepage ──────────────────────
async function detectRSS(siteUrl) {
  try {
    const html = await fetchHTML(siteUrl);
    const $ = cheerio.load(html);
    const tag = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first().attr('href');
    if (tag) return tag.startsWith('http') ? tag : new URL(tag, siteUrl).href;

    for (const p of ['/rss', '/feed', '/rss.xml', '/feed.xml', '/rss/news', '/feeds/posts/default']) {
      try {
        const u = new URL(p, siteUrl).href;
        await rssParser.parseURL(u);
        return u;
      } catch {}
    }
  } catch {}
  return null;
}

// ── Get individual article URLs from RSS ───────────────
async function getArticleUrlsFromRSS(feedUrl, siteUrl) {
  const feed = await rssParser.parseURL(feedUrl);
  return feed.items.slice(0, 20).map(item => ({
    title: (item.title || '').trim(),
    url: item.link || siteUrl,
    rawContent: item.contentSnippet || item.content || item.summary || '',
    publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
  })).filter(a => a.title.length > 10);
}

// ── Get individual article URLs from HTML ──────────────
async function getArticleUrlsFromHTML(siteUrl) {
  const html = await fetchHTML(siteUrl);
  const $ = cheerio.load(html);
  const seen = new Set();
  const articles = [];

  // Try common article link patterns
  const selectors = [
    'article a[href]', 'h2 a[href]', 'h3 a[href]',
    '.article a[href]', '.news-item a[href]', '.post a[href]',
    '.story a[href]', '.card a[href]', '.entry a[href]',
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const title = $el.text().trim() || $el.attr('title') || '';
      if (!href || title.length < 15 || seen.has(href)) return;

      const fullUrl = href.startsWith('http') ? href : new URL(href, siteUrl).href;
      // Only same-domain links
      if (!fullUrl.includes(new URL(siteUrl).hostname)) return;

      seen.add(href);
      articles.push({ title, url: fullUrl, rawContent: '', publishedAt: new Date() });
    });
    if (articles.length >= 20) break;
  }

  return articles.slice(0, 20);
}

// ── Read a single article page and extract its content ─
async function readArticlePage(articleUrl) {
  try {
    const html = await fetchHTML(articleUrl);
    const $ = cheerio.load(html);
    $('script,style,nav,footer,header,aside,iframe,noscript,form,button,.ad,.advertisement,.social,.share,.related').remove();

    // Try to get article body text
    const bodySelectors = [
      'article', '[class*="article-body"]', '[class*="article-content"]',
      '[class*="story-body"]', '[class*="post-content"]', '[class*="entry-content"]',
      'main', '.content', '#content',
    ];

    let content = '';
    for (const sel of bodySelectors) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) { content = text; break; }
    }

    if (!content) {
      content = $('p').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 40).join(' ');
    }

    return content.substring(0, 4000);
  } catch {
    return '';
  }
}

// ── Use Groq to analyze ONE article deeply ────────────
async function analyzeArticleWithGroq(title, content, articleUrl, siteName) {
  const prompt = `You are a professional news editor. Analyze this news article and return ONLY a valid JSON object with NO extra text.

Article Title: ${title}
Source Website: ${siteName}
Article URL: ${articleUrl}
Article Content:
${content.substring(0, 3000)}

Return this exact JSON structure:
{
  "summary": "A clear 3-4 sentence summary of what this news article is about. Make it informative and engaging.",
  "category": "ONE of: Technology, Politics, Business, Sports, Entertainment, Science, Health, World, Local, Environment, Education, Crime, Economy",
  "tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "sentiment": "positive or neutral or negative",
  "isValidArticle": true
}

Rules:
- summary must be 3-4 complete sentences about the actual news
- category must be exactly one from the list above
- tags must be 3-6 relevant keywords
- if the content is not a real news article (e.g. a homepage, 404 page, advertisement), set isValidArticle to false
- Return ONLY the JSON object, no markdown, no extra text`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return result;
  } catch {
    return {
      summary: content.substring(0, 300) || 'No summary available.',
      category: 'World',
      tags: [],
      sentiment: 'neutral',
      isValidArticle: content.length > 100,
    };
  }
}

// ── Sleep helper ───────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── MAIN: Scrape source, read each article URL ─────────
async function scrapeNewsSource(source) {
  const { url: siteUrl, name: siteName } = source;
  console.log(`  📡 [${siteName}] Starting scrape of ${siteUrl}`);

  // Step 1: Get list of article URLs
  let articleList = [];
  const rssUrl = await detectRSS(siteUrl);

  if (rssUrl) {
    console.log(`  ✅ [${siteName}] RSS found: ${rssUrl}`);
    articleList = await getArticleUrlsFromRSS(rssUrl, siteUrl);
  } else {
    console.log(`  ⚠️  [${siteName}] No RSS, parsing homepage HTML`);
    articleList = await getArticleUrlsFromHTML(siteUrl);
  }

  console.log(`  📋 [${siteName}] Found ${articleList.length} article URLs`);

  if (articleList.length === 0) return [];

  // Step 2: Visit EACH article URL, read full content, analyze with Groq
  const processed = [];

  for (const article of articleList.slice(0, 15)) {
    try {
      console.log(`    🔍 Reading: ${article.url.substring(0, 80)}...`);

      // Get full article content
      let content = article.rawContent;
      if (!content || content.length < 200) {
        content = await readArticlePage(article.url);
      }

      if (!content || content.length < 80) {
        console.log(`    ⏭  Skipping - no content`);
        continue;
      }

      // Analyze with Groq AI
      const analysis = await analyzeArticleWithGroq(article.title, content, article.url, siteName);

      if (!analysis.isValidArticle) {
        console.log(`    ⏭  Skipping - not a valid news article`);
        continue;
      }

      processed.push({
        title: article.title,
        articleUrl: article.url,   // ← exact URL of this article
        summary: analysis.summary,
        category: analysis.category || 'World',
        tags: analysis.tags || [],
        sentiment: analysis.sentiment || 'neutral',
        publishedAt: article.publishedAt instanceof Date
          ? article.publishedAt.toISOString()
          : new Date().toISOString(),
        sourceUrl: siteUrl,        // ← homepage of the source site
        sourceName: siteName,
      });

      console.log(`    ✅ [${analysis.category}] ${article.title.substring(0, 60)}`);

      // Be polite - small delay between article reads
      await sleep(400);

    } catch (err) {
      console.log(`    ❌ Error reading article: ${err.message}`);
    }
  }

  console.log(`  🏁 [${siteName}] Done: ${processed.length} articles processed`);
  return processed;
}

module.exports = { scrapeNewsSource };