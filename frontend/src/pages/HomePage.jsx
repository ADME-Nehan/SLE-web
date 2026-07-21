import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import CategoryBar from "../components/CategoryBar";
import NewsCard from "../components/NewsCard";
import { getCategories, getNews, getApiError } from "../utils/api";

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNews(category = activeCategory) {
    setLoading(true);
    setError("");

    try {
      const res = await getNews({
        category,
        limit: 60
      });

      setArticles(res.data.articles || []);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await getCategories();
      setCategories(res.data.categories || ["All"]);
    } catch {
      setCategories(["All"]);
    }
  }

  useEffect(() => {
    loadCategories();
    loadNews("All");
  }, []);

  function handleCategoryChange(category) {
    setActiveCategory(category);
    loadNews(category);
  }

  return (
    <div>
      <Navbar />

      <main>
        <section className="hero">
          <div className="hero-kicker">RSS News Aggregator</div>
          <h1>News that matters for Sri Lankan entrepreneurs.</h1>
          <p>
            SLE collects RSS news, filters entrepreneur-related updates, and
            shows useful business news in one place.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => loadNews()}>
              Refresh News
            </button>
          </div>
        </section>

        <CategoryBar
          active={activeCategory}
          categories={categories}
          onChange={handleCategoryChange}
        />

        <section className="container section">
          <div className="section-header">
            <div>
              <h2>Latest News</h2>
              <p>{activeCategory} category</p>
            </div>

            <span className="count-badge">{articles.length} articles</span>
          </div>

          {loading ? (
            <div className="state-box">Loading news...</div>
          ) : error ? (
            <div className="state-box error">{error}</div>
          ) : articles.length === 0 ? (
            <div className="state-box">
              No articles yet. Add RSS sources in admin and run fetch.
            </div>
          ) : (
            <div className="news-grid">
              {articles.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}