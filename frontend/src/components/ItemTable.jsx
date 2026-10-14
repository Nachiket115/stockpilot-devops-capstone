import React from "react";
import { StatusBadge } from "./StatusBadge";
import { IssueStockAction } from "./IssueStockAction";

export function ItemTable({
  items,
  loading,
  onIssueSuccess,
  onOpenDelete,
  onOpenCreate,
  activeFilter,
}) {
  if (loading) {
    return (
      <div className="table-loading-container" role="status" aria-live="polite">
        <div className="stock-scanner-loader">
          <div className="scanner-laser" />
        </div>
        <p className="loading-text">Scanning warehouse records...</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="empty-state-card" role="region" aria-label="No inventory items">
        <div className="empty-state-icon">📦</div>
        <h3 className="empty-state-title">
          {activeFilter
            ? `No ${activeFilter.toLowerCase().replace("_", " ")} items found`
            : "No inventory items registered yet"}
        </h3>
        <p className="empty-state-desc">
          {activeFilter
            ? "Try changing your status filter or register a new batch into stock."
            : "Begin by adding items to track bin locations, minimum reorder thresholds, and live balances."}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenCreate}
        >
          <span className="btn-icon">+</span> Register First Item
        </button>
      </div>
    );
  }

  return (
    <div className="table-responsive-wrapper">
      <table className="items-table">
        <thead>
          <tr>
            <th scope="col" className="th-sku">SKU / Code</th>
            <th scope="col" className="th-name">Item &amp; Category</th>
            <th scope="col" className="th-location">Bin / Location</th>
            <th scope="col" className="th-stock">Stock Level</th>
            <th scope="col" className="th-status">Status</th>
            <th scope="col" className="th-actions text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLow = item.quantity <= item.reorder_level && item.quantity > 0;
            const isOut = item.quantity === 0;

            return (
              <tr key={item.id} className="item-row">
                <td className="td-sku">
                  <span className="sku-tag font-mono">{item.sku}</span>
                </td>
                <td className="td-name">
                  <div className="item-title">{item.name}</div>
                  <div className="item-category-tag">{item.category}</div>
                </td>
                <td className="td-location">
                  <div className="location-badge font-mono">
                    <span className="location-pin" aria-hidden="true">📍</span>
                    <span>{item.location}</span>
                  </div>
                </td>
                <td className="td-stock">
                  <div className="stock-level-group">
                    <div className="stock-numbers">
                      <span className={`stock-current font-mono ${isOut ? "text-danger" : isLow ? "text-warning" : "text-success"}`}>
                        {item.quantity}
                      </span>
                      <span className="stock-divider">/</span>
                      <span className="stock-reorder font-mono" title={`Reorder threshold: ${item.reorder_level}`}>
                        min {item.reorder_level}
                      </span>
                    </div>
                    <div className="stock-meter-bar">
                      <div
                        className={`stock-meter-fill ${isOut ? "fill-danger" : isLow ? "fill-warning" : "fill-success"}`}
                        style={{
                          width: `${Math.min(
                            100,
                            item.reorder_level > 0
                              ? (item.quantity / (item.reorder_level * 2)) * 100
                              : item.quantity > 0
                              ? 100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="td-status">
                  <StatusBadge status={item.status} />
                </td>
                <td className="td-actions">
                  <div className="row-actions-group">
                    <IssueStockAction
                      item={item}
                      onIssueSuccess={onIssueSuccess}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-icon-only btn-ghost-danger"
                      onClick={() => onOpenDelete(item)}
                      title={`Delete ${item.sku}`}
                      aria-label={`Delete item ${item.sku}`}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
