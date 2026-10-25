"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { PassportPreview } from "@/components/passport-preview";
import { ArrowRight } from "lucide-react";
import { api, API, useSession } from "@/lib/session";

type Award = {
  recordId: string;
  name: string;
  category: string;
  dateEarned: string;
  description: string;
  badgeCode: string;
};
type Version = {
  version: number;
  state: string;
  verificationCode: string;
  pageCount: number;
  skillAwardCount: number;
  isLatest: boolean;
  awards: Award[];
};
type Passport = {
  passportId: string;
  originalIssueDate: string;
  student: {
    firstName: string;
    lastName: string;
    program: string;
    educationLevel: string;
  };
  latest: Version | null;
  pending: boolean;
};

export default function PassportPage() {
  const { session, loading, refresh, signOut } = useSession();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (session?.authorized && session.role === "student") {
      setError("");
      let active = true;
      setPassport(null);
      setVersions([]);
      Promise.all([api("/me/passport"), api("/me/passport/versions")])
        .then(([p, v]) => {
          if (!active) return;
          setPassport(p);
          setVersions(v);
        })
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Unable to load passport",
            );
        });
      return () => {
        active = false;
      };
    }
  }, [session?.authorized, session?.role, session?.subject, retry]);

  return (
    <Shell>
      <div className="eyebrow">YOUR LEARNING RECORD</div>
      <h1>My AI Skills Passport</h1>
      <p className="lead">
        Your cumulative skills, issued documents and verifiable version history.
      </p>
      {loading ? (
        <p className="loading-state" role="status">
          Loading your session…
        </p>
      ) : !session ? (
        <section className="card access-card">
          <div>
            <h2>Sign in to view your passport</h2>
            <p className="muted">
              Your personal documents are private. Sign in to access your
              record, or explore the design below.
            </p>
          </div>
          <Link className="button" href="/login?next=/passport">
            Continue with Google <ArrowRight size={16} />
          </Link>
        </section>
      ) : !session.authorized || !session.role ? (
        <section className="card" style={{ maxWidth: 640 }}>
          <h2>Your account isn’t linked to a student record yet</h2>
          <p role="alert" className="notice">
            Signed in with Google as{" "}
            <b>{session.email || "authenticated user"}</b>. Ask your university
            administrator to link this account to your record, then check again.
          </p>
          <div className="identity-box">
            <span className="mini-kicker">
              ACCOUNT REFERENCE FOR YOUR ADMINISTRATOR
            </span>
            <code>{session.subject}</code>
          </div>
          <div className="page-actions" style={{ marginTop: 18 }}>
            <button type="button" className="button" onClick={() => refresh()}>
              Check account access
            </button>
            <Link className="button secondary" href="/verify">
              Public verifier
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      ) : session.role === "admin" && !session.studentId ? (
        <section className="card" style={{ maxWidth: 560 }}>
          <h2>Signed in as Administrator</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            Administrator accounts manage synchronization and ledger inspection
            and are not bound to an individual student passport.
          </p>
          <div className="page-actions">
            <Link className="button" href="/admin">
              Open Administration
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      ) : error ? (
        <section className="card">
          <h2>We couldn’t load your passport</h2>
          <p className="notice" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </section>
      ) : passport ? (
        <>
          <div className="columns">
            <section className="passport-visual">
              <span className="pill">DEMO IDENTITY</span>
              <h2 style={{ fontSize: 30, marginTop: 35 }}>
                {passport.student.firstName} {passport.student.lastName}
              </h2>
              <p>
                {passport.student.program} · {passport.student.educationLevel}
              </p>
              <p className="mini-kicker">PERMANENT PASSPORT IDENTIFIER</p>
              <strong>{passport.passportId}</strong>
              <div className="passport-grid">
                <div className="passport-metric">
                  <strong>{passport.latest?.skillAwardCount || 0}</strong>
                  <small>Issued awards</small>
                </div>
                <div className="passport-metric">
                  <strong>{passport.latest?.version || "Pending"}</strong>
                  <small>Latest issued version</small>
                </div>
              </div>
            </section>
            <section className="card">
              <h2>Passport details</h2>
              <p>
                Original issue date:{" "}
                <strong>{passport.originalIssueDate}</strong>
              </p>
              <p>
                {passport.pending
                  ? "An update is being processed."
                  : "No update is currently in progress."}
              </p>
              {passport.latest ? (
                <>
                  <p className="muted">
                    Version code: {passport.latest.verificationCode}
                  </p>
                  <a
                    className="button"
                    href={
                      API +
                      "/api/v1/me/passport/versions/" +
                      passport.latest.version +
                      "/download"
                    }
                  >
                    Download latest PDF
                  </a>
                  <Link
                    className="button secondary"
                    style={{ marginTop: 12 }}
                    href={"/verify?code=" + passport.latest.verificationCode}
                  >
                    Verify this version
                  </Link>
                </>
              ) : (
                <div className="notice">
                  No finalized credential is available yet. Downloads appear
                  after blockchain registration completes.
                </div>
              )}
            </section>
          </div>
          <div className="section-head">
            <h2>Issued version history</h2>
          </div>
          {versions.length ? (
            versions.map((v) => (
              <section
                className="card"
                key={v.version}
                style={{ marginBottom: 20 }}
              >
                <div className="section-head" style={{ marginTop: 0 }}>
                  <h2>Version {v.version}</h2>
                  <span className="pill">
                    {v.isLatest ? "LATEST" : "SUPERSEDED"}
                  </span>
                </div>
                <p className="muted">
                  {v.pageCount} pages · {v.skillAwardCount} cumulative awards ·{" "}
                  {v.verificationCode}
                </p>
                {v.awards.map((a) => (
                  <div className="skill" key={a.recordId}>
                    <div>
                      <b>{a.name}</b>
                      <small>
                        {a.category} · Earned {a.dateEarned} · {a.badgeCode}
                      </small>
                      <p className="muted">{a.description}</p>
                    </div>
                  </div>
                ))}
                <a
                  className="button secondary"
                  href={
                    API +
                    "/api/v1/me/passport/versions/" +
                    v.version +
                    "/download"
                  }
                >
                  Download V{v.version}
                </a>
              </section>
            ))
          ) : (
            <p className="muted">Your issued history will appear here.</p>
          )}
        </>
      ) : (
        <p className="loading-state" role="status">
          Loading passport…
        </p>
      )}
      <PassportPreview />
    </Shell>
  );
}
