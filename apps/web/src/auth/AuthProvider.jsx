import { useState, useEffect, useCallback, useMemo } from "react";
import { AuthContext } from "./context";
import {
  bootstrapSession,
  endSession,
  setOnSessionExpired,
} from "../api/client";

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);

  // True until the initial refresh attempt settles, so the router does not
  // bounce a signed-in user to the login page during the round trip.
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setOnSessionExpired(() => {
      if (!cancelled) setCurrentUser(null);
    });

    bootstrapSession()
      .then((session) => {
        if (!cancelled) setCurrentUser(session?.userId ?? null);
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await endSession();
    setCurrentUser(null);
  }, []);

  // Memoised so consumers do not re-render on every provider render.
  const value = useMemo(
    () => ({ currentUser, setCurrentUser, isBootstrapping, logout }),
    [currentUser, isBootstrapping, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
