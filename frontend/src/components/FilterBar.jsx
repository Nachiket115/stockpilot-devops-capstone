import React from "react";

export function FilterBar({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onOpenCreate,
  onRefresh,
  refreshing,
}) {
  const filterTabs = [
    { key: "", label: "All Items" },
    { key: "IN_STOCK", label: "In Stock" },
    { key: "LOW", label: "Low Stock" },
    { key: "OUT_OF_STOCK", label: "Out of Stock" },
  ];

  return (
    <div className="filter-bar-container">
      <div className="filter-tabs-group" role="tablist" aria-label="Item status filter">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              type="button"
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              className={`filter-tab-btn ${isActive ? "filter-tab-active" : ""}`}
              onClick={() => onFilterChange(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="filter-controls-right">
        <div className="search-input-wrapper">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            className="search-input"
            placeholder="Search by SKU or item name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Filter items by SKU or name"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-icon-only"
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh inventory and stats"
          aria-label="Refresh inventory"
        >
          <span className={`refresh-icon ${refreshing ? "spin" : ""}`}>🔄</span>
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenCreate}
        >
          <span className="btn-icon">+</span> New Item
        </button>
      </div>
    </div>
  );
}
