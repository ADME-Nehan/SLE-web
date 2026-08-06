function formatDate(value) {
  if (!value) return "Not checked yet";

  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not checked yet" : date.toLocaleString();
  } catch {
    return "Not checked yet";
  }
}

function getStatus(source) {
  if (source.sourceStatus) return source.sourceStatus;
  if (source.active === false) return "disabled";

  return "unvalidated";
}

function getStatusLabel(status) {
  const labels = {
    active: "Active",
    invalid_html: "Invalid HTML",
    timeout: "Timeout",
    blocked: "Blocked",
    failed: "Failed",
    disabled: "Disabled",
    unvalidated: "Needs validation"
  };

  return labels[status] || "Needs validation";
}

export default function SourceCard({
  source,
  onFetch,
  onToggle,
  onDelete,
  busy
}) {
  const status = getStatus(source);
  const canFetch = source.active === true && status === "active";

  return (
    <div className="source-card">
      <div className="source-main">
        <div className="source-header">
          <h3>{source.name || "RSS Source"}</h3>
          <span className={`source-status-badge status-${status}`}>
            {getStatusLabel(status)}
          </span>
        </div>

        <p className="source-url">{source.rssUrl || source.url}</p>

        <div className="source-meta">
          <span>Category: {source.category || "Business"}</span>
          <span>Last fetch: {formatDate(source.lastFetchedAt)}</span>
          <span>Last checked: {formatDate(source.lastCheckedAt)}</span>
          <span>Result: {source.lastStatus || "not_started"}</span>
        </div>

        <div className="source-stats">
          <span>Checked: {source.lastItemCount || 0}</span>
          <span>Accepted: {source.lastAcceptedCount || 0}</span>
          <span>Saved: {source.lastSavedCount || 0}</span>
          <span>Rejected: {source.lastRejectedCount || 0}</span>
          <span>Duplicates: {source.lastDuplicateCount || 0}</span>
          <span>Failures: {source.failureCount || 0}/3</span>
        </div>

        {source.lastError ? (
          <div className="source-error">
            <strong>Last error</strong>
            <span>{source.lastError}</span>
          </div>
        ) : null}
      </div>

      <div className="source-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={onFetch}
          disabled={busy || !canFetch}
          title={!canFetch ? "Validate and enable this source before fetching" : ""}
        >
          {busy ? "Fetching..." : "Fetch"}
        </button>

        <button className="btn btn-ghost btn-sm" onClick={onToggle} disabled={busy}>
          {canFetch ? "Disable" : "Validate & Enable"}
        </button>

        <button className="btn btn-danger btn-sm" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}
