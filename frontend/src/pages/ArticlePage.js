import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { getArticle } from "../utils/api";
import Navbar from "../components/Navbar";

function pillClass(cat) {
  const m = {
    Technology: "pill-tech",
    Politics: "pill-politics",
    Business: "pill-business",
    Sports: "pill-sports",
    Entertainment: "pill-entertainment",
    Science: "pill-science",
    Health: "pill-health",
    World: "pill-world",
    Finance: "pill-business",
    Economy: "pill-business",
    Tourism: "pill-world",
    Startups: "pill-tech",
    Investment: "pill-business",
    "Local News": "pill-default",
    International: "pill-world",
    "Latest News": "pill-default"
  };

  return m[cat] || "pill-default";
}

function getArticleData(response) {
  // Supports axios style: response.data.article
  if (response?.data?.article) return response.data.article;

  // Supports fetch/apiRequest style: response.article
  if (response?.article) return response.article;

  // Supports direct article return
  return response || null;
}

function normalizeSource(source) {
  const name =
    source?.name ||
    source?.sourceName ||
    source?.publisher ||
    source?.websiteName ||
    "Source";

  let url =
    source?.url ||
    source?.originalUrl ||
    source?.articleUrl ||
    source?.link ||
    source?.websiteUrl ||
    "";

  if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return {
    name,
    url,
    originalTitle: source?.originalTitle || source?.title || ""
  };
}

export default function ArticlePage() {
  const { id } = useParams();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadArticle() {
      try {
        const response = await getArticle(id);
        const articleData = getArticleData(response);

        if (mounted) {
          setArticle(articleData);
        }
      } catch (error) {
        console.error("Article load error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadArticle();

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navbar />

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 300
          }}
        >
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Navbar />

        <div style={{ textAlign: "center", padding: 80 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--text2)",
              marginBottom: 16
            }}
          >
            Article not found
          </div>

          <Link to="/" className="btn btn-primary">
            ← Back
          </Link>
        </div>
      </div>
    );
  }

  const title = article.title || article.headline || article.originalTitle || "Untitled News";
  const summary = article.summary || article.description || "No description available.";
  const category = article.category || "Latest News";
  const tags = Array.isArray(article.tags) ? article.tags : [];

  const sources = Array.isArray(article.sources)
    ? article.sources.map(normalizeSource).filter((source) => source.url)
    : [];

  const dateValue =
    article.publishedAt ||
    article.createdAt ||
    article.lastSeenAt ||
    article.updatedAt ||
    null;

  const timeAgo = (() => {
    try {
      if (!dateValue) return "";

      const date =
        typeof dateValue?.toDate === "function"
          ? dateValue.toDate()
          : new Date(dateValue);

      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  })();

  const dateStr = (() => {
    try {
      if (!dateValue) return "";

      const date =
        typeof dateValue?.toDate === "function"
          ? dateValue.toDate()
          : new Date(dateValue);

      return format(date, "MMMM d, yyyy · h:mm a");
    } catch {
      return "";
    }
  })();

  return (
    <div style={{ minHeight: "100vh" }}>
      <Navbar />

      <div className="container article-page-container">
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text2)",
            fontSize: 13,
            marginBottom: 24
          }}
        >
          ← Back to news
        </Link>

        <article className="fade-in">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap"
            }}
          >
            <span className={`pill ${pillClass(category)}`}>{category}</span>

            {sources.length > 1 && (
              <span className="multi-source">
                🔗 Covered by {sources.length} sources
              </span>
            )}
          </div>

          <h1
            style={{
              fontFamily: "var(--display)",
              fontSize: "clamp(22px,4vw,34px)",
              fontWeight: 800,
              lineHeight: 1.25,
              marginBottom: 14
            }}
          >
            {title}
          </h1>

          {(dateStr || timeAgo) && (
            <div
              style={{
                fontSize: 13,
                color: "var(--text2)",
                marginBottom: 24
              }}
            >
              {dateStr}
              {dateStr && timeAgo ? " · " : ""}
              {timeAgo}
            </div>
          )}

          <div
            style={{
              height: 1,
              background: "var(--border)",
              marginBottom: 24
            }}
          />

          <div
            style={{
              background: "rgba(136,197,64,0.06)",
              border: "1px solid rgba(136,197,64,0.2)",
              borderRadius: 10,
              padding: 22,
              marginBottom: 28
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em"
                }}
              >
                Description
              </span>
            </div>

            <p
              style={{
                lineHeight: 1.7,
                color: "var(--text)",
                fontSize: 15
              }}
            >
              {summary}
            </p>
          </div>

          {tags.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 10
                }}
              >
                Topics
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6
                }}
              >
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      padding: "4px 12px",
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      borderRadius: 20,
                      fontSize: 12,
                      color: "var(--text2)"
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 20
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--text2)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 14
              }}
            >
              {sources.length > 1
                ? ` ${sources.length} Sources Covering This Story`
                : " Source"}
            </div>

            {sources.length === 0 ? (
              <p style={{ color: "var(--text2)", fontSize: 13 }}>
                No source link available for this article.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                }}
              >
                {sources.map((source, index) => (
                  <a
                    key={`${source.url}-${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--text)",
                      transition: "border-color 0.2s",
                      textDecoration: "none"
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.borderColor = "var(--border)";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        background: `hsl(${index * 80},50%,25%)`,
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0
                      }}
                    >
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {source.name}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text2)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {source.url}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--accent)",
                        flexShrink: 0
                      }}
                    >
                      Read →
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}