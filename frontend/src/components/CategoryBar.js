import React from "react";

const CATEGORIES = [
  "All",
  "Technology",
  "Politics",
  "Business",
  "Sports",
  "Entertainment",
  "Science",
  "Health",
  "World"
];

export default function CategoryBar({ active, onChange }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        borderBottom: "1px solid #1e1e1e",
        background: "#0d0d0d"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "flex",
          justifyContent: "center",
          gap: 8,
          overflowX: "auto",
          padding: "14px 16px",
          boxSizing: "border-box",
          scrollbarWidth: "none"
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = active === cat;

          return (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: isActive
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                background: isActive
                  ? "rgba(136,197,64,0.15)"
                  : "transparent",
                color: isActive ? "var(--accent)" : "var(--text2)",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s",
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}