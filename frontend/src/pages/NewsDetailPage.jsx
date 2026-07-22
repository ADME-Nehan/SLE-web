import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getArticleById, getApiError } from "../utils/api";

function formatDate(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString();
  } catch {
    return "";
  }
}

function normalizeSources(article) {
  if (Array.isArray(article?.sources) && article.sources.length > 0) {
    return article.sources;
  }

  return [
    {
      sourceName: article?.sourceName || "RSS Source",
      articleUrl: article?.articleUrl || article?.url || "#",
      title: article?.title || article?.headline || "Untitled News",
      description:
        article?.summary ||
        article?.description ||
        article?.whyItMatters ||
        "Read the full story from the original source.",
      publishedAt: article?.publishedAt || article?.createdAt
    }
  ];
}

export default function NewsDetailPage() {
  const { id } = useParams();

  const [article, setArticle] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadArticle() {
    setLoading(true);
    setError("");

    try {
      const res = await getArticleById(id);
      const loadedArticle = res.data.article;

      setArticle(loadedArticle);
      setSources(normalizeSources(loadedArticle));
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadArticle();
  }, [id]);

  return (
    <div>
      <Navbar />

      <main className="news-detail-page">
        <Link to="/" className="back-link">
          ← Back to news
        </Link>

        {loading ? (
          <div className="card sle-empty-card">Loading article...</div>
        ) : error ? (
          <div className="card sle-empty-card error">{error}</div>
        ) : !article ? (
          <div className="card sle-empty-card">Article not found.</div>
        ) : (
          <>
            <section className="card news-detail-hero">
              <div className="detail-meta-row">
                {article.isTopNews ? (
                  <span className="top-news-badge">Top News</span>
                ) : null}

                <span className="source-badge">
                  {sources.length > 1 ? `${sources.length} Sources` : sources[0]?.sourceName}
                </span>

                <span>{formatDate(article.createdAt)}</span>
              </div>

              <h1>{article.title || article.headline || "Untitled News"}</h1>


            </section>

            <section className="source-comparison-section">
              <div className="sle-feed-header">
                <div>
                  <span>Source Comparison</span>
                  <h2>What each site says</h2>
                </div>
              </div>

              <div className="source-comparison-list">
                {sources.map((source, index) => (
                  <article className="card source-comparison-card" key={`${source.articleUrl}-${index}`}>
                    <div className="source-comparison-top">
                      <span className="source-badge">
                        {source.sourceName || `Source ${index + 1}`}
                      </span>

                      <small>{formatDate(source.publishedAt)}</small>
                    </div>

                    <h3>
                      {source.sourceName || `Source ${index + 1}`} says:
                    </h3>

                    <h2>{source.title || article.title}</h2>

                    <p>
                      {source.description ||
                        "No short description was provided by this RSS source. Open the original article to read more."}
                    </p>

                    <a
                      href={source.articleUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                    >
                      Read on {source.sourceName || `Source ${index + 1}`} →
                    </a>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}