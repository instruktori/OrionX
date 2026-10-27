"use client";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const API = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(
  /\/+$/,
  "",
);

export type Session = {
  authenticated: boolean;
  authorized: boolean;
  role: "student" | "admin" | null;
  verification?: "SELF_REGISTERED" | "UNIVERSITY_VERIFIED" | "ADMIN" | null;
  workspaceId?: string;
  studentId?: string;
  subject: string;
  email?: string;
};

const NO_REFRESH_PATHS = [
  "/auth/google",
  "/auth/callback",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
];

export async function api(path: string, options: RequestInit = {}) {
  const request = () =>
    fetch(API + "/api/v1" + path, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body && typeof options.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  let response = await request();
  if (response.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refresh = await fetch(API + "/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (refresh.ok) response = await request();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(data.error?.message || data.message || "Service unavailable");
  return data;
}

export async function startGoogleSignIn(next = "/passport") {
  const data = await api("/auth/google", {
    method: "POST",
    body: JSON.stringify({ next }),
  });
  if (!data?.url || typeof data.url !== "string") {
    throw Error("Unable to initialize Google authentication");
  }
  window.location.assign(data.url);
}

export async function signOutSession() {
  await api("/auth/logout", { method: "POST" });
}

function useSessionState() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const nextSession = await api("/auth/session");
      if (mounted.current && requestId === requestSequence.current)
        setSession(nextSession);
      return nextSession as Session;
    } catch {
      if (mounted.current && requestId === requestSequence.current)
        setSession(null);
      return null;
    } finally {
      if (mounted.current && requestId === requestSequence.current)
        setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutSession();
    requestSequence.current++;
    setSession(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      requestSequence.current++;
    };
  }, [refresh]);

  return { session, loading, refresh, signOut };
}

const SessionContext = createContext<ReturnType<typeof useSessionState> | null>(
  null,
);
export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSessionState();
  return createElement(SessionContext.Provider, { value }, children);
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("SessionProvider is required");
  return context;
}
