import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function Navbar({ onSearch }) {
  const [q, setQ] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();

    if (onSearch) {
      onSearch(q.trim());
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setQ(value);

    if (!value && onSearch) {
      onSearch("");
    }
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        background: "rgba(13,13,13,0.96)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1e1e1e"
      }}
    >
      <div
        style={{
          width: "100%",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            margin: "0 auto"
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none"
            }}
          >
            <img
              src="/logo.svg"
              alt="Sri Lankan Entrepreneur"
              style={{
                height: 36,
                width: "auto",
                display: "block"
              }}
            />
          </Link>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            style={{
              width: "100%",
              maxWidth: 520,
              flex: 1
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%"
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#777",
                  fontSize: 14,
                  pointerEvents: "none"
                }}
              >
                🔍
              </span>

              <input
                className="form-input"
                style={{
                  width: "100%",
                  height: 42,
                  paddingLeft: 40,
                  paddingRight: 14,
                  background: "#111",
                  border: "1px solid #242424",
                  borderRadius: 8,
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box"
                }}
                placeholder="Search news..."
                value={q}
                onChange={handleChange}
              />
            </div>
          </form>
        </div>
      </div>
    </nav>
  );
}