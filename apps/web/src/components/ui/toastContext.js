import { createContext, useContext } from "react";

// Context and hook live apart from the provider component so that neither file
// mixes components with non-components — React Fast Refresh only works when a
// module exports components exclusively.
export const ToastContext = createContext(null);

export function useToasts() {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error("useToasts must be used inside a <ToastProvider>");
  }

  return context;
}
