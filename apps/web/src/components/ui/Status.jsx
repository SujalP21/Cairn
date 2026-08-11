import { AlertIcon } from "@primer/octicons-react";
import { CairnIllustration } from "./CairnMark";
import "./ui.css";

export const Spinner = ({ large = false }) => (
  <span
    className={`spinner ${large ? "spinner-lg" : ""}`}
    role="status"
    aria-label="Loading"
  />
);

/**
 * Whole-page loading state.
 *
 * Uses the stone stack assembling itself rather than a generic spinner — the
 * one place a loading state can carry the product's character.
 */
export const Loading = ({ label = "Loading…" }) => (
  <div className="status-block" role="status">
    <CairnIllustration size={96} animate />
    <p className="muted">{label}</p>
  </div>
);

/** Failure state with a retry affordance. */
export const ErrorState = ({ message, onRetry }) => (
  <div className="status-error" role="alert">
    <span className="status-error-icon">
      <AlertIcon size={16} />
    </span>
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      <span>{message}</span>
      {onRetry && (
        <div>
          <button className="btn btn-sm" onClick={onRetry} type="button">
            Try again
          </button>
        </div>
      )}
    </div>
  </div>
);

/**
 * Empty state.
 *
 * Defaults to the cairn motif so a blank screen still looks designed; pass
 * `icon` to override where something more specific reads better.
 */
export const EmptyState = ({ icon, title, description, action }) => (
  <div className="status-block">
    {icon ?? <CairnIllustration size={88} />}
    <h3>{title}</h3>
    {description && <p className="muted">{description}</p>}
    {action}
  </div>
);
