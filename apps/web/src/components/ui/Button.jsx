import "./ui.css";

const VARIANTS = {
  default: "btn",
  primary: "btn btn-primary",
  danger: "btn btn-danger",
};

/**
 * A button that can show its own pending state.
 *
 * `loading` both disables the button and swaps in a spinner, so callers cannot
 * accidentally leave a form submittable while a request is in flight.
 */
export const Button = ({
  variant = "default",
  size,
  block = false,
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}) => {
  const classes = [
    VARIANTS[variant] ?? VARIANTS.default,
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
};

export default Button;
