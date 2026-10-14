import React, { useState } from "react";

export function IssueStockAction({ item, onIssueSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handleOpen() {
    setIsOpen(true);
    setQuantity("1");
    setErrorMessage("");
  }

  function handleCancel() {
    setIsOpen(false);
    setQuantity("1");
    setErrorMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    const qty = Number(quantity);
    if (!quantity || isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
      setErrorMessage("Enter an integer quantity ≥ 1");
      return;
    }

    setSubmitting(true);
    try {
      await onIssueSuccess(item.id, qty);
      setIsOpen(false);
      setQuantity("1");
    } catch (err) {
      // 409 or other error returned by backend
      setErrorMessage(err.message || "Failed to issue stock");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    const isOutOfStock = item.quantity === 0;
    return (
      <button
        type="button"
        className={`btn btn-sm btn-issue ${isOutOfStock ? "btn-disabled" : ""}`}
        onClick={handleOpen}
        disabled={isOutOfStock}
        title={isOutOfStock ? "No stock available to issue" : `Issue units from ${item.sku}`}
        aria-label={`Issue units from item ${item.sku}`}
      >
        <span className="btn-icon">⚡</span> Issue Stock
      </button>
    );
  }

  return (
    <div className="issue-inline-container" role="region" aria-label={`Issue units for ${item.sku}`}>
      <form onSubmit={handleSubmit} className="issue-inline-form">
        <label htmlFor={`issue-qty-${item.id}`} className="sr-only">
          Quantity to issue
        </label>
        <input
          id={`issue-qty-${item.id}`}
          type="number"
          min="1"
          step="1"
          className="issue-qty-input font-mono"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            if (errorMessage) setErrorMessage("");
          }}
          disabled={submitting}
          autoFocus
        />
        <button
          type="submit"
          className="btn btn-sm btn-primary btn-issue-submit"
          disabled={submitting}
        >
          {submitting ? "..." : "Confirm"}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={handleCancel}
          disabled={submitting}
          aria-label="Cancel stock issue"
        >
          ✕
        </button>
      </form>
      {errorMessage && (
        <div className="issue-error-message" role="alert">
          <span className="issue-error-icon">⚠️</span>
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
