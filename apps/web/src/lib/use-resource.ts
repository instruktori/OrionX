"use client";
import { useEffect, useState } from "react";
import { api } from "./session";
export function useResource<T>(path: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    api(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to load this workspace",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, enabled, retry]);
  return { data, error, loading, reload: () => setRetry((n) => n + 1) };
}
