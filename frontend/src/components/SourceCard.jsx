function formatDate(value) {
  if (!value) return "Not fetched yet";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not fetched yet";

    return date.toLocaleString();
  } catch {
    return "Not fetched yet";
  }
}

export default function SourceCard({
  source,
  onFetch,
  onToggle,
  onDelete,
  busy
}) {
  return (
    <div className="source-card">
      <div className="source-main">
        <div className="source-header">
          <h3>{source.name || "RSS Source"}</h3>
          <span className={source.active === false ? "badge muted" : "badge"}>
            {source.active === false ? "Paused" : "Active"}
          </span>
        </div>

        <p className="source-url">{source.rssUrl || source.url}</p>

        <div className="source-meta">
          <span>Category: {source.category || "Business"}</span>
          <span>Last fetch: {formatDate(source.lastFetchedAt)}</span>
          <span>Status: {source.lastStatus || "not_started"}</span>
        </div>

        <div className="source-stats">
          <span>Checked: {source.lastItemCount || 0}</span>
          <span>Accepted: {source.lastAcceptedCount || 0}</span>
          <span>Saved: {source.lastSavedCount || 0}</span>
          <span>Rejected: {source.lastRejectedCount || 0}</span>
          <span>Duplicates: {source.lastDuplicateCount || 0}</span>
        </div>

        {source.lastError ? (
          <div className="source-error">{source.lastError}</div>
        ) : null}
      </div>

      <div className="source-actions">
        <button className="btn btn-primary btn-sm" onClick={onFetch} disabled={busy}>
          {busy ? "Fetching..." : "Fetch"}
        </button>

        <button className="btn btn-ghost btn-sm" onClick={onToggle} disabled={busy}>
          {source.active === false ? "Resume" : "Pause"}
        </button>

        <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}