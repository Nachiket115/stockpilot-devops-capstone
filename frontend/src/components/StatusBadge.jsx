import React from "react";

export function StatusBadge({ status }) {
  const normalized = status ? status.toUpperCase() : "UNKNOWN";

  let colorClass = "badge-unknown";
  let label = "Unknown";
  let icon = "•";

  if (normalized === "IN_STOCK") {
    colorClass = "badge-in-stock";
    label = "In Stock";
    icon = "✓";
  } else if (normalized === "LOW") {
    colorClass = "badge-low";
    label = "Low Stock";
    icon = "▲";
  } else if (normalized === "OUT_OF_STOCK") {
    colorClass = "badge-out-of-stock";
    label = "Out of Stock";
    icon = "✕";
  }

  return (
    <span
      className={`status-badge ${colorClass}`}
      role="status"
      aria-label={`Stock status: ${label}`}
    >
      <span className="status-badge-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="status-badge-text">{label}</span>
    </span>
  );
}
