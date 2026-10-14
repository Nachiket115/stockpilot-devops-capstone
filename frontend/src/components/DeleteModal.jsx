import React, { useEffect } from "react";

export function DeleteModal({ isOpen, item, onClose, onConfirm, deleting, error }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen && !deleting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, deleting, onClose]);

  if (!isOpen || !item) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-card modal-card-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow modal-eyebrow-danger">CONFIRM DELETION</div>
            <h2 id="delete-dialog-title" className="modal-title">Delete Inventory Item</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={deleting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="delete-dialog-body" id="delete-dialog-desc">
          <p>
            Are you sure you want to permanently remove this stock record? This action cannot be undone.
          </p>
          <div className="delete-item-summary">
            <span className="summary-sku font-mono">{item.sku}</span>
            <span className="summary-name">{item.name}</span>
            <span className="summary-units">({item.quantity} units on hand)</span>
          </div>
        </div>

        {error && (
          <div className="modal-alert modal-alert-error" role="alert">
            <span className="modal-alert-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
