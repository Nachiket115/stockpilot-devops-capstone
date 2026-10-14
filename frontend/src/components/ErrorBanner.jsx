import React from "react";

export function ErrorBanner({ error, onRetry, onDismiss }) {
  if (!error) return null;

  const isUnreachable =
    error.status === 0 ||
    error.message?.toLowerCase().includes("unreachable") ||
    error.message?.toLowerCase().includes("failed to fetch");

  return (
    <div
      className={`alert-banner ${isUnreachable ? "alert-banner-fatal" : "alert-banner-warning"}`}
      role="alert"
    >
      <div className="alert-banner-icon">
        {isUnreachable ? "🔌" : "⚠️"}
      </div>
      <div className="alert-banner-body">
        <div className="alert-banner-title">
          {isUnreachable ? "Backend API Unreachable" : "System Notification"}
        </div>
        <p className="alert-banner-text">{error.message}</p>
        {isUnreachable && (
          <p className="alert-banner-subtext">
            Ensure the FastAPI service is running locally on <code>http://localhost:8000</code>.
          </p>
        )}
      </div>
      <div className="alert-banner-actions">
        {onRetry && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onRetry}
          >
            Retry Connection
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={onDismiss}
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
