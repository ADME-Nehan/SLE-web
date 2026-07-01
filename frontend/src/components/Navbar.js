import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar({ onSearch }) {
  const [q, setQ] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(q);
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <img
            src="/logo.svg"
            alt="SriLankan News"
            style={{ height: 34, width: 'auto' }}
          />
        </Link>

        <form onSubmit={handleSearch} className="navbar-search">
          <div className="navbar-search-wrapper">
            <span className="navbar-search-icon">🔍</span>
            <input
              className="form-input navbar-search-input"
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
