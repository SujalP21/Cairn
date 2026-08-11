import { useId } from "react";
import "./ui.css";

/**
 * Label + control + error message, wired together.
 *
 * The label is always associated with its control and the error is announced
 * via aria-describedby, so validation failures reach assistive tech instead of
 * only being visible.
 */
export const Field = ({ label, hint, error, as = "input", id, ...props }) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const Control = as === "textarea" ? "textarea" : "input";
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={`field ${error ? "field-invalid" : ""}`}>
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>

      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}

      <Control
        id={fieldId}
        className={as === "textarea" ? "field-textarea" : "field-input"}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />

      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export default Field;
