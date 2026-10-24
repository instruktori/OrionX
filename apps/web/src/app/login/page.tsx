"use client";
import Link from "next/link";
import {Suspense, useEffect, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {ShieldCheck, LockKeyhole, LogOut, ArrowRight, RefreshCw} from "lucide-react";
import {Shell} from "@/components/shell";
import {startGoogleSignIn, useSession} from "@/lib/session";

function GoogleMark() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {session, loading: sessionLoading, refresh, signOut} = useSession();
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const queryError = searchParams.get("error");
  const nextPath = searchParams.get("next") || "/passport";
  const authCode = searchParams.get("code");

  useEffect(() => {
    if (authCode) {
      const qs = searchParams.toString();
      router.replace(`/auth/callback?${qs}`);
    }
  }, [authCode, router, searchParams]);

  const activeError = error || queryError || "";

  const handleGoogleContinue = async () => {
    setConnecting(true);
    setError("");
    try {
      await startGoogleSignIn(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to Google sign-in");
      setConnecting(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="card auth-card">
        <div className="auth-badge">
          <ShieldCheck size={16} />
          <span>SUPABASE GOOGLE OAUTH · PKCE</span>
        </div>
        <h2>Sign in to OrionX</h2>
        <p className="muted" style={{lineHeight: 1.7, marginBottom: 22}}>
          Authenticate with your personal Gmail or Google Workspace account. Academic records remain protected by explicit{" "}
          <code>StudentIdentity</code> subject bindings.
        </p>

        {activeError && (
          <p role="alert" className="notice" style={{marginTop: 0, marginBottom: 20}}>
            {activeError}
          </p>
        )}

        {sessionLoading ? (
          <p role="status" className="muted" style={{padding: "14px 0"}}>
            Checking active session…
          </p>
        ) : session?.authorized && session.role ? (
          <div className="result-panel" style={{marginTop: 0}}>
            <strong>Signed in as {session.email || session.subject}</strong>
            <p>
              Active role: <span className="pill">{session.role.toUpperCase()}</span>
            </p>
            <div className="page-actions" style={{marginTop: 14}}>
              <Link className="button" href={session.role === "admin" ? "/admin" : "/passport"}>
                Continue to {session.role === "admin" ? "Administration" : "My Passport"} <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  await signOut();
                }}
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        ) : session?.authenticated && !session.authorized ? (
          <div className="result-panel" role="status" style={{marginTop: 0}}>
            <strong>Google identity verified — awaiting record binding</strong>
            <p>
              You are signed in as <b>{session.email || "Google user"}</b>, but this Google account has no authorized{" "}
              <code>StudentIdentity</code> binding yet. Email addresses or domains never automatically grant student or
              administrator access.
            </p>
            <div className="identity-box">
              <span className="mini-kicker">AUTHENTICATED SUPABASE SUBJECT</span>
              <code>{session.subject}</code>
            </div>
            <div className="page-actions" style={{marginTop: 16}}>
              <button type="button" className="button" onClick={() => refresh()}>
                <RefreshCw size={15} /> Check authorization status
              </button>
              <button type="button" className="button secondary" onClick={() => signOut()}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="google-button"
            disabled={connecting}
            onClick={handleGoogleContinue}
          >
            <GoogleMark />
            <span>{connecting ? "Connecting to Google…" : "Continue with Google"}</span>
          </button>
        )}

        <div className="auth-divider" />

        <div className="steps" style={{gap: 10}}>
          <div className="step" style={{padding: 14}}>
            <LockKeyhole size={18} color="#6357dc" style={{flexShrink: 0, marginTop: 2}} />
            <div>
              <strong>Strict authentication &amp; authorization separation</strong>
              <p>
                Signing in with Google proves control of your Google account and creates your Supabase session. Access
                to student passports or operator tools is granted exclusively via server-verified{" "}
                <code>StudentIdentity</code> bindings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Login() {
  return (
    <Shell>
      <div className="eyebrow">SECURE WORKSPACE / SIGN IN</div>
      <h1>Access your passport</h1>
      <p className="lead">
        Continue with Google to access your bound student record or operator workspace. Public verification remains
        available without an account.
      </p>
      <Suspense
        fallback={
          <section className="card" style={{maxWidth: 540}}>
            <p role="status">Loading sign-in…</p>
          </section>
        }
      >
        <LoginContent />
      </Suspense>
    </Shell>
  );
}
