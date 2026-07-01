import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import NewsCard from "../components/NewsCard";
import { getNews, getTrending } from "../utils/api";

const CATEGORIES = [
  "All",
  "Technology",
  "Politics",
  "Business",
  "Finance",
  "Economy",
  "Sports",
  "Entertainment",
  "Science",
  "Health",
  "World",
  "Local News",
  "International",
  "Tourism",
  "Startups"
];

function CategoryBar({ active, onChange }) {
  return (
    <div className="category-bar">
      <div className="category-bar-inner">
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;

          return (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className={`category-pill ${isActive ? 'active' : ''}`}
              style={{
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text2)'
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getArticlesFromResponse(res) {
  return res?.data?.articles || res?.articles || [];
}

function getPaginationFromResponse(res) {
  return res?.data?.pagination || res?.pagination || null;
}

function getTrendingFromResponse(res) {
  return res?.data?.trending || res?.trending || [];
}

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [trending, setTrending] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        page,
        limit: 20
      };

      if (category !== "All") {
        params.category = category;
      }

      if (search) {
        params.search = search;
      }

      const res = await getNews(params);

      setArticles(getArticlesFromResponse(res));
      setPagination(getPaginationFromResponse(res));
    } catch (err) {
      console.error("News load error:", err);
      setArticles([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [category, search, page]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    getTrending()
      .then((res) => {
        setTrending(getTrendingFromResponse(res));
      })
      .catch(() => {});
  }, []);

  const handleSearch = (q) => {
    setSearch(q);
    setPage(1);
  };

  const handleCategory = (cat) => {
    setCategory(cat);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar onSearch={handleSearch} />

      <CategoryBar active={category} onChange={handleCategory} />

      <main className="home-main">
        {search && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 22
            }}
          >
            <span style={{ fontSize: 14, color: "var(--text2)" }}>
              Results for{" "}
              <span style={{ color: "var(--accent)" }}>"{search}"</span>
            </span>

            <button className="btn btn-ghost btn-sm" onClick={clearSearch}>
              ✕ Clear
            </button>
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 240
            }}
          >
            <div className="spinner" />
          </div>
        ) : articles.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 80,
              color: "var(--text2)"
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, marginBottom: 6 }}>
              No articles found
            </div>
            <div style={{ fontSize: 13 }}>
              Add news sources in the admin panel to get started
            </div>
          </div>
        ) : (
          <div className="fade-in">
            {featured && !search && page === 1 && (
                      <div className="featured-layout">
                <NewsCard article={featured} featured />

                <aside
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text2)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      paddingBottom: 8,
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    Latest
                  </div>

                  {rest.slice(0, 4).map((article) => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </aside>
              </div>
            )}

            <div className="article-grid">
              {(search || page > 1 ? articles : rest.slice(4)).map(
                (article) => (
                  <NewsCard key={article.id} article={article} />
                )
              )}
            </div>

            {trending.length > 0 && (
              <section style={{ marginTop: 34 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 12,
                    textAlign: "center"
                  }}
                >
                  Trending
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    gap: 8
                  }}
                >
                  {trending.slice(0, 12).map(({ tag }) => (
                    <button
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text2)",
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {pagination && pagination.pages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 32,
                  paddingBottom: 32
                }}
              >
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{ opacity: page <= 1 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>

                <span style={{ fontSize: 13, color: "var(--text2)" }}>
                  Page {page} of {pagination.pages}
                </span>

                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ opacity: page >= pagination.pages ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "20px 0",
          textAlign: "center"
        }}
      >
        <img src="/logo.svg" alt="logo" style={{ height: 24, opacity: 0.5 }} />
      </footer>
    </div>
  );
}