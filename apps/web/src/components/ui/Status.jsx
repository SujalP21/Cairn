import { AlertIcon } from "@primer/octicons-react";
import "./ui.css";

export const Spinner = ({ large = false }) => (
  <span
    className={`spinner ${large ? "spinner-lg" : ""}`}
    role="status"
    aria-label="Loading"
  />
);

/** Full-block loading state, for a region that has nothing to show yet. */
export const Loading = ({ label = "Loading…" }) => (
  <div className="status-block">
    <Spinner large />
    <p className="muted">{label}</p>
  </div>
);

/**
 * Failure state with a retry affordance.
 *
 * Every fetch in the app renders this rather than silently logging to the
 * console, which is what the previous version did.
 */
export const ErrorState = ({ message, onRetry }) => (
  <div className="status-error" role="alert">
    <span className="status-error-icon">
      <AlertIcon size={16} />
    </span>
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  </div>
);

export const EmptyState = ({ icon, title, description, action }) => (
  <div className="status-block">
    {icon && <span className="status-block-icon">{icon}</span>}
    <h3>{title}</h3>
    {description && <p className="muted">{description}</p>}
    {action}
  </div>
);
