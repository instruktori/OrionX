"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, AlertTriangle, ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { api, useSession } from "@/lib/session";

function CallbackHandler() {
  const {t} = useI18n();
  const router = useRouter();
  const { refresh } = useSession();
  const searchParams = useSearchParams();
  const handled = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const hashParams = new URLSearchParams(
      typeof window !== "undefined" && window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "",
    );
    if (hashParams.get("access_token")) {
      setError(
        t("auth.security"),
      );
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
      setError(errorDescription || t("auth.denied"));
      return;
    }

    if (!code) {
      setError(t("auth.missingCode"));
      return;
    }

    api("/auth/callback", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    })
      .then(async (result) => {
        // The root provider survives client navigation. Refresh it after the
        // callback sets HttpOnly cookies, before opening the private workspace.
        await refresh();
        const destination =
          typeof result?.redirectTo === "string" &&
          result.redirectTo.startsWith("/")
            ? result.redirectTo
            : result?.role === "admin"
              ? "/admin"
              : "/passport";
        router.replace(destination);
        router.refresh();
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : t("auth.failed"),
        );
      });
  }, [router, searchParams]);

  return (
    <section className="card auth-card">
      {error ? (
        <>
          <div
            className="auth-badge"
            style={{ background: "var(--notice)", color: "var(--notice-ink)" }}
          >
            <AlertTriangle size={16} />
            <span>{t("auth.attention")}</span>
          </div>
          <h2>{t("auth.unable")}</h2>
          <p role="alert" className="notice" style={{ marginTop: 12 }}>
            {error}
          </p>
          <div className="page-actions" style={{ marginTop: 18 }}>
            <Link className="button" href="/login">
              <ArrowLeft size={15} /> {t("auth.back")}
            </Link>
            <Link className="button secondary" href="/verify">
              {t("auth.verifier")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="auth-badge">
            <ShieldCheck size={16} />
            <span>{t("auth.checking")}</span>
          </div>
          <h2>{t("auth.completing")}</h2>
          <p role="status" className="muted" style={{ lineHeight: 1.7 }}>
            {t("auth.confirming")}
          </p>
        </>
      )}
    </section>
  );
}

export default function AuthCallbackPage() {
  const {t, locale} = useI18n();
  return (
    <Shell>
      <div className="eyebrow">{t("auth.secure")}</div>
      <h1>{t("auth.connecting")}</h1>
      <p className="lead">
        {t("auth.access")}
      </p>
      <Suspense
        fallback={
          <section className="card auth-card">
            <p role="status">{t("auth.google")}</p>
          </section>
        }
      >
        <CallbackHandler />
      </Suspense>
    </Shell>
  );
}
