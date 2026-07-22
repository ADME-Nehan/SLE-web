import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import NewsCard from "../components/NewsCard";
import LoadingScreen from "../components/LoadingScreen";
import { getNews, getApiError } from "../utils/api";

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [featuredArticle, setFeaturedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageLoader, setPageLoader] = useState(() => {
    return sessionStorage.getItem("sle_loader_seen") !== "true";
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  async function loadNews(showMainLoading = false) {
    if (showMainLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const res = await getNews({ limit: 60 });
      const list = res.data.articles || [];

      setArticles(list);
      setFeaturedArticle(list[0] || null);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    async function startPage() {
      const alreadySeen = sessionStorage.getItem("sle_loader_seen") === "true";

      await loadNews(true);

      if (alreadySeen) {
        setPageLoader(false);
        return;
      }

      setTimeout(() => {
        sessionStorage.setItem("sle_loader_seen", "true");
        setPageLoader(false);
      }, 1200);
    }

    startPage();

    const interval = setInterval(() => {
      loadNews(false);
    }, 60000);

    return () => clearInterval(interval);
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
            onClick={() => loadNews(false)}
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