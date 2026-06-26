import React from 'react';

const CATEGORIES = ['All', 'Technology', 'Politics', 'Business', 'Sports', 'Entertainment', 'Science', 'Health', 'World'];

export default function CategoryBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      padding: '12px 0',
      scrollbarWidth: 'none',
    }}>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          style={{
            padding: '6px 16px',
            borderRadius: 20,
            border: active === cat ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: active === cat ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: active === cat ? 'var(--accent2)' : 'var(--text2)',
            fontSize: 13,
            fontWeight: active === cat ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
