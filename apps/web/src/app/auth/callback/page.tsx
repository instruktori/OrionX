"use client";
import Link from "next/link";
import {Suspense, useEffect, useRef, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {ShieldCheck, AlertTriangle, ArrowLeft} from "lucide-react";
import {Shell} from "@/components/shell";
import {api} from "@/lib/session";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const hashParams = new URLSearchParams(
      typeof window !== "undefined" && window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "",
    );
    if (hashParams.get("access_token")) {
      setError("Implicit OAuth flow is disabled for security. Please sign in using the PKCE flow.");
      return;
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state") || undefined;
    const oauthError = searchParams.get("error") || hashParams.get("error");
    const errorDescription =
      searchParams.get("error_description") ||
      searchParams.get("errorDescription") ||
      hashParams.get("error_description");

    if (oauthError) {
      setError(errorDescription || "Google sign-in was cancelled or denied.");
      return;
    }

    if (!code) {
      setError("Missing OAuth authorization code. Please start sign-in again.");
      return;
    }

    api("/auth/callback", {
      method: "POST",
      body: JSON.stringify({code, state}),
    })
      .then(result => {
        const destination =
          typeof result?.redirectTo === "string" && result.redirectTo.startsWith("/")
            ? result.redirectTo
            : result?.role === "admin"
              ? "/admin"
              : "/passport";
        router.replace(destination);
        router.refresh();
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : "Unable to complete Google sign-in");
      });
  }, [router, searchParams]);

  return (
    <section className="card auth-card">
      {error ? (
        <>
          <div className="auth-badge" style={{background: "#fff4e5", color: "#9a6700"}}>
            <AlertTriangle size={16} />
            <span>AUTHENTICATION CALLBACK ERROR</span>
          </div>
          <h2>Unable to complete sign-in</h2>
          <p role="alert" className="notice" style={{marginTop: 12}}>
            {error}
          </p>
          <div className="page-actions" style={{marginTop: 18}}>
            <Link className="button" href="/login">
              <ArrowLeft size={15} /> Return to sign in
            </Link>
            <Link className="button secondary" href="/verify">
              Public verifier
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="auth-badge">
            <ShieldCheck size={16} />
            <span>VERIFYING GOOGLE OAUTH SESSION</span>
          </div>
          <h2>Completing sign-in…</h2>
          <p role="status" className="muted" style={{lineHeight: 1.7}}>
            Exchanging PKCE authorization code with Supabase and verifying your cryptographic identity binding.
          </p>
        </>
      )}
    </section>
  );
}

export default function AuthCallbackPage() {
  return (
    <Shell>
      <div className="eyebrow">SECURE WORKSPACE / OAUTH CALLBACK</div>
      <h1>Google Authentication</h1>
      <p className="lead">Validating your Google session and checking authorized student or administrator bindings.</p>
      <Suspense
        fallback={
          <section className="card auth-card">
            <p role="status">Completing Google sign-in…</p>
          </section>
        }
      >
        <CallbackHandler />
      </Suspense>
    </Shell>
  );
}
