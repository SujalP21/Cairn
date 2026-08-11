import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../api/client";
import { getErrorMessage } from "../api/errors";

/**
 * Fetches on mount and exposes { data, error, isLoading, refetch }.
 *
 * Every screen needs the same three states and the old code had none of them —
 * failures went to console.error and the UI just stayed empty forever. Keeping
 * this in one hook means no screen can forget one.
 *
 * Passing `enabled: false` defers the request (e.g. until a user id is known).
 */
export function useQuery(path, { enabled = true, select } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);

  // Guards against setting state after unmount, and against a slow earlier
  // request resolving on top of a newer one.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (!enabled || !path) {
      setIsLoading(false);
      return;
    }

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(path);
      if (!mounted.current || id !== requestId.current) return;
      setData(select ? select(response.data) : response.data);
    } catch (err) {
      if (!mounted.current || id !== requestId.current) return;
      setError(getErrorMessage(err));
    } finally {
      if (mounted.current && id === requestId.current) setIsLoading(false);
    }
    // `select` is intentionally excluded: callers commonly pass an inline
    // function, which would otherwise refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  useEffect(() => {
    void run();
  }, [run]);

  return { data, error, isLoading, refetch: run, setData };
}
