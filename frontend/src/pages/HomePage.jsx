import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import LoadingScreen from "../components/LoadingScreen";
import { getNews, getApiError } from "../utils/api";

const CACHE_KEY = "sle_home_articles_cache_v2";
const FIRST_LOAD_LIMIT = 30;
const AUTO_REFRESH_MS = 180000;

const CATEGORY_TABS = [
  "Top News",
  "Business",
  "Economy",
  "Technology",
  "Finance",
  "Tourism",
  "Startups",
  "Policy"
];

function readCachedArticles() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");

    if (Array.isArray(cached.articles)) {
      return {
        articles: cached.articles,
        lastUpdated: cached.lastUpdated || ""
      };
    }

    return {
      articles: [],
      lastUpdated: ""
    };
  } catch {
    return {
      articles: [],
      lastUpdated: ""
    };
  }
}

function saveCachedArticles(articles) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        articles,
        lastUpdated: new Date().toLocaleTimeString()
      })
    );
  } catch {
    // ignore local storage errors
  }
}

function formatTime(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function getImageUrl(article) {
  if (article?.imageUrl) return article.imageUrl;

  if (Array.isArray(article?.sources)) {
    const sourceWithImage = article.sources.find((source) => source.imageUrl);
    return sourceWithImage?.imageUrl || "";
  }

  return "";
}

function getSummary(article) {
  return (
    article?.summary ||
    article?.description ||
    article?.whyItMatters ||
    "Read the latest update from Sri Lankan Entrepreneur."
  );
}

function getSourceName(article) {
  if ((article.sourceCount || article.sources?.length || 1) > 1) {
    return `${article.sourceCount || article.sources?.length} Sources`;
  }

  return article.sourceName || article.sources?.[0]?.sourceName || "RSS Source";
}

function getAuthorName(article) {
  return article.sourceName || article.sources?.[0]?.sourceName || "SLE News";
}

function SmallStoryCard({ article }) {
  const imageUrl = getImageUrl(article);

  return (
    <Link to={`/news/${article.id}`} className="mag-small-story">
      {imageUrl ? (
        <div className="mag-small-story-img-wrap">
          <img
            src={imageUrl}
            alt={article.title || "News image"}
            className="mag-small-story-img"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="mag-small-story-img-wrap mag-image-placeholder">
          SLE
        </div>
      )}

      <div className="mag-small-story-content">
        <h3>{article.title || article.headline || "Untitled News"}</h3>

        <div className="mag-story-meta">
          <span>{getSourceName(article)}</span>
          <span>{article.category || "Business"}</span>
          <span>{formatTime(article.publishedAt || article.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function CompactArticleCard({ article }) {
  const imageUrl = getImageUrl(article);

  return (
    <Link to={`/news/${article.id}`} className="mag-compact-card">
      {imageUrl ? (
        <div className="mag-compact-img-wrap">
          <img
            src={imageUrl}
            alt={article.title || "News image"}
            className="mag-compact-img"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
        </div>
      ) : null}

      <div className="mag-compact-body">
        <span className="mag-category-pill">{article.category || "Business"}</span>
        <h3>{article.title || article.headline || "Untitled News"}</h3>
       

        <div className="mag-story-meta">
          <span>{getSourceName(article)}</span>
          <span>{formatTime(article.publishedAt || article.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const cached = readCachedArticles();

  const [articles, setArticles] = useState(cached.articles);
  const [activeTab, setActiveTab] = useState("Top News");

  const [loading, setLoading] = useState(cached.articles.length === 0);
  const [pageLoader, setPageLoader] = useState(() => {
    const loaderSeen = sessionStorage.getItem("sle_loader_seen") === "true";
    const hasCache = cached.articles.length > 0;

    return !loaderSeen && !hasCache;
  });

  const [refreshing, setRefreshing] = useState(cached.articles.length > 0);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(cached.lastUpdated);

  const filteredArticles = useMemo(() => {
    if (activeTab === "Top News") {
      const topNews = articles.filter((article) => article.isTopNews);

      return topNews.length > 0 ? topNews : articles;
    }

    return articles.filter((article) => article.category === activeTab);
  }, [articles, activeTab]);

  const featuredArticle = filteredArticles[0] || articles[0] || null;
  const sideStories = filteredArticles.slice(1, 4);
  const latestGrid = filteredArticles.slice(4, 16);

  const trendingSources = useMemo(() => {
    const map = new Map();

    articles.forEach((article) => {
      const name = getAuthorName(article);

      map.set(name, (map.get(name) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({
        name,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [articles]);

  async function loadNews({ showMainLoading = false, signal } = {}) {
    if (showMainLoading && articles.length === 0) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const res = await getNews(
        {
          limit: FIRST_LOAD_LIMIT
        },
        {
          signal
        }
      );

      const list = res.data.articles || [];

      setArticles(list);

      const updatedTime = new Date().toLocaleTimeString();
      setLastUpdated(updatedTime);

      saveCachedArticles(list);
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
        return;
      }

      if (articles.length === 0) {
        setError(getApiError(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function startPage() {
      await loadNews({
        showMainLoading: true,
        signal: controller.signal
      });

      sessionStorage.setItem("sle_loader_seen", "true");
      setPageLoader(false);
    }

    startPage();

    const interval = setInterval(() => {
      loadNews({
        showMainLoading: false
      });
    }, AUTO_REFRESH_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (pageLoader) {
    return <LoadingScreen />;
  }

  return (
    <div className="mag-page">
      <Navbar />

      <main className="mag-main">
        <section className="mag-category-nav">
          {CATEGORY_TABS.map((category) => (
            <button
              key={category}
              type="button"
              className={`mag-category-tab ${
                activeTab === category ? "active" : ""
              }`}
              onClick={() => setActiveTab(category)}
            >
              {category}
            </button>
          ))}
        </section>

        {error ? (
          <div className="mag-error-card">{error}</div>
        ) : loading ? (
          <div className="card sle-empty-card">
            <div className="spinner"></div>
            <p>Loading news...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="mag-empty-card">
            No articles yet. Add RSS sources in admin and run fetch.
          </div>
        ) : (
          <>
            <section className="mag-head-layout">
              <article className="mag-featured-story">
                {featuredArticle ? (
                  <Link to={`/news/${featuredArticle.id}`}>
                    {getImageUrl(featuredArticle) ? (
                      <div className="mag-featured-image-wrap">
                        <img
                          src={getImageUrl(featuredArticle)}
                          alt={featuredArticle.title || "Featured news"}
                          className="mag-featured-image"
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.parentElement.style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="mag-featured-image-wrap mag-image-placeholder">
                        SLE
                      </div>
                    )}

                    <div className="mag-featured-meta">
                      <span>{getSourceName(featuredArticle)}</span>
                      <span>{featuredArticle.category || "Business"}</span>
                      <span>
                        {formatTime(
                          featuredArticle.publishedAt ||
                            featuredArticle.createdAt
                        )}
                      </span>
                    </div>

                    <h1>
                      {featuredArticle.title ||
                        featuredArticle.headline ||
                        "Untitled News"}
                    </h1>
                    <strong className="mag-read-more">read more</strong>
                  </Link>
                ) : null}
              </article>

              <aside className="mag-side-column">
                {sideStories.map((article) => (
                  <SmallStoryCard key={article.id} article={article} />
                ))}

                <div className="mag-trending-authors">
                  <h2>Trending sources</h2>

                  <div className="mag-author-list">
                    {trendingSources.map((source) => (
                      <div className="mag-author" key={source.name}>
                        <div className="mag-author-avatar">
                          {source.name.slice(0, 1).toUpperCase()}
                        </div>

                        <div>
                          <strong>{source.name}</strong>
                          <span>{source.count} articles</span>
                        </div>

                        <small>↗</small>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>

            <section className="mag-latest-section">
              <div className="mag-section-head">
                <div>
                  <span>Latest</span>
                  <h2>{activeTab} Updates</h2>
                </div>
              </div>

              <div className="mag-compact-grid">
                {latestGrid.map((article) => (
                  <CompactArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="mag-last-updated">
          Last updated: {lastUpdated || "-"}
        </div>
      </main>
    </div>
  );
}