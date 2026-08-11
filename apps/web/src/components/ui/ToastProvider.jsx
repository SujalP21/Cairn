import { useCallback, useMemo, useState } from "react";
import { XIcon } from "@primer/octicons-react";
import { ToastContext } from "./toastContext";
import "./ui.css";

let nextId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, body, timeout = 6000 }) => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, title, body }]);

      if (timeout) {
        setTimeout(() => dismiss(id), timeout);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Polite: notifications are informational and must not interrupt. */}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <div>
              <div className="toast-title">{toast.title}</div>
              {toast.body && <div className="toast-body">{toast.body}</div>}
            </div>
            <button
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              type="button"
            >
              <XIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
