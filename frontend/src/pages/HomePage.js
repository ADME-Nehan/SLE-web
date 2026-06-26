import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import NewsCard from '../components/NewsCard';
import { getNews, getTrending } from '../utils/api';

const CATEGORIES = ['All','Technology','Politics','Business','Sports','Entertainment','Science','Health','World'];

function pillClass(cat) {
  const m = { Technology:'pill-tech', Politics:'pill-politics', Business:'pill-business', Sports:'pill-sports', Entertainment:'pill-entertainment', Science:'pill-science', Health:'pill-health', World:'pill-world' };
  return m[cat] || 'pill-default';
}

export default function HomePage() {
  const [articles, setArticles] = useState([]);
  const [trending, setTrending] = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (category !== 'All') params.category = category;
      if (search) params.search = search;
      const res = await getNews(params);
      setArticles(res.data.articles || []);
      setPagination(res.data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [category, search, page]);

  useEffect(() => { fetchNews(); }, [fetchNews]);
  useEffect(() => { getTrending().then(r => setTrending(r.data.trending || [])).catch(() => {}); }, []);

  const handleSearch = (q) => { setSearch(q); setPage(1); };
  const handleCategory = (cat) => { setCategory(cat); setPage(1); };

  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar onSearch={handleSearch} />

      <div style={{ display: 'flex', maxWidth: 1300, margin: '0 auto', padding: '0 24px', gap: 0 }}>

        {/* SIDEBAR - Category Filter */}
        <aside style={{
          width: 200, flexShrink: 0, paddingTop: 28, paddingRight: 24,
          borderRight: '1px solid var(--border)', minHeight: 'calc(100vh - 64px)',
          position: 'sticky', top: 64, height: 'calc(100vh - 64px)', overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Categories
          </div>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => handleCategory(cat)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '8px 10px', marginBottom: 2,
              borderRadius: 7, border: 'none', textAlign: 'left',
              background: category === cat ? 'var(--accent-dim)' : 'transparent',
              color: category === cat ? 'var(--accent)' : 'var(--text2)',
              fontWeight: category === cat ? 600 : 400,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {cat}
              {category === cat && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
            </button>
          ))}

          {/* Trending tags */}
          {trending.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Trending
              </div>
              {trending.slice(0, 10).map(({ tag }) => (
                <button key={tag} onClick={() => handleSearch(tag)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '5px 10px', marginBottom: 2, borderRadius: 5,
                  border: 'none', background: 'transparent',
                  color: 'var(--text2)', fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => e.target.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.target.style.color = 'var(--text2)'}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, paddingTop: 28, paddingLeft: 28, minWidth: 0 }}>
          {/* Search/filter header */}
          {(search || category !== 'All') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              {search && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>Results for "<span style={{ color: 'var(--accent)' }}>{search}</span>"</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setPage(1); }}>✕ Clear</button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
              <div className="spinner" />
            </div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 80, color: 'var(--text2)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 16, marginBottom: 6 }}>No articles found</div>
              <div style={{ fontSize: 13 }}>Add news sources in the admin panel to get started</div>
            </div>
          ) : (
            <div className="fade-in">
              {/* Featured + sidebar mini */}
              {featured && !search && page === 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>
                  <NewsCard article={featured} featured />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      Latest
                    </div>
                    {rest.slice(0, 4).map(a => <NewsCard key={a.id} article={a} />)}
                  </div>
                </div>
              )}

              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {(search || page > 1 ? articles : rest.slice(4)).map(a => (
                  <NewsCard key={a.id} article={a} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 32, paddingBottom: 32 }}>
                  <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ opacity: page <= 1 ? 0.4 : 1 }}>← Prev</button>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Page {page} of {pagination.pages}</span>
                  <button className="btn btn-ghost btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={{ opacity: page >= pagination.pages ? 0.4 : 1 }}>Next →</button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 0', textAlign: 'center' }}>
        <img src="/logo.svg" alt="logo" style={{ height: 24, opacity: 0.5 }} />
      </footer>
    </div>
  );
}
