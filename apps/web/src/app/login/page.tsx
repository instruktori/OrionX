"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LockKeyhole,
  LogOut,
  ArrowRight,
  Sparkles,
  UserCheck,
  Settings2,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { PassportShowcase } from "@/components/passport-showcase";
import { BrandLogo } from "@/components/brand-logo";
import { startGoogleSignIn, useSession } from "@/lib/session";

function GoogleMark() {
  return (
    <svg
      className="google-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
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
  const {t} = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: sessionLoading, signOut } = useSession();
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const queryError = searchParams.get("error");
  const rawNext = searchParams.get("next");
  const nextPath =
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !/[\\\r\n]/.test(rawNext)
      ? rawNext
      : "/passport";
  const authCode = searchParams.get("code");

  useEffect(() => {
    if (authCode && !authCode.startsWith("D1-")) {
      const qs = searchParams.toString();
      router.replace(`/auth/callback?${qs}`);
    }
  }, [authCode, router, searchParams]);

  useEffect(() => {
    if (!sessionLoading && session?.authorized && session.role && !queryError) {
      const target = rawNext
        ? nextPath
        : session.role === "admin"
          ? "/admin"
          : "/dashboard";
      const timer = setTimeout(() => {
        router.replace(target);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [
    sessionLoading,
    session?.authorized,
    session?.role,
    queryError,
    router,
    searchParams,
  ]);

  const activeError = error || queryError || "";

  const handleGoogleContinue = async () => {
    setConnecting(true);
    setError("");
    try {
      await startGoogleSignIn(nextPath);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("login.connectionError"),
      );
      setConnecting(false);
    }
  };

  return (
    <div className="auth-bento-grid">
      <section className="card auth-card">
        <div style={{ marginBottom: 16 }}>
          <BrandLogo className="auth-logo" width={140} height={36} priority />
        </div>
        <div className="auth-badge">
          <Sparkles size={15} />
          <span>{t("login.badge")}</span>
        </div>
        <h2>{t("login.heading")}</h2>
        <p className="muted" style={{ lineHeight: 1.7, marginBottom: 22 }}>
          {t("login.description")}
        </p>

        {activeError && (
          <p
            role="alert"
            className="notice notice-crimson"
            style={{ marginTop: 0, marginBottom: 20 }}
          >
            {activeError}
          </p>
        )}

        {sessionLoading ? (
          <p role="status" className="muted" style={{ padding: "14px 0" }}>
            {t("login.checking")}
          </p>
        ) : session?.authorized && session.role ? (
          <div className="result-panel" style={{ marginTop: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <strong>{session.email || session.subject}</strong>
              <span
                className={`pill ${session.role === "admin" ? "pill-blue" : "pill-pink"}`}
              >
                {session.role === "admin"
                  ? session.studentId
                    ? t("login.adminDual")
                    : t("login.admin")
                  : session.verification === "UNIVERSITY_VERIFIED"
                    ? t("login.verified")
                    : t("login.student")}
              </span>
            </div>
            <p style={{ marginTop: 8 }}>
              {t("login.redirecting")}
            </p>
            <div className="page-actions" style={{ marginTop: 14 }}>
              <Link
                className="button"
                href={session.role === "admin" ? "/admin" : "/passport"}
              >
                Open{" "}
                {session.role === "admin" ? t("login.openAdmin") : t("login.openPassport")}{" "}
                <ArrowRight size={15} />
              </Link>
              {session.role === "admin" && session.studentId && (
                <Link className="button secondary" href="/passport">
                  {t("login.openStudentPassport")}
                </Link>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={async () => {
                  await signOut();
                }}
              >
                <LogOut size={15} /> {t("common.signOut")}
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
            <span>
              {connecting ? t("login.connecting") : t("login.continue")}
            </span>
          </button>
        )}

        <div className="auth-divider" />

        <div className="steps" style={{ gap: 10 }}>
          <div className="step">
            <UserCheck
              size={18}
              color="var(--pink)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <strong>{t("login.progressTitle")}</strong>
              <p>
                {t("login.progressText")}
              </p>
            </div>
          </div>
          <div className="step">
            <Settings2
              size={18}
              color="var(--primary)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <strong>{t("login.universityTitle")}</strong>
              <p>
                {t("login.universityText")}
              </p>
            </div>
          </div>
          <div className="step">
            <LockKeyhole
              size={18}
              color="var(--cyan)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div>
              <strong>{t("login.privateTitle")}</strong>
              <p>
                {t("login.privateText")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Login() {
  const {t, locale} = useI18n();
  return (
    <Shell>
      <div className="auth-scene">
        <Suspense
          fallback={
            <div className="auth-bento-grid">
              <section className="card auth-card">
                <p role="status">{t("login.loading")}</p>
              </section>
            </div>
          }
        >
          <LoginContent />
        </Suspense>
        <section className="auth-story">
          <div className="eyebrow">{t("login.storyEyebrow")}</div>
          <h1>
            {t("login.storyTitle1")}
            <br />
            {t("login.storyTitle2")}
          </h1>
          <p>
            {t("login.storyText")}
          </p>
          <div className="auth-field">
            <PassportShowcase showHeading={false} />
          </div>
        </section>
      </div>
    </Shell>
  );
}
