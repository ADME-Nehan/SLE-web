import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import NewsCard from "../components/NewsCard";
import { getNews, getApiError } from "../utils/api";

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNews() {
    setLoading(true);
    setError("");

    try {
      const res = await getNews({
        limit: 60
      });

      setArticles(res.data.articles || []);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNews();
  }, []);

  return (
    <div>
      <Navbar />

      <main>
        <section className="container section">
          <div className="section-header">
            <div>
              <h2>Latest News</h2>
              <p>Filtered RSS updates</p>
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