import React, { useState, useEffect, useRef } from "react";

export function CreateItemModal({ isOpen, onClose, onSubmit, submitting, apiError }) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: "0",
    reorder_level: "5",
    location: "",
  });

  const [validationErrors, setValidationErrors] = useState({});
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        sku: "",
        category: "",
        quantity: "0",
        reorder_level: "5",
        location: "",
      });
      setValidationErrors({});
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: null }));
    }
  }

  function validate() {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = "Item name is required";
    }
    if (!formData.sku.trim()) {
      errors.sku = "SKU code is required";
    }
    if (!formData.category.trim()) {
      errors.category = "Category is required";
    }
    if (!formData.location.trim()) {
      errors.location = "Bin / Shelf location is required";
    }

    const qty = Number(formData.quantity);
    if (formData.quantity === "" || isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
      errors.quantity = "Quantity must be an integer ≥ 0";
    }

    const reorder = Number(formData.reorder_level);
    if (formData.reorder_level === "" || isNaN(reorder) || !Number.isInteger(reorder) || reorder < 0) {
      errors.reorder_level = "Reorder level must be an integer ≥ 0";
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    await onSubmit({
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      category: formData.category.trim(),
      quantity: parseInt(formData.quantity, 10),
      reorder_level: parseInt(formData.reorder_level, 10),
      location: formData.location.trim().toUpperCase(),
    });
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">STOCK ENTRY</div>
            <h2 id="modal-title" className="modal-title">Register New Stock Item</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {apiError && (
          <div className="modal-alert modal-alert-error" role="alert">
            <span className="modal-alert-icon">⚠️</span>
            <div className="modal-alert-content">
              <strong>Registration Conflict (409)</strong>
              <p>{apiError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="form-group form-group-span-2">
              <label htmlFor="item-name" className="form-label">
                Item Name <span className="req">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="item-name"
                name="name"
                type="text"
                className={`form-input ${validationErrors.name ? "form-input-error" : ""}`}
                placeholder="e.g. Industrial Hex Bolt M8x40"
                value={formData.name}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {validationErrors.name && (
                <span className="form-error-msg">{validationErrors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="item-sku" className="form-label">
                SKU / Barcode <span className="req">*</span>
              </label>
              <input
                id="item-sku"
                name="sku"
                type="text"
                className={`form-input font-mono ${validationErrors.sku ? "form-input-error" : ""}`}
                placeholder="e.g. BLT-0840-ZNC"
                value={formData.sku}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {validationErrors.sku && (
                <span className="form-error-msg">{validationErrors.sku}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="item-category" className="form-label">
                Category <span className="req">*</span>
              </label>
              <input
                id="item-category"
                name="category"
                type="text"
                className={`form-input ${validationErrors.category ? "form-input-error" : ""}`}
                placeholder="e.g. Fasteners, Raw Materials"
                value={formData.category}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {validationErrors.category && (
                <span className="form-error-msg">{validationErrors.category}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="item-quantity" className="form-label">
                Initial Quantity <span className="req">*</span>
              </label>
              <input
                id="item-quantity"
                name="quantity"
                type="number"
                min="0"
                step="1"
                className={`form-input font-mono ${validationErrors.quantity ? "form-input-error" : ""}`}
                value={formData.quantity}
                onChange={handleChange}
                disabled={submitting}
              />
              {validationErrors.quantity && (
                <span className="form-error-msg">{validationErrors.quantity}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="item-reorder" className="form-label">
                Reorder Threshold <span className="req">*</span>
              </label>
              <input
                id="item-reorder"
                name="reorder_level"
                type="number"
                min="0"
                step="1"
                className={`form-input font-mono ${validationErrors.reorder_level ? "form-input-error" : ""}`}
                value={formData.reorder_level}
                onChange={handleChange}
                disabled={submitting}
              />
              {validationErrors.reorder_level && (
                <span className="form-error-msg">{validationErrors.reorder_level}</span>
              )}
            </div>

            <div className="form-group form-group-span-2">
              <label htmlFor="item-location" className="form-label">
                Stockroom Location / Bin <span className="req">*</span>
              </label>
              <input
                id="item-location"
                name="location"
                type="text"
                className={`form-input font-mono ${validationErrors.location ? "form-input-error" : ""}`}
                placeholder="e.g. AISLE-03-RACK-B2"
                value={formData.location}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {validationErrors.location && (
                <span className="form-error-msg">{validationErrors.location}</span>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Registering..." : "Add to Inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
