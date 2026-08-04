import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <header className="mag-navbar">
      <div className="mag-navbar-inner">
        <Link to="/" className="mag-logo" aria-label="Sri Lankan Entrepreneur home">
          <img src="/logo.svg" alt="Sri Lankan Entrepreneur" className="mag-logo-img" />
        </Link>
      </div>
    </header>
  );
}
