import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

function pillClass(cat) {
  const m = { Technology:'pill-tech', Politics:'pill-politics', Business:'pill-business', Sports:'pill-sports', Entertainment:'pill-entertainment', Science:'pill-science', Health:'pill-health', World:'pill-world' };
  return m[cat] || 'pill-default';
}

export default function NewsCard({ article, featured = false }) {
  const { id, title, summary, category, tags = [], sources = [], publishedAt, createdAt } = article;
  const timeAgo = (() => { try { return formatDistanceToNow(new Date(publishedAt || createdAt), { addSuffix: true }); } catch { return 'recently'; } })();

  return (
    <Link to={`/article/${id}`} style={{ display: 'block', height: '100%' }}>
      <article className="card" style={{ padding: featured ? 24 : 16, height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={`pill ${pillClass(category)}`}>{category || 'World'}</span>
          {sources.length > 1 && <span className="multi-source">🔗 {sources.length} sources</span>}
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--display)',
          fontSize: featured ? 22 : 16,
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--text)',
          display: '-webkit-box',
          WebkitLineClamp: featured ? 3 : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{title}</h2>

        {/* Summary */}
        {summary && (
          <p style={{
            fontSize: 13, color: 'var(--text2)', lineHeight: 1.6,
            display: '-webkit-box', WebkitLineClamp: featured ? 4 : 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1,
          }}>{summary}</p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.slice(0, 3).map(t => (
              <span key={t} style={{ padding: '2px 7px', background: 'var(--bg3)', borderRadius: 4, fontSize: 11, color: 'var(--text2)' }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 4 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {sources.slice(0, 2).map((s, i) => (
              <span key={i} className="source-badge">📡 {s.name}</span>
            ))}
            {sources.length > 2 && <span className="source-badge">+{sources.length - 2}</span>}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{timeAgo}</span>
        </div>
      </article>
    </Link>
  );
}
