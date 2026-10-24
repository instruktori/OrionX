"use client";
import {useCallback, useEffect, useState} from "react";

export const API = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/+$/, "");

export type Session = {
  authenticated: boolean;
  authorized: boolean;
  role: "student" | "admin" | null;
  studentId?: string;
  subject: string;
  email?: string;
};

const NO_REFRESH_PATHS = ["/auth/google", "/auth/callback", "/auth/login", "/auth/refresh", "/auth/logout"];

export async function api(path: string, options: RequestInit = {}) {
  const request = () =>
    fetch(API + "/api/v1" + path, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && typeof options.body === "string" ? {"Content-Type": "application/json"} : {}),
        ...options.headers,
      },
    });
  let response = await request();
  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refresh = await fetch(API + "/api/v1/auth/refresh", {method: "POST", credentials: "include"});
    if (refresh.ok) response = await request();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error?.message || data.message || "Service unavailable");
  return data;
}

export async function startGoogleSignIn(next = "/passport") {
  const data = await api("/auth/google", {
    method: "POST",
    body: JSON.stringify({next}),
  });
  if (!data?.url || typeof data.url !== "string") {
    throw Error("Unable to initialize Google authentication");
  }
  window.location.assign(data.url);
}

export async function signOutSession() {
  await api("/auth/logout", {method: "POST"});
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextSession = await api("/auth/session");
      setSession(nextSession);
      return nextSession as Session;
    } catch {
      setSession(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutSession();
    } finally {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api("/auth/session")
      .then(s => {
        if (active) setSession(s);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return {session, loading, refresh, signOut};
}
