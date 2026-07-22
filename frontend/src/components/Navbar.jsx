import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="sle-navbar">
      <div className="sle-navbar-inner">
        <Link to="/" className="sle-navbar-logo">
          <img
            src="/logo.svg"
            alt="Sri Lankan Entrepreneur"
            className="sle-navbar-logo-img"
          />
        </Link>

        <button
          type="button"
          className="sle-navbar-menu-btn"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <div className={`sle-navbar-content ${open ? "open" : ""}`}>
          <nav className="sle-navbar-links">
            <Link
              to="/"
              className={`sle-nav-link ${
                location.pathname === "/" ? "sle-nav-link-active" : ""
              }`}
              onClick={() => setOpen(false)}
            >
              Home
            </Link>

            <Link
              to="/admin"
              className={`sle-nav-link ${
                location.pathname === "/admin" ? "sle-nav-link-active" : ""
              }`}
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          </nav>

          <div className="sle-navbar-search">
            <div className="sle-navbar-search-box">
              <span className="sle-navbar-search-icon">⌕</span>
              <input
                className="sle-navbar-search-input"
                type="text"
                placeholder="Search latest updates..."
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}