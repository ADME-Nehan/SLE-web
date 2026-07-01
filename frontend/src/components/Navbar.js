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
            maxWidth: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20
          }}
        >
          {/* Logo */}
          <Link
            to="/"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              textDecoration: "none"
            }}
          >
            <img
              src="/logo.svg"
              alt="SriLankan News"
              style={{
                height: 34,
                width: "auto",
                display: "block"
              }}
            />
          </Link>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 28,
              background: "#2a2a2a",
              flexShrink: 0
            }}
          />

          {/* Search */}
          <form
            onSubmit={handleSearch}
            style={{
              width: "100%",
              maxWidth: 520
            }}
          >
            <div style={{ position: "relative", width: "100%" }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#555",
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
                  paddingLeft: 36,
                  background: "#111",
                  borderColor: "#222",
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