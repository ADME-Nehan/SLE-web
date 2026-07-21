import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import SourceCard from "../components/SourceCard";
import NewsCard from "../components/NewsCard";
import {
  addSource,
  deleteSource,
  fetchOneSource,
  getApiError,
  getNews,
  getSources,
  runAllSources,
  testRssFilter,
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

  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState(null);

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
      const res = await getNews({ limit: 20 });
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

  async function handleAddSource(e) {
    e.preventDefault();
    setMessage("");
    setGlobalBusy(true);

    try {
      await addSource(form);

      setForm({
        name: "",
        rssUrl: "",
        websiteUrl: "",
        category: "Business",
        active: true
      });

      setMessage("RSS source added successfully.");
      await loadSources();
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

      setMessage(
        `Fetched ${result.sourceName}: checked ${result.checkedItems}, saved ${result.savedCount}, rejected ${result.rejectedCount}, duplicates ${result.duplicateCount}`
      );

      await loadAll();
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

      setMessage(
        `Run complete: checked ${result.totalChecked}, saved ${result.totalSaved}, rejected ${result.totalRejected}, duplicates ${result.totalDuplicates}`
      );

      await loadAll();
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

  async function handleTestRss(e) {
    e.preventDefault();
    setMessage("");
    setTestResult(null);
    setGlobalBusy(true);

    try {
      const res = await testRssFilter(testUrl);
      setTestResult(res.data.result);
      setMessage("RSS test completed.");
    } catch (err) {
      setMessage(getApiError(err));
    } finally {
      setGlobalBusy(false);
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
              Manage RSS sources, test keyword filtering, fetch news, and view
              saved articles.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleRunAll} disabled={globalBusy}>
            {globalBusy ? "Running..." : "Run All RSS Sources"}
          </button>
        </section>

        {message ? <div className="message-box">{message}</div> : null}

        <div className="tabs">
          <button className={tabClass("sources")} onClick={() => setTab("sources")}>
            Sources
          </button>
          <button className={tabClass("add")} onClick={() => setTab("add")}>
            Add Source
          </button>
          <button className={tabClass("test")} onClick={() => setTab("test")}>
            Test RSS
          </button>
          <button className={tabClass("articles")} onClick={() => setTab("articles")}>
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
              Add RSS feed URLs only. Example: https://example.com/rss
            </p>

            <form className="form-grid" onSubmit={handleAddSource}>
              <label>
                Source Name
                <input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Daily FT"
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

              <button className="btn btn-primary" type="submit" disabled={globalBusy}>
                {globalBusy ? "Adding..." : "Add RSS Source"}
              </button>
            </form>
          </section>
        ) : null}

        {tab === "test" ? (
          <section className="panel">
            <h2>Test RSS Filter</h2>
            <p className="muted">
              This only reads and filters. It does not save to Firebase.
            </p>

            <form className="rss-test-form" onSubmit={handleTestRss}>
              <input
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Paste RSS feed URL"
                required
              />

              <button className="btn btn-primary" disabled={globalBusy}>
                {globalBusy ? "Testing..." : "Test Filter"}
              </button>
            </form>

            {testResult ? (
              <div className="test-result">
                <div className="result-grid">
                  <div>
                    <strong>{testResult.feedTitle}</strong>
                    <span>Feed title</span>
                  </div>
                  <div>
                    <strong>{testResult.checkedItems}</strong>
                    <span>Checked</span>
                  </div>
                  <div>
                    <strong>{testResult.acceptedCount}</strong>
                    <span>Accepted</span>
                  </div>
                  <div>
                    <strong>{testResult.rejectedCount}</strong>
                    <span>Rejected</span>
                  </div>
                </div>

                <h3>Accepted Items</h3>

                {testResult.acceptedItems?.length ? (
                  <div className="mini-list">
                    {testResult.acceptedItems.map((item) => (
                      <div key={item.articleUrl} className="mini-item">
                        <strong>{item.title}</strong>
                        <span>
                          {item.category} • Score {item.keywordScore}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No accepted items.</p>
                )}
              </div>
            ) : null}
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
              <div className="news-grid">
                {articles.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}