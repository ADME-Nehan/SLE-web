import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ onSearch }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(q);
  };

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      width: '100%',
      background: 'rgba(13,13,13,0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #1e1e1e',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        minHeight: 64,
        padding: '0 16px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Logo */}
        <Link to="/" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img
            src="/logo.svg"
            alt="SriLankan News"
            style={{ height: 34, width: 'auto' }}
          />
        </Link>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: '#2a2a2a', flexShrink: 0 }} />

        {/* Search */}
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 520, marginLeft: 'auto' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: 14 }}>🔍</span>
            <input
              className="form-input"
              style={{ width: '100%', paddingLeft: 36, background: '#111', borderColor: '#222' }}
              placeholder="Search news..."
              value={q}
              onChange={e => { setQ(e.target.value); if (!e.target.value && onSearch) onSearch(''); }}
            />
          </div>
        </form>

      </div>
    </nav>
  );
}
