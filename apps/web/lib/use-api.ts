"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

/** Loads a JSON endpoint and keeps it in state. `path = null` waits. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    const r = await api<T>(path);
    if (n !== seq.current) return;
    setLoading(false);
    if (r.ok) {
      setData(r.data);
      setError(null);
    } else {
      setError(r.message);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
