import { createContext } from "react";

// Lives apart from the provider so that neither the context object nor the
// useAuth hook shares a module with a component — React Fast Refresh only works
// when a file exports components exclusively.
export const AuthContext = createContext(null);
