import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <div className="brand-mark">SLE</div>
        <div>
          <div className="brand-title">Sri Lankan Entrepreneur</div>
          <div className="brand-subtitle">RSS News Aggregator</div>
        </div>
      </Link>

      <nav className="nav-links">
        <Link className={location.pathname === "/" ? "active" : ""} to="/">
          News
        </Link>
        <Link
          className={location.pathname === "/admin" ? "active" : ""}
          to="/admin"
        >
          Admin
        </Link>
      </nav>
    </header>
  );
}