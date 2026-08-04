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

function getImageUrl(article) {
  if (article?.imageUrl) return article.imageUrl;

  if (Array.isArray(article?.sources)) {
    const sourceWithImage = article.sources.find((source) => source.imageUrl);
    return sourceWithImage?.imageUrl || "";
  }

  return "";
}

export default function NewsCard({ article }) {
  if (!article) return null;

  const date = formatDate(article.publishedAt || article.createdAt);
  const source = article.sourceName || "RSS Source";
  const sourceCount = article.sourceCount || article.sources?.length || 1;
  const imageUrl = getImageUrl(article);

  return (
    <Link to={`/news/${article.id}`} className="card sle-news-card">
      {imageUrl ? (
        <div className="sle-news-image-wrap">
          <img
            src={imageUrl}
            alt={article.title || "News image"}
            className="sle-news-image"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.parentElement.style.display = "none";
            }}
          />
        </div>
      ) : null}

      <div className="sle-news-card-top">
        

        {article.isTopNews ? (
          <span className="top-news-mini">Top News</span>
        ) : null}

        {date ? <small>{date}</small> : null}
      </div>

      <h2>{article.title || article.headline || "Untitled News"}</h2>

      

      <div className="sle-news-card-bottom">
        <span className="source-badge">
          {sourceCount > 1 ? `${sourceCount} Sources` : source}
        </span>
        <strong>Open →</strong>
      </div>
    </Link>
  );
}
