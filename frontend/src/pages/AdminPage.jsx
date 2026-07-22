import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import SourceCard from "../components/SourceCard";
import {
  addSource,
  deleteSource,
  fetchOneSource,
  getApiError,
  getNews,
  getSources,
  runAllSources,
  updateArticlePriority,
  updateSource
} from "../utils/api";

const CATEGORIES = [
  "Business",
  "Startups",
  "SME",
  "Finance",
  "Economy",
  "Investment",
  "Technology",
  "Tourism",
  "Exports",
  "Agriculture",
  "Policy",
  "Local News"
];

export default function AdminPage() {
  const [tab, setTab] = useState("sources");
  const [sources, setSources] = useState([]);
  const [articles, setArticles] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [globalBusy, setGlobalBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    rssUrl: "",
    websiteUrl: "",
    category: "Business",
    active: true
  });

  async function loadSources() {
    try {
      const res = await getSources();
      setSources(res.data.sources || []);
    } catch (err) {
      setMessage(getApiError(err));
    }
  }

  async function loadArticles() {
    try {
      const res = await getNews({ limit: 80 });
      setArticles(res.data.articles || []);
    } catch (err) {
      setMessage(getApiError(err));
    }
  }

  async function loadAll() {
    await Promise.all([loadSources(), loadArticles()]);
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
    }, duplicates ${result.duplicateCount || 0}`;
  }

  function buildRunAllMessage(result) {
    return `Run complete: checked ${result.totalChecked || 0}, saved ${
      result.totalSaved || 0
    }, merged ${result.totalMerged || 0}, rejected ${
      result.totalRejected || 0
    }, duplicates ${result.totalDuplicates || 0}`;
  }

  async function handleAddSource(e) {
    e.preventDefault();
    setMessage("");
    setGlobalBusy(true);

    try {
      const addRes = await addSource(form);
      const newSource = addRes.data.source;

      setForm({
        name: "",
        rssUrl: "",
        websiteUrl: "",
        category: "Business",
        active: true
      });

      if (newSource?.id) {
        setMessage("RSS source added. Fetching news now...");

        const fetchRes = await fetchOneSource(newSource.id);
        const result = fetchRes.data.result;

        setMessage(buildFetchMessage("Source added and fetched", result));

        await loadAll();
        setTab("articles");
      } else {
        setMessage("RSS source added successfully.");
        await loadSources();
        setTab("sources");
      }
    } catch (err) {
      setMessage(getApiError(err));
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
      setMessage(getApiError(err));
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
      setMessage(getApiError(err));
    } finally {
      setGlobalBusy(false);
    }
  }

  async function handleToggleSource(source) {
    setBusyId(source.id);

    try {
      await updateSource(source.id, {
        active: source.active === false
      });

      await loadSources();
    } catch (err) {
      setMessage(getApiError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleDeleteSource(source) {
    const ok = window.confirm(`Delete ${source.name}?`);

    if (!ok) return;

    setBusyId(source.id);

    try {
      await deleteSource(source.id);
      setMessage("Source deleted.");
      await loadSources();
    } catch (err) {
      setMessage(getApiError(err));
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

    setBusyId(article.id);

    try {
      await updateArticlePriority(article.id, {
        isTopNews: true,
        priority
      });

      setMessage("Article marked as Top News.");
      await loadArticles();
    } catch (err) {
      setMessage(getApiError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleRemoveTopNews(article) {
    setBusyId(article.id);

    try {
      await updateArticlePriority(article.id, {
        isTopNews: false,
        priority: 0
      });

      setMessage("Article removed from Top News.");
      await loadArticles();
    } catch (err) {
      setMessage(getApiError(err));
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
              Manage RSS sources, fetch news, mark Top News, and view grouped
              saved articles.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRunAll}
            disabled={globalBusy}
          >
            {globalBusy ? "Running..." : "Run All RSS Sources"}
          </button>
        </section>

        {message ? <div className="message-box">{message}</div> : null}

        <div className="tabs">
          <button
            className={tabClass("sources")}
            onClick={() => setTab("sources")}
          >
            Sources
          </button>

          <button className={tabClass("add")} onClick={() => setTab("add")}>
            Add Source
          </button>

          <button
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

              <button className="btn btn-ghost" onClick={loadSources}>
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
              Add RSS feed URLs only. After adding, the system will fetch news
              automatically.
            </p>

            <form className="form-grid" onSubmit={handleAddSource}>
              <label>
                Source Name
                <input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Ada Derana"
                />
              </label>

              <label>
                RSS URL
                <input
                  required
                  value={form.rssUrl}
                  onChange={(e) => updateForm("rssUrl", e.target.value)}
                  placeholder="https://www.example.com/rss"
                />
              </label>

              <label>
                Website URL
                <input
                  value={form.websiteUrl}
                  onChange={(e) => updateForm("websiteUrl", e.target.value)}
                  placeholder="https://www.example.com"
                />
              </label>

              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={globalBusy}
              >
                {globalBusy ? "Adding and Fetching..." : "Add RSS Source"}
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

              <button className="btn btn-ghost" onClick={loadArticles}>
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
                          {getSourceCount(article)} Source(s)
                        </span>
                      </div>

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
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSetPriority(article)}
                        disabled={busyId === article.id}
                      >
                        Set Top News
                      </button>

                      <button
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