"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { PassportPreview } from "@/components/passport-preview";
import { QrShareModal } from "@/components/qr-share-modal";
import {
  ArrowRight,
  Download,
  QrCode,
  ShieldCheck,
  Sparkles,
  FileCheck2,
  Calendar,
  Award as AwardIcon,
  Layers,
  Settings2,
  LogOut,
} from "lucide-react";
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
  official: boolean;
  status: "EMPTY_WORKSPACE" | "ISSUED";
  passportId: string | null;
  workspaceId: string | null;
  universityVerified: boolean;
  account: { email: string | null };
  counts: { skills: number; badges: number; versions: number };
  originalIssueDate: string | null;
  student: {
    firstName: string;
    lastName: string;
    program: string;
    educationLevel: string;
  } | null;
  latest: Version | null;
  pending: boolean;
};

export default function PassportPage() {
  const { session, loading, signOut } = useSession();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [shareTarget, setShareTarget] = useState<{
    version: number;
    code: string;
    isLatest: boolean;
  } | null>(null);

  const canLoadPassport =
    session?.authorized &&
    (session.role === "student" || Boolean(session.studentId));

  useEffect(() => {
    if (canLoadPassport) {
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
  }, [canLoadPassport, session?.subject, retry]);

  const categoryPillClass = (cat: string) =>
    cat.includes("Advanced")
      ? "pill-blue"
      : cat.includes("Applied")
        ? "pill-cyan"
        : "pill-pink";

  return (
    <Shell>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PERSONAL CREDENTIAL WORKSPACE</div>
          <h1>My AI Skills Passport</h1>
          <p className="lead">
            Your permanent passport identity, cumulative skills, downloadable
            PDFs, and verifiable on-chain version history.
          </p>
        </div>
        {session?.role === "admin" && (
          <Link className="button secondary" href="/admin">
            <Settings2 size={16} /> Switch to Admin Console
          </Link>
        )}
      </div>

      {loading ? (
        <p className="loading-state" role="status">
          Loading your workspace…
        </p>
      ) : !session ? (
        <section className="card access-card">
          <div>
            <span className="pill pill-blue" style={{ marginBottom: 10 }}>
              UNIFIED SIGN IN
            </span>
            <h2>Sign in to open your workspace</h2>
            <p className="muted">
              Sign in with Google to view your personal passport or
              administrator workspace, or explore the interactive design
              reference below.
            </p>
          </div>
          <Link className="button" href="/login?next=/passport">
            Sign in <ArrowRight size={16} />
          </Link>
        </section>
      ) : session.role === "admin" && !session.studentId ? (
        <section className="card" style={{ maxWidth: 640 }}>
          <span className="pill pill-blue">ADMINISTRATOR ACCOUNT</span>
          <h2 style={{ marginTop: 14 }}>Administrator Session Active</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            Your Google account (<b>{session.email || session.subject}</b>) is
            configured as an Administrator without a personal student record
            linked. You can manage all student passports or bind a student
            record to your account in the Admin Console.
          </p>
          <div className="page-actions">
            <Link className="button" href="/admin">
              <Settings2 size={16} /> Open Admin Console
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => signOut()}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </section>
      ) : error ? (
        <section className="card">
          <h2>We couldn’t load your passport</h2>
          <p className="notice notice-crimson" role="alert">
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
      ) : passport && (!passport.official || !passport.student) ? (
        <section
          className="card empty-passport"
          aria-labelledby="empty-passport-title"
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              className={`pill ${passport.universityVerified ? "pill-cyan" : "pill-pink"}`}
            >
              {passport.universityVerified
                ? "UNIVERSITY VERIFIED · AWAITING FIRST ISSUANCE"
                : "SELF-REGISTERED WORKSPACE"}
            </span>
          </div>
          <h2 id="empty-passport-title" style={{ marginTop: 18 }}>
            Your AI Skills Passport Workspace
          </h2>
          <p className="muted">
            Your private workspace is active. Verified AI skills, badges, and
            downloadable PDFs appear here automatically once issued by your
            university.
          </p>
          <div className="passport-grid" style={{ marginTop: 22 }}>
            <div className="passport-metric">
              <strong>{passport.counts.skills}</strong>
              <small>Verified skills</small>
            </div>
            <div className="passport-metric">
              <strong>{passport.counts.badges}</strong>
              <small>Earned badges</small>
            </div>
            <div className="passport-metric">
              <strong>{passport.counts.versions}</strong>
              <small>Issued document versions</small>
            </div>
          </div>
          <div className="identity-box" style={{ marginTop: 22 }}>
            <span className="mini-kicker">AUTHENTICATED ACCOUNT</span>
            <code>
              {passport.account.email ||
                session.email ||
                "authenticated account"}
            </code>
          </div>
          {passport.workspaceId && (
            <div className="identity-box" style={{ marginTop: 12 }}>
              <span className="mini-kicker">
                PRIVATE WORKSPACE ID · SHARE WITH ADMIN TO LINK STUDENT RECORD
              </span>
              <code>{passport.workspaceId}</code>
            </div>
          )}
          <p className="notice" style={{ marginTop: 18 }}>
            {passport.universityVerified
              ? "Your account is linked to your university student record. No official passport version has been finalized on-chain yet."
              : "Signing in with Google creates a private workspace. An administrator links this workspace to your official student record before any credential is issued."}
          </p>
          <div className="page-actions" style={{ marginTop: 18 }}>
            <Link className="button secondary" href="/verify">
              <ShieldCheck size={15} /> Public Verifier
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => signOut()}
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </section>
      ) : passport && passport.student ? (
        <>
          <div className="columns">
            <section className="passport-visual">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span className="pill pill-blue">
                  <Sparkles size={12} style={{ marginRight: 5 }} />
                  ISSUED DIGITAL PASSPORT
                </span>
                {passport.pending && (
                  <span className="pill pill-pink">UPDATE IN PROGRESS</span>
                )}
              </div>
              <h2 style={{ fontSize: 32, marginTop: 24, marginBottom: 6 }}>
                {passport.student.firstName} {passport.student.lastName}
              </h2>
              <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                {passport.student.program} · {passport.student.educationLevel}
              </p>

              <div className="identity-box" style={{ marginTop: 20 }}>
                <span className="mini-kicker">
                  PERMANENT PASSPORT IDENTIFIER
                </span>
                <code className="mono" style={{ fontSize: 15 }}>
                  {passport.passportId}
                </code>
              </div>

              <div className="passport-grid">
                <div className="passport-metric">
                  <strong>{passport.latest?.skillAwardCount || 0}</strong>
                  <small>Cumulative awards</small>
                </div>
                <div className="passport-metric">
                  <strong>
                    {passport.latest ? `V${passport.latest.version}` : "Pending"}
                  </strong>
                  <small>Latest finalized version</small>
                </div>
                <div className="passport-metric">
                  <strong>{passport.originalIssueDate}</strong>
                  <small>Original issue date</small>
                </div>
              </div>
            </section>

            <section className="card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <h2 style={{ margin: 0 }}>Latest Verified Credential</h2>
                {passport.latest && (
                  <span className="pill pill-cyan">
                    V{passport.latest.version} · LATEST
                  </span>
                )}
              </div>
              <p className="muted" style={{ marginTop: 10 }}>
                {passport.pending
                  ? "A new cumulative version is currently being processed. Your latest finalized version remains valid and verifiable."
                  : "All cumulative achievements are anchored on Solana Devnet and embedded in your downloadable PDF."}
              </p>
              {passport.latest ? (
                <>
                  <div className="identity-box" style={{ marginTop: 16 }}>
                    <span className="mini-kicker">
                      LATEST VERIFICATION CODE (V{passport.latest.version})
                    </span>
                    <code className="mono">
                      {passport.latest.verificationCode}
                    </code>
                  </div>
                  <div className="page-actions" style={{ marginTop: 20 }}>
                    <a
                      className="button"
                      href={
                        API +
                        "/api/v1/me/passport/versions/" +
                        passport.latest.version +
                        "/download"
                      }
                    >
                      <Download size={15} /> Download Latest PDF (V
                      {passport.latest.version})
                    </a>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setShareTarget({
                          version: passport.latest!.version,
                          code: passport.latest!.verificationCode,
                          isLatest: true,
                        })
                      }
                    >
                      <QrCode size={15} /> Share & QR Code
                    </button>
                    <Link
                      className="button secondary"
                      href={
                        "/verify?code=" + passport.latest.verificationCode
                      }
                    >
                      <FileCheck2 size={15} /> Verify Version
                    </Link>
                  </div>
                </>
              ) : (
                <div className="notice">
                  No finalized credential is available yet. Downloads appear
                  as soon as blockchain registration completes.
                </div>
              )}
            </section>
          </div>

          <div className="section-head">
            <div>
              <h2>Issued Version History</h2>
              <p className="muted">
                Every version preserves the same permanent Passport ID while
                adding new skills cumulatively. Historical versions remain
                authentic and verifiable.
              </p>
            </div>
            <span className="pill pill-blue">
              <Layers size={13} style={{ marginRight: 5 }} />
              {versions.length} {versions.length === 1 ? "Version" : "Versions"}
            </span>
          </div>

          {versions.length ? (
            <div className="version-stack">
              {versions.map((v) => (
                <section className="card version-card" key={v.version}>
                  <div
                    className="section-head"
                    style={{ marginTop: 0, flexWrap: "wrap" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <h2 style={{ margin: 0 }}>Version {v.version}</h2>
                      <span
                        className={`pill ${v.isLatest ? "pill-cyan" : "pill-pink"}`}
                      >
                        {v.isLatest ? "LATEST FINALIZED" : "SUPERSEDED · HISTORICAL"}
                      </span>
                    </div>
                    <div className="page-actions">
                      <button
                        type="button"
                        className="button secondary btn-sm"
                        onClick={() =>
                          setShareTarget({
                            version: v.version,
                            code: v.verificationCode,
                            isLatest: v.isLatest,
                          })
                        }
                      >
                        <QrCode size={14} /> QR & Link
                      </button>
                      <Link
                        className="button secondary btn-sm"
                        href={"/verify?code=" + v.verificationCode}
                      >
                        <ShieldCheck size={14} /> Verify V{v.version}
                      </Link>
                      <a
                        className="button btn-sm"
                        href={
                          API +
                          "/api/v1/me/passport/versions/" +
                          v.version +
                          "/download"
                        }
                      >
                        <Download size={14} /> Download V{v.version} PDF
                      </a>
                    </div>
                  </div>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {v.pageCount} pages · {v.skillAwardCount} cumulative awards ·
                    Code: <code className="mono">{v.verificationCode}</code>
                  </p>
                  <div className="awards-bento-list">
                    {v.awards.map((a) => (
                      <div className="award-item-card" key={a.recordId}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            className={`pill ${categoryPillClass(a.category)}`}
                          >
                            {a.category}
                          </span>
                          <span
                            className="muted mono"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 11,
                            }}
                          >
                            <Calendar size={12} /> {a.dateEarned}
                          </span>
                        </div>
                        <b style={{ display: "block", fontSize: 14 }}>
                          {a.name}
                        </b>
                        <p
                          className="muted"
                          style={{ margin: "6px 0 8px", fontSize: 12 }}
                        >
                          {a.description}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 10,
                            color: "var(--muted)",
                          }}
                        >
                          <span className="mono">
                            <AwardIcon
                              size={11}
                              style={{ verticalAlign: "middle", marginRight: 4 }}
                            />
                            {a.badgeCode}
                          </span>
                          <span className="mono">{a.recordId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="muted">Your issued history will appear here.</p>
          )}

          {shareTarget && passport.passportId && (
            <QrShareModal
              open={true}
              onClose={() => setShareTarget(null)}
              passportId={passport.passportId}
              studentName={
                passport.student
                  ? `${passport.student.firstName} ${passport.student.lastName}`
                  : undefined
              }
              version={shareTarget.version}
              verificationCode={shareTarget.code}
              isLatest={shareTarget.isLatest}
            />
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
