import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  getSources,
  addSource,
  updateSource,
  deleteSource,
  getStats,
  triggerPipeline,
  deleteAllArticles,
  verifyAdmin,
  generateSocialPostPreview,
  saveSocialPost,
  getSocialPosts,
  removeSocialPost
} from "../utils/api";

function getErrorMessage(err) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong"
  );
}

function getData(res) {
  return res?.data || res || {};
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return <div className={`toast toast-${type}`}>{msg}</div>;
}

function PasswordGate({ onSuccess }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await verifyAdmin(pw);
      sessionStorage.setItem("adminKey", pw);
      onSuccess();
    } catch {
      setError("Wrong password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="/logo.svg"
            alt="logo"
            style={{ height: 28, marginBottom: 16 }}
          />

          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: 22,
              marginBottom: 6
            }}
          >
            Admin Access
          </h2>

          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            Enter your admin password to continue
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="form-group">
            <label className="form-label">Password</label>

            <input
              className="form-input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
              placeholder="Enter admin password"
            />
          </div>

          {error && (
            <div
              style={{
                padding: "9px 12px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 7,
                fontSize: 13,
                color: "#f87171"
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "10px 0"
            }}
          >
            {loading ? "Verifying…" : "Enter Admin Panel"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link to="/" style={{ fontSize: 13, color: "var(--text2)" }}>
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "18px 22px"
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          fontFamily: "var(--display)",
          color: "var(--accent)"
        }}
      >
        {value}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
        {label}
      </div>

      {sub && (
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SocialPostPreview({ post }) {
  if (!post) {
    return (
      <div style={{ color: "var(--text2)", fontSize: 13, lineHeight: 1.6 }}>
        Generate a preview to see the post design here.
      </div>
    );
  }

  const sizes = {
    instagram: {
      width: 360,
      minHeight: 360,
      label: "Instagram Post · 1080 × 1080"
    },
    facebook: {
      width: 480,
      minHeight: 252,
      label: "Facebook Post · 1200 × 630"
    },
    whatsapp: {
      width: 270,
      minHeight: 480,
      label: "WhatsApp Status · 1080 × 1920"
    }
  };

  const previewSize = sizes[post.platform] || sizes.instagram;

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text2)",
          marginBottom: 10
        }}
      >
        {previewSize.label}
      </div>

      <div
        style={{
          width: previewSize.width,
          minHeight: previewSize.minHeight,
          maxWidth: "100%",
          background:
            "linear-gradient(145deg, rgba(136,197,64,0.18), rgba(13,13,13,1) 45%, rgba(20,20,20,1))",
          border: "1px solid var(--accent-border)",
          borderRadius: 18,
          padding: 26,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)"
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--accent)",
              fontWeight: 800,
              marginBottom: 18
            }}
          >
            Sri Lankan Entrepreneur
          </div>

          <h2
            style={{
              fontFamily: "var(--display)",
              fontSize: post.platform === "whatsapp" ? 24 : 26,
              lineHeight: 1.15,
              marginBottom: 14
            }}
          >
            {post.title}
          </h2>

          {post.hook && (
            <div
              style={{
                fontSize: 15,
                color: "var(--accent)",
                fontWeight: 700,
                marginBottom: 16
              }}
            >
              {post.hook}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(post.bodyLines || []).map((line, index) => (
              <div
                key={index}
                style={{
                  fontSize: 14,
                  color: "var(--text2)",
                  lineHeight: 1.5
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontSize: 13,
              color: "#fff",
              fontWeight: 700,
              marginBottom: 12
            }}
          >
            {post.callToAction || "Read more"}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(post.hashtags || []).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  background: "rgba(136,197,64,0.12)",
                  borderRadius: 999,
                  padding: "4px 8px"
                }}
              >
                #{String(tag).replace("#", "")}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(
    () => !!sessionStorage.getItem("adminKey")
  );

  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState(null);

  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);

  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("sources");

  const [socialPosts, setSocialPosts] = useState([]);
  const [postUrl, setPostUrl] = useState("");
  const [postPlatform, setPostPlatform] = useState("instagram");
  const [postPreview, setPostPreview] = useState(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  const load = useCallback(async () => {
    try {
      const [srcRes, statsRes, postsRes] = await Promise.all([
        getSources(),
        getStats(),
        getSocialPosts().catch(() => ({ data: { posts: [] } }))
      ]);

      const srcData = getData(srcRes);
      const statsData = getData(statsRes);
      const postsData = getData(postsRes);

      setSources(srcData.sources || []);
      setStats(statsData.stats || null);
      setSocialPosts(postsData.posts || []);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (authed) {
      load();
    }
  }, [authed, load]);

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!urlInput.trim()) return;

    setLoading(true);

    try {
      const res = await addSource({ url: urlInput.trim() });
      const data = getData(res);

      showToast(`✅ Added "${data.name || "source"}" — AI is scraping now`);
      setUrlInput("");

      setTimeout(load, 3000);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (src) => {
    try {
      await updateSource(src.id, { active: !src.active });
      showToast(`Source ${src.active ? "paused" : "resumed"}`);
      load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleDelete = async (src) => {
    if (!window.confirm(`Delete "${src.name}"?`)) return;

    try {
      await deleteSource(src.id);
      showToast("Source deleted");
      load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleScrape = async () => {
    setScraping(true);

    try {
      await triggerPipeline();
      showToast("🔄 Scraping all sources now…");
      setTimeout(load, 6000);
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setTimeout(() => setScraping(false), 4000);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm("Delete ALL articles? Cannot be undone.")) return;

    try {
      await deleteAllArticles();
      showToast("All articles deleted");
      load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const handleGeneratePost = async (e) => {
    e.preventDefault();

    if (!postUrl.trim()) {
      showToast("Please add a URL first", "error");
      return;
    }

    setGeneratingPost(true);
    setPostPreview(null);

    try {
      const res = await generateSocialPostPreview({
        url: postUrl.trim(),
        platform: postPlatform
      });

      const data = getData(res);
      setPostPreview(data.post);

      showToast("Preview generated");
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleSavePost = async () => {
    if (!postPreview) return;

    setSavingPost(true);

    try {
      await saveSocialPost(postPreview);

      showToast("Social post saved");
      setPostPreview(null);
      setPostUrl("");
      load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeleteSocialPost = async (post) => {
    if (!window.confirm("Delete this saved post?")) return;

    try {
      await removeSocialPost(post.id);
      showToast("Post deleted");
      load();
    } catch (err) {
      showToast(getErrorMessage(err), "error");
    }
  };

  const tabStyle = (targetTab) => ({
    padding: "7px 18px",
    borderRadius: 7,
    border: "none",
    background: tab === targetTab ? "var(--accent-dim)" : "transparent",
    color: tab === targetTab ? "var(--accent)" : "var(--text2)",
    fontWeight: tab === targetTab ? 600 : 400,
    fontSize: 13,
    cursor: "pointer"
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav
        style={{
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/logo.svg" alt="logo" style={{ height: 26 }} />

          <span
            style={{
              fontSize: 12,
              background: "var(--accent-dim)",
              border: "1px solid var(--accent-border)",
              borderRadius: 5,
              padding: "2px 8px",
              color: "var(--accent)",
              fontWeight: 600
            }}
          >
            ADMIN
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleScrape}
            disabled={scraping}
          >
            {scraping ? "⏳ Scraping…" : "🔄 Scrape All Now"}
          </button>

          <Link to="/">
            <button className="btn btn-ghost btn-sm">← View Site</button>
          </Link>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              sessionStorage.removeItem("adminKey");
              setAuthed(false);
            }}
          >
            Lock 🔒
          </button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 28
            }}
          >
            <StatCard label="Total Articles" value={stats.totalArticles || 0} />
            <StatCard
              label="Active Sources"
              value={`${stats.activeSources || 0}/${stats.totalSources || 0}`}
            />
            <StatCard
              label="Multi-Source"
              value={stats.multiSourceArticles || 0}
              sub="Same story, multiple outlets"
            />
            <StatCard
              label="Categories"
              value={Object.keys(stats.categoriesBreakdown || {}).length}
            />
          </div>
        )}

        {stats?.categoriesBreakdown &&
          Object.keys(stats.categoriesBreakdown).length > 0 && (
            <div
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 18,
                marginBottom: 24
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--text2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 12
                }}
              >
                Articles by Category
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(stats.categoriesBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <div
                      key={cat}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        background: "var(--bg3)",
                        border: "1px solid var(--border)",
                        borderRadius: 7
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{cat}</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--accent)",
                          fontWeight: 700
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            background: "var(--bg2)",
            borderRadius: 9,
            padding: 4,
            width: "fit-content",
            flexWrap: "wrap"
          }}
        >
          <button style={tabStyle("sources")} onClick={() => setTab("sources")}>
            📡 Sources ({sources.length})
          </button>

          <button style={tabStyle("add")} onClick={() => setTab("add")}>
            ➕ Add Source
          </button>

          <button style={tabStyle("posts")} onClick={() => setTab("posts")}>
            📝 Social Posts
          </button>

          <button style={tabStyle("danger")} onClick={() => setTab("danger")}>
            ⚠️ Danger
          </button>
        </div>

        {tab === "sources" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sources.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: 48,
                  color: "var(--text2)",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10
                }}
              >
                No sources yet — add a news website URL to get started.
              </div>
            )}

            {sources.map((src) => (
              <div
                key={src.id}
                className="card"
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 3
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 15 }}>
                      {src.name}
                    </span>

                    <span
                      style={{
                        padding: "1px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          src.active !== false
                            ? "rgba(136,197,64,0.1)"
                            : "rgba(100,100,100,0.1)",
                        color:
                          src.active !== false
                            ? "var(--accent)"
                            : "var(--text2)"
                      }}
                    >
                      {src.active !== false ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {src.url || src.websiteUrl}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text3)",
                      marginTop: 3,
                      display: "flex",
                      gap: 14,
                      flexWrap: "wrap"
                    }}
                  >
                    {src.articleCount !== undefined && (
                      <span>📰 {src.articleCount} articles</span>
                    )}

                    {src.lastScraped && (
                      <span>⏱ {new Date(src.lastScraped).toLocaleString()}</span>
                    )}

                    {src.lastError && (
                      <span style={{ color: "#f87171" }}>
                        ⚠️ {String(src.lastError).slice(0, 60)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleToggle(src)}
                  >
                    {src.active !== false ? "⏸ Pause" : "▶ Resume"}
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(src)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "add" && (
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 28,
              maxWidth: 520
            }}
          >
            <h2
              style={{
                fontFamily: "var(--display)",
                fontSize: 20,
                marginBottom: 8
              }}
            >
              Add News Source
            </h2>

            <p
              style={{
                fontSize: 13,
                color: "var(--text2)",
                marginBottom: 20,
                lineHeight: 1.6
              }}
            >
              Paste the website URL. AI will detect the site name, extract
              articles, summarize them, and categorize everything.
            </p>

            <form onSubmit={handleAdd} style={{ display: "flex", gap: 10 }}>
              <input
                className="form-input"
                type="url"
                style={{ flex: 1 }}
                placeholder="https://www.dailymirror.lk"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required
              />

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "⏳ Adding…" : "➕ Add"}
              </button>
            </form>

            <p
              style={{
                fontSize: 12,
                color: "var(--text2)",
                marginTop: 16,
                lineHeight: 1.6
              }}
            >
              After adding, AI immediately visits the site and fetches news.
              All sources are auto-refreshed by the backend scheduler.
            </p>
          </div>
        )}

        {tab === "posts" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 380px",
              gap: 22
            }}
          >
            <div>
              <div
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 28,
                  marginBottom: 20
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: 20,
                    marginBottom: 8
                  }}
                >
                  Create Social Media Post
                </h2>

                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    marginBottom: 20,
                    lineHeight: 1.6
                  }}
                >
                  Paste a news, article, or blog URL. Groq AI will read it and
                  create a text-only post. Preview it before saving.
                </p>

                <form
                  onSubmit={handleGeneratePost}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Article / Blog URL</label>

                    <input
                      className="form-input"
                      type="url"
                      placeholder="https://example.com/news/article"
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Post Size</label>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[
                        { value: "instagram", label: "Instagram 1:1" },
                        { value: "facebook", label: "Facebook" },
                        { value: "whatsapp", label: "WhatsApp Status" }
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.value}
                          onClick={() => setPostPlatform(item.value)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: 999,
                            border:
                              postPlatform === item.value
                                ? "1px solid var(--accent)"
                                : "1px solid var(--border)",
                            background:
                              postPlatform === item.value
                                ? "var(--accent-dim)"
                                : "transparent",
                            color:
                              postPlatform === item.value
                                ? "var(--accent)"
                                : "var(--text2)",
                            fontSize: 12,
                            cursor: "pointer"
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={generatingPost}
                    style={{ width: "fit-content" }}
                  >
                    {generatingPost
                      ? "⏳ Generating Preview…"
                      : "✨ Generate Preview"}
                  </button>
                </form>
              </div>

              {postPreview && (
                <div
                  style={{
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 24,
                    marginBottom: 20
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "var(--display)",
                      fontSize: 18,
                      marginBottom: 16
                    }}
                  >
                    Caption Preview
                  </h3>

                  <div
                    style={{
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 16
                    }}
                  >
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 14,
                        lineHeight: 1.7
                      }}
                    >
                      {postPreview.caption}
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        color: "var(--accent)",
                        fontSize: 13
                      }}
                    >
                      {(postPreview.hashtags || [])
                        .map((tag) => `#${String(tag).replace("#", "")}`)
                        .join(" ")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleSavePost}
                      disabled={savingPost}
                    >
                      {savingPost ? "Saving…" : "💾 Save Post"}
                    </button>

                    <button
                      className="btn btn-ghost"
                      onClick={() => setPostPreview(null)}
                    >
                      Clear Preview
                    </button>
                  </div>
                </div>
              )}

              {socialPosts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text2)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 8
                    }}
                  >
                    Saved Posts
                  </div>

                  {socialPosts.map((post) => (
                    <div
                      key={post.id}
                      className="card"
                      style={{
                        padding: "14px 18px",
                        display: "flex",
                        gap: 14,
                        alignItems: "flex-start"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          {post.title}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text2)",
                            marginBottom: 6
                          }}
                        >
                          {post.platformLabel || post.platform} · {post.size}
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text2)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {post.sourceUrl}
                        </div>
                      </div>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteSocialPost(post)}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 18,
                height: "fit-content",
                position: "sticky",
                top: 80
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
                Visual Preview
              </div>

              <SocialPostPreview post={postPreview} />
            </div>
          </div>
        )}

        {tab === "danger" && (
          <div
            style={{
              background: "rgba(239,68,68,0.04)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10,
              padding: 28,
              maxWidth: 440
            }}
          >
            <h2
              style={{
                fontFamily: "var(--display)",
                fontSize: 20,
                marginBottom: 8,
                color: "#f87171"
              }}
            >
              Danger Zone
            </h2>

            <p
              style={{
                fontSize: 13,
                color: "var(--text2)",
                marginBottom: 20
              }}
            >
              These actions cannot be undone.
            </p>

            <button className="btn btn-danger" onClick={handleDeleteAll}>
              🗑 Delete All Articles
            </button>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}