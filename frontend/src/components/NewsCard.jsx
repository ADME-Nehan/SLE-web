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

  const url = article.articleUrl || article.url || "#";
  const date = formatDate(article.publishedAt || article.createdAt);
  const category = article.category || "Business";
  const source = article.sourceName || "RSS Source";

  return (
    <a href={url} target="_blank" rel="noreferrer" className="news-card">
      <div className="news-card-top">
        <span className="news-category">{category}</span>
        {date ? <span className="news-date">{date}</span> : null}
      </div>

      <h2>{article.title || article.headline || "Untitled News"}</h2>

      <p>{getSummary(article)}</p>

      {article.whyItMatters ? (
        <div className="why-box">
          <span>Why it matters</span>
          <p>{article.whyItMatters}</p>
        </div>
      ) : null}

      <div className="news-card-bottom">
        <span>{source}</span>
        <strong>Read →</strong>
      </div>
    </a>
  );
}