import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import SourceCard from "../components/SourceCard";
import {
  addSource,
  deleteSource,
  discoverRssFeeds,
  fetchOneSource,
  getApiError,
  getDashboardStats,
  getNews,
  getSources,
  runAllSources,
  updateArticlePriority,
  updateSource
} from "../utils/api";
import { removeAdminToken } from "../utils/auth";

export default function AdminPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("sources");
  const [sources, setSources] = useState([]);
  const [articles, setArticles] = useState([]);
  const [stats, setStats] = useState(null);

  const [busyId, setBusyId] = useState("");
  const [globalBusy, setGlobalBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryCandidates, setDiscoveryCandidates] = useState([]);
  const [discoveredWebsiteUrl, setDiscoveredWebsiteUrl] = useState("");

  const [form, setForm] = useState({
    name: "",
    rssUrl: "",
    websiteUrl: "",
    active: true
  });

  function handleAuthError(err) {
    const status = err?.response?.status;

    if (status === 401 || status === 403) {
      removeAdminToken();
      navigate("/login", {
        replace: true
      });
      return true;
    }

    return false;
  }

  async function loadSources() {
    try {
      const res = await getSources();
      setSources(res.data.sources || []);
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    }
  }

  async function loadArticles() {
    try {
      const res = await getNews({ limit: 80 });
      setArticles(res.data.articles || []);
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    }
  }

  async function loadStats() {
    try {
      const res = await getDashboardStats();
      setStats(res.data.stats || null);
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    }
  }

  async function loadAll() {
    await Promise.all([loadSources(), loadArticles(), loadStats()]);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function updateForm(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleDiscoverFeeds() {
    const websiteUrl = form.websiteUrl.trim();

    if (!websiteUrl) {
      setMessage("Website URL is required");
      return;
    }

    setMessage("");
    setDiscoveryCandidates([]);
    setDiscoveryLoading(true);

    const controller = new AbortController();
    const discoveryTimer = window.setTimeout(() => {
      controller.abort();
    }, 12000);

    try {
      const res = await discoverRssFeeds(
        { websiteUrl },
        { signal: controller.signal }
      );
      const result = res.data.result || {};
      const candidates = result.candidates || [];

      setDiscoveryCandidates(candidates);
      setDiscoveredWebsiteUrl(result.websiteUrl || websiteUrl);
      setMessage(
        result.message ||
          `${candidates.length} valid RSS/Atom feed${
            candidates.length === 1 ? "" : "s"
          } found.`
      );
    } catch (err) {
      if (err?.code === "ERR_CANCELED") {
        setMessage(
          "No valid RSS/Atom feeds found. You can paste the RSS URL manually."
        );
      } else if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      window.clearTimeout(discoveryTimer);
      setDiscoveryLoading(false);
    }
  }

  function handleUseDiscoveredFeed(candidate) {
    setForm((prev) => ({
      ...prev,
      rssUrl: candidate.url,
      websiteUrl: discoveredWebsiteUrl || prev.websiteUrl
    }));
    setMessage("RSS feed selected. Now click Add Source and Fetch.");
  }

  function handleLogout() {
    removeAdminToken();

    navigate("/login", {
      replace: true
    });
  }

  function getSourceCount(article) {
    return article.sourceCount || article.sources?.length || 1;
  }

  function getSourceNames(article) {
    if (Array.isArray(article.sources) && article.sources.length > 0) {
      return article.sources
        .map((source) => source.sourceName || "RSS Source")
        .filter(Boolean)
        .join(", ");
    }

    return article.sourceName || "RSS Source";
  }

  function buildFetchMessage(prefix, result) {
    return `${prefix}: checked ${result.checkedItems || 0}, saved ${
      result.savedCount || 0
    }, merged ${result.mergedCount || 0}, rejected ${
      result.rejectedCount || 0
    }, duplicates ${result.duplicateCount || 0}, AI calls ${
      result.openAiCalls || 0
    }`;
  }

  function buildRunAllMessage(result) {
    return `Run complete: checked ${result.totalChecked || 0}, saved ${
      result.totalSaved || 0
    }, merged ${result.totalMerged || 0}, rejected ${
      result.totalRejected || 0
    }, duplicates ${result.totalDuplicates || 0}, AI calls ${
      result.totalOpenAiCalls || 0
    }`;
  }

  async function handleAddSource(e) {
    e.preventDefault();

    setMessage("");
    setGlobalBusy(true);

    try {
      const addRes = await addSource({
        ...form,
        category: "Auto",
        autoCategory: true
      });

      const newSource = addRes.data.source;

      setForm({
        name: "",
        rssUrl: "",
        websiteUrl: "",
        active: true
      });
      setDiscoveryCandidates([]);
      setDiscoveredWebsiteUrl("");

      if (newSource?.id) {
        setMessage("RSS source added. Backend is checking articles now...");

        const fetchRes = await fetchOneSource(newSource.id);
        const result = fetchRes.data.result;

        setMessage(buildFetchMessage("Source added and fetched", result));

        await loadAll();
        setTab("articles");
      } else {
        setMessage("RSS source added successfully.");

        await loadAll();
        setTab("sources");
      }
    } catch (err) {
      if (!handleAuthError(err)) {
        const errorMessage = getApiError(err);
        setMessage(
          err?.response?.status === 422
            ? `Invalid RSS: ${errorMessage}`
            : errorMessage
        );
      }
    } finally {
      setGlobalBusy(false);
    }
  }

  async function handleFetchSource(source) {
    setMessage("");
    setBusyId(source.id);

    try {
      const res = await fetchOneSource(source.id);
      const result = res.data.result;

      setMessage(buildFetchMessage(`Fetched ${result.sourceName}`, result));

      await loadAll();
      setTab("articles");
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      setBusyId("");
    }
  }

  async function handleRunAll() {
    setMessage("");
    setGlobalBusy(true);

    try {
      const res = await runAllSources();
      const result = res.data.result;

      setMessage(buildRunAllMessage(result));

      await loadAll();
      setTab("articles");
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      setGlobalBusy(false);
    }
  }

  async function handleToggleSource(source) {
    setMessage("");
    setBusyId(source.id);

    try {
      const shouldEnable =
        source.active !== true || source.sourceStatus !== "active";

      await updateSource(source.id, {
        active: shouldEnable
      });

      setMessage(
        shouldEnable
          ? "RSS source validated and enabled."
          : "RSS source disabled."
      );

      await loadAll();
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      setBusyId("");
    }
  }

  async function handleDeleteSource(source) {
    const ok = window.confirm(`Delete ${source.name}?`);

    if (!ok) return;

    setMessage("");
    setBusyId(source.id);

    try {
      await deleteSource(source.id);

      setMessage("Source deleted.");

      await loadAll();
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      setBusyId("");
    }
  }

  async function handleSetPriority(article) {
    const value = window.prompt(
      "Enter Top News priority number. Higher number shows first.",
      article.priority || 1
    );

    if (value === null) return;

    const priority = Number(value);

    if (!Number.isFinite(priority)) {
      setMessage("Invalid priority number.");
      return;
    }

    setMessage("");
    setBusyId(article.id);

    try {
      await updateArticlePriority(article.id, {
        isTopNews: true,
        priority
      });

      setMessage("Article marked as Top News.");

      await loadAll();
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      setBusyId("");
    }
  }

  async function handleRemoveTopNews(article) {
    setMessage("");
    setBusyId(article.id);

    try {
      await updateArticlePriority(article.id, {
        isTopNews: false,
        priority: 0
      });

      setMessage("Article removed from Top News.");

      await loadAll();
    } catch (err) {
      if (!handleAuthError(err)) {
        setMessage(getApiError(err));
      }
    } finally {
      setBusyId("");
    }
  }

  const tabClass = (name) => `tab-btn ${tab === name ? "active" : ""}`;

  return (
    <div>
      <Navbar />

      <main className="container admin-page">
        <section className="admin-hero">
          <div>
            <div className="hero-kicker">Admin Panel</div>
            <h1>SLE RSS Control Center</h1>
            <p>
              Add RSS sources only. Backend will filter needed articles,
              auto-detect category, prevent duplicates, group same stories, and
              use OpenAI with limited token usage.
            </p>
          </div>

          <div className="admin-hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunAll}
              disabled={globalBusy}
            >
              {globalBusy ? "Running..." : "Run All RSS Sources"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </section>

        {message ? <div className="message-box">{message}</div> : null}

        {stats ? (
          <section className="admin-stats-grid">
            <div className="card admin-stat-card">
              <span>Total Sources</span>
              <strong>{stats.totalSources || 0}</strong>
            </div>

            <div className="card admin-stat-card">
              <span>Active Sources</span>
              <strong>{stats.activeSources || 0}</strong>
            </div>

            <div className="card admin-stat-card">
              <span>Saved Articles</span>
              <strong>{stats.totalArticles || 0}</strong>
            </div>

            <div className="card admin-stat-card">
              <span>Top News</span>
              <strong>{stats.topNewsCount || 0}</strong>
            </div>

            <div className="card admin-stat-card">
              <span>Failed Sources</span>
              <strong>{stats.failedSources || 0}</strong>
            </div>

            <div className="card admin-stat-card">
              <span>Last AI Calls</span>
              <strong>{stats.lastOpenAiCalls || 0}</strong>
            </div>
          </section>
        ) : null}

        <div className="tabs">
          <button
            type="button"
            className={tabClass("sources")}
            onClick={() => setTab("sources")}
          >
            Sources
          </button>

          <button
            type="button"
            className={tabClass("add")}
            onClick={() => setTab("add")}
          >
            Add Source
          </button>

          <button
            type="button"
            className={tabClass("articles")}
            onClick={() => setTab("articles")}
          >
            Saved Articles
          </button>
        </div>

        {tab === "sources" ? (
          <section className="section">
            <div className="section-header">
              <div>
                <h2>RSS Sources</h2>
                <p>{sources.length} source(s)</p>
              </div>

              <button type="button" className="btn btn-ghost" onClick={loadAll}>
                Refresh
              </button>
            </div>

            {sources.length === 0 ? (
              <div className="state-box">No RSS sources added yet.</div>
            ) : (
              <div className="source-list">
                {sources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    busy={busyId === source.id}
                    onFetch={() => handleFetchSource(source)}
                    onToggle={() => handleToggleSource(source)}
                    onDelete={() => handleDeleteSource(source)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {tab === "add" ? (
          <section className="panel">
            <h2>Add RSS Source</h2>
            <p className="muted">
              Discover feeds from a news website or paste a feed URL manually.
              Article categories are detected automatically by the backend.
            </p>

            <form className="form-grid" onSubmit={handleAddSource}>
              <div className="rss-discovery-box">
                <div className="rss-discovery-heading">
                  <div>
                    <span>Option A</span>
                    <h3>Discover from Website URL</h3>
                    <p>
                      Enter a normal news website. The backend will locate and
                      validate its available RSS or Atom feeds.
                    </p>
                  </div>
                </div>

                <label>
                  Website URL
                  <div className="rss-discovery-controls">
                    <input
                      value={form.websiteUrl}
                      onChange={(e) => {
                        updateForm("websiteUrl", e.target.value);
                        setDiscoveryCandidates([]);
                      }}
                      placeholder="https://www.bbc.com/news/business"
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleDiscoverFeeds}
                      disabled={discoveryLoading || globalBusy}
                    >
                      {discoveryLoading
                        ? "Discovering feeds..."
                        : "Discover RSS Feeds"}
                    </button>
                  </div>
                </label>

                {discoveryCandidates.length > 0 ? (
                  <div className="rss-candidate-list">
                    {discoveryCandidates.map((candidate) => (
                      <article className="rss-candidate-card" key={candidate.url}>
                        <div className="rss-candidate-content">
                          <strong>{candidate.title || "RSS Feed"}</strong>
                          <span className="rss-candidate-url">
                            {candidate.url}
                          </span>
                          <div className="rss-candidate-meta">
                            <span>{candidate.type}</span>
                            <span>
                              {candidate.source === "html_link"
                                ? "Found in website HTML"
                                : "Found at common feed path"}
                            </span>
                            <span>Validated</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleUseDiscoveredFeed(candidate)}
                        >
                          Use This Feed
                        </button>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rss-form-divider">
                <span>Option B · Manual RSS URL</span>
              </div>

              <label>
                Source Name
                <input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="BBC Business"
                />
              </label>

              <label>
                RSS URL
                <input
                  required
                  value={form.rssUrl}
                  onChange={(e) => updateForm("rssUrl", e.target.value)}
                  placeholder="https://feeds.bbci.co.uk/news/business/rss.xml"
                />
                <small className="rss-url-help">
                  Use a direct RSS XML feed URL, not a normal website page URL.
                </small>
              </label>

              <div className="auto-category-box">
                <span>Auto Category</span>
                <strong>Enabled</strong>
                <p>
                  Backend will choose Business, Finance, Economy, Technology,
                  Tourism, Policy, Agriculture, Exports, SME, Startups, or Local
                  News.
                </p>
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={globalBusy}
              >
                {globalBusy ? "Checking RSS Data..." : "Add Source and Fetch"}
              </button>
            </form>
          </section>
        ) : null}

        {tab === "articles" ? (
          <section className="section">
            <div className="section-header">
              <div>
                <h2>Saved Articles</h2>
                <p>{articles.length} latest saved article(s)</p>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={loadAll}
              >
                Refresh
              </button>
            </div>

            {articles.length === 0 ? (
              <div className="state-box">No saved articles yet.</div>
            ) : (
              <div className="admin-article-list">
                {articles.map((article) => (
                  <div className="card admin-article-card" key={article.id}>
                    <div>
                      <div className="admin-article-meta">
                        {article.isTopNews ? (
                          <span className="top-news-badge">
                            Top News • Priority {article.priority || 0}
                          </span>
                        ) : (
                          <span className="source-badge">Normal</span>
                        )}

                        <span className="source-badge">
                          {article.category || "Auto"}
                        </span>

                        <span className="source-badge">
                          {getSourceCount(article)} Source(s)
                        </span>

                        {article.aiAnalyzed ? (
                          <span className="source-badge">
                            AI {article.aiConfidence || 0}
                          </span>
                        ) : null}
                      </div>

                      {article.imageUrl ? (
                        <div className="admin-article-image-wrap">
                          <img
                            src={article.imageUrl}
                            alt={article.title || "Article image"}
                            className="admin-article-image"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.parentElement.style.display =
                                "none";
                            }}
                          />
                        </div>
                      ) : null}

                      <h3>{article.title || article.headline}</h3>

                      <p>
                        {article.summary ||
                          article.description ||
                          article.whyItMatters ||
                          "No description"}
                      </p>

                      <p className="admin-source-names">
                        Sources: {getSourceNames(article)}
                      </p>
                    </div>

                    <div className="admin-article-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSetPriority(article)}
                        disabled={busyId === article.id}
                      >
                        Set Top News
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveTopNews(article)}
                        disabled={busyId === article.id}
                      >
                        Remove Top
                      </button>

                      <a
                        className="btn btn-ghost btn-sm"
                        href={`/news/${article.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
