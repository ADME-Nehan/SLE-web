import { Link } from "react-router-dom";

function formatDate(value) {
  if (!value) return "";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return "";
  }
}

function getSummary(article) {
  return (
    article?.summary ||
    article?.description ||
    article?.whyItMatters ||
    "Read the latest update from Sri Lankan Entrepreneur."
  );
}

export default function NewsCard({ article }) {
  if (!article) return null;

  const date = formatDate(article.publishedAt || article.createdAt);
  const source = article.sourceName || "RSS Source";
  const sourceCount = article.sourceCount || article.sources?.length || 1;

  return (
    <Link to={`/news/${article.id}`} className="card sle-news-card">
      <div className="sle-news-card-top">
        {article.isTopNews ? <span className="top-news-mini">Top News</span> : null}
      </div>

      <h2>{article.title || article.headline || "Untitled News"}</h2>

      {/* <p>{getSummary(article)}</p> */}

      <div className="sle-news-card-bottom">
        <span className="source-badge">
          {sourceCount > 1 ? `${sourceCount} Sources` : source}
        </span>
        {date ? <small>{date}</small> : null}
        <strong>Open →</strong>
      </div>
    </Link>
  );
}