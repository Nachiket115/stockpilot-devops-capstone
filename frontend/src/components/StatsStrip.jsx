import React from "react";

export function StatsStrip({ stats, activeFilter, onFilterChange }) {
  const items = [
    {
      key: "",
      label: "Total Inventory",
      count: stats?.total ?? 0,
      icon: "📦",
      accent: "total",
    },
    {
      key: "IN_STOCK",
      label: "In Stock",
      count: stats?.in_stock ?? 0,
      icon: "🟢",
      accent: "in-stock",
    },
    {
      key: "LOW",
      label: "Low Stock",
      count: stats?.low ?? 0,
      icon: "🟡",
      accent: "low",
    },
    {
      key: "OUT_OF_STOCK",
      label: "Out of Stock",
      count: stats?.out_of_stock ?? 0,
      icon: "🔴",
      accent: "out-of-stock",
    },
  ];

  return (
    <section className="stats-strip" aria-label="Inventory metrics summary">
      {items.map((item) => {
        const isSelected = activeFilter === item.key;
        return (
          <button
            type="button"
            key={item.key}
            className={`stat-card stat-card-${item.accent} ${isSelected ? "stat-card-active" : ""}`}
            onClick={() => onFilterChange(item.key)}
            title={`Filter items by ${item.label}`}
            aria-pressed={isSelected}
          >
            <div className="stat-card-header">
              <span className="stat-icon" aria-hidden="true">{item.icon}</span>
              <span className="stat-label">{item.label}</span>
            </div>
            <div className="stat-value">{item.count}</div>
            <div className="stat-indicator" />
          </button>
        );
      })}
    </section>
  );
}
