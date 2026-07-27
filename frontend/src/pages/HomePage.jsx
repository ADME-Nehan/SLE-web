import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import NewsCard from "../components/NewsCard";
import LoadingScreen from "../components/LoadingScreen";
import { getNews, getApiError } from "../utils/api";

const CACHE_KEY = "sle_home_articles_cache_v1";
const FIRST_LOAD_LIMIT = 24;
const AUTO_REFRESH_MS = 180000;

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
    // Ignore cache storage errors
  }
}

export default function HomePage() {
  const cached = readCachedArticles();

  const [articles, setArticles] = useState(cached.articles);
  const [featuredArticle, setFeaturedArticle] = useState(
    cached.articles[0] || null
  );

  const [loading, setLoading] = useState(cached.articles.length === 0);
  const [pageLoader, setPageLoader] = useState(() => {
    const loaderSeen = sessionStorage.getItem("sle_loader_seen") === "true";
    const hasCache = cached.articles.length > 0;

    return !loaderSeen && !hasCache;
  });

  const [refreshing, setRefreshing] = useState(cached.articles.length > 0);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(cached.lastUpdated);

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
      setFeaturedArticle(list[0] || null);

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
    <div>
      <Navbar />

      <main className="home-main">
        {featuredArticle ? (
          <section className="featured-layout fade-in">
            <a
              href={`/news/${featuredArticle.id}`}
              className="card sle-featured-card"
            >
              {featuredArticle.imageUrl ? (
                <div className="sle-featured-image-wrap">
                  <img
                    src={featuredArticle.imageUrl}
                    alt={featuredArticle.title || "Featured news"}
                    className="sle-featured-image"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.parentElement.style.display = "none";
                    }}
                  />
                </div>
              ) : null}

              <div className="source-badge">
                {(featuredArticle.sourceCount ||
                  featuredArticle.sources?.length ||
                  1) > 1
                  ? `${
                      featuredArticle.sourceCount ||
                      featuredArticle.sources?.length
                    } Sources`
                  : featuredArticle.sourceName || "RSS Source"}
              </div>

              <h1>
                {featuredArticle.title ||
                  featuredArticle.headline ||
                  "Untitled News"}
              </h1>

              <p>
                {featuredArticle.summary ||
                  featuredArticle.description ||
                  featuredArticle.whyItMatters ||
                  "Read the latest update."}
              </p>

              <span className="sle-featured-read">Open story →</span>
            </a>

          </section>
        ) : null}

        <section className="sle-feed-header">
          <div>
            <span>Latest</span>
            <h2>News Feed</h2>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadNews({ showMainLoading: false })}
            disabled={refreshing}
          >
            {refreshing ? "Updating..." : "Update"}
          </button>
        </section>

        {loading ? (
          <div className="card sle-empty-card">
            <div className="spinner"></div>
            <p>Loading news...</p>
          </div>
        ) : error ? (
          <div className="card sle-empty-card error">{error}</div>
        ) : articles.length === 0 ? (
          <div className="card sle-empty-card">
            No articles yet. Add RSS sources in admin and run fetch.
          </div>
        ) : (
          <div className="article-grid">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}