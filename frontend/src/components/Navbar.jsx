import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="mag-navbar">
      <div className="mag-navbar-inner">
        <div className="mag-navbar-left">
          <button
            type="button"
            className="mag-icon-btn"
            aria-label="Search"
          >
            ⌕
          </button>


        </div>

        <Link to="/" className="mag-logo">
          <img
            src="/logo.svg"
            alt="Sri Lankan Entrepreneur"
            className="mag-logo-img"
          />
        </Link>

      </div>
    </header>
  );
}