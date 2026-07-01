import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getSources, addSource, updateSource, deleteSource, getStats, triggerPipeline, deleteAllArticles, verifyAdmin } from '../utils/api';

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return <div className={`toast toast-${type}`}>{msg}</div>;
}

// ── Password Gate ─────────────────────────────────────
function PasswordGate({ onSuccess }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await verifyAdmin(pw);
      sessionStorage.setItem('adminKey', pw);
      onSuccess(pw);
    } catch {
      setError('Wrong password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.svg" alt="logo" style={{ height: 28, marginBottom: 16 }} />
          <h2 style={{ fontFamily: 'var(--display)', fontSize: 22, marginBottom: 6 }}>Admin Access</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)' }}>Enter your admin password to continue</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input" type="password"
              value={pw} onChange={e => setPw(e.target.value)}
              autoFocus placeholder="Enter admin password"
            />
          </div>
          {error && (
            <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}>
            {loading ? 'Verifying…' : 'Enter Admin Panel'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--text2)' }}>← Back to site</Link>
        </div>
      </div>
    </div>
  );
}

// ── Admin Panel ────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 22px' }}>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'var(--display)', color: 'var(--accent)' }}>{value}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('adminKey'));
  const [sources, setSources] = useState([]);
  const [stats, setStats] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('sources');

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const load = useCallback(async () => {
    try {
      const [srcRes, statsRes] = await Promise.all([getSources(), getStats()]);
      setSources(srcRes.data.sources || []);
      setStats(statsRes.data.stats);
    } catch (err) { showToast(err.response?.data?.error || err.message, 'error'); }
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (!authed) return <PasswordGate onSuccess={() => setAuthed(true)} />;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setLoading(true);
    try {
      const res = await addSource({ url: urlInput.trim() });
      showToast(`✅ Added "${res.data.name}" — Groq AI is scraping now`);
      setUrlInput('');
      setTimeout(load, 3000);
    } catch (err) { showToast(err.response?.data?.error || err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleToggle = async (src) => {
    try {
      await updateSource(src.id, { active: !src.active });
      showToast(`Source ${src.active ? 'paused' : 'resumed'}`);
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (src) => {
    if (!window.confirm(`Delete "${src.name}"?`)) return;
    try {
      await deleteSource(src.id);
      showToast('Source deleted');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      await triggerPipeline();
      showToast('🔄 Scraping all sources now…');
      setTimeout(load, 6000);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setTimeout(() => setScraping(false), 4000); }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete ALL articles? Cannot be undone.')) return;
    try {
      await deleteAllArticles();
      showToast('All articles deleted');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const tabStyle = (t) => ({
    padding: '7px 18px', borderRadius: 7, border: 'none',
    background: tab === t ? 'var(--accent-dim)' : 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--text2)',
    fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: 'pointer',
  });

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Admin Navbar */}
      <nav style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/logo.svg" alt="logo" style={{ height: 26 }} />
          <span style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 5, padding: '2px 8px', color: 'var(--accent)', fontWeight: 600 }}>
            ADMIN
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleScrape} disabled={scraping}>
            {scraping ? '⏳ Scraping…' : '🔄 Scrape All Now'}
          </button>
          <Link to="/"><button className="btn btn-ghost btn-sm">← View Site</button></Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { sessionStorage.removeItem('adminKey'); setAuthed(false); }}>
            Lock 🔒
          </button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Total Articles" value={stats.totalArticles} />
            <StatCard label="Active Sources" value={`${stats.activeSources}/${stats.totalSources}`} />
            <StatCard label="Multi-Source" value={stats.multiSourceArticles} sub="Same story, multiple outlets" />
            <StatCard label="Categories" value={Object.keys(stats.categoriesBreakdown || {}).length} />
          </div>
        )}

        {/* Category breakdown */}
        {stats?.categoriesBreakdown && Object.keys(stats.categoriesBreakdown).length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Articles by Category</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(stats.categoriesBreakdown).sort(([,a],[,b]) => b-a).map(([cat, count]) => (
                <div key={cat} style={{ display:'flex', alignItems:'center', gap: 6, padding:'5px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius: 7 }}>
                  <span style={{ fontSize: 13 }}>{cat}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg2)', borderRadius: 9, padding: 4, width: 'fit-content' }}>
          <button style={tabStyle('sources')} onClick={() => setTab('sources')}>📡 Sources ({sources.length})</button>
          <button style={tabStyle('add')} onClick={() => setTab('add')}>➕ Add Source</button>
          <button style={tabStyle('danger')} onClick={() => setTab('danger')}>⚠️ Danger</button>
        </div>

        {/* SOURCES LIST */}
        {tab === 'sources' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sources.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text2)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                No sources yet — add a news website URL to get started.
              </div>
            )}
            {sources.map(src => (
              <div key={src.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{src.name}</span>
                    <span style={{
                      padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: src.active !== false ? 'rgba(136,197,64,0.1)' : 'rgba(100,100,100,0.1)',
                      color: src.active !== false ? 'var(--accent)' : 'var(--text2)',
                    }}>{src.active !== false ? 'Active' : 'Paused'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{src.url}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 14 }}>
                    {src.articleCount !== undefined && <span>📰 {src.articleCount} articles</span>}
                    {src.lastScraped && <span>⏱ {new Date(src.lastScraped).toLocaleString()}</span>}
                    {src.lastError && <span style={{ color: '#f87171' }}>⚠️ {src.lastError.slice(0, 60)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(src)}>
                    {src.active !== false ? '⏸ Pause' : '▶ Resume'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(src)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD SOURCE */}
        {tab === 'add' && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 28, maxWidth: 520 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 20, marginBottom: 8 }}>Add News Source</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
              Just paste the website URL — Groq AI will automatically detect the site name, find its RSS feed, extract articles, summarize them, and categorize everything.
            </p>
            <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10 }}>
              <input
                className="form-input" type="url" style={{ flex: 1 }}
                placeholder="https://www.dailymirror.lk"
                value={urlInput} onChange={e => setUrlInput(e.target.value)} required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '⏳ Adding…' : '➕ Add'}
              </button>
            </form>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 16, lineHeight: 1.6 }}>
              After adding, Groq AI immediately visits the site and fetches news. All sources are auto-refreshed every 2 hours.
            </p>
          </div>
        )}

        {/* DANGER ZONE */}
        {tab === 'danger' && (
          <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 28, maxWidth: 440 }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: 20, marginBottom: 8, color: '#f87171' }}>Danger Zone</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>These actions cannot be undone.</p>
            <button className="btn btn-danger" onClick={handleDeleteAll}>🗑 Delete All Articles</button>
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
