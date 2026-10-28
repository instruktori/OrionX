"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Award as AwardIcon,
  BookOpen,
  ChevronRight,
  Copy,
  Download,
  FileBadge2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { BtuPassportReplica } from "@/components/btu-passport-replica";
import { QrShareModal } from "@/components/qr-share-modal";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeading,
  Skeleton,
} from "@/components/ui";
import { API, useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import { type Passport, type PassportVersion, dateLabel } from "@/lib/passport";

export default function PassportPage() {
  const { session, loading } = useSession();
  const enabled =
    !!session && (session.role === "student" || !!session.studentId);
  const {
    data: p,
    error,
    loading: pending,
    reload,
  } = useResource<Passport>("/me/passport", enabled);
  const history = useResource<PassportVersion[]>(
    "/me/passport/versions",
    enabled,
  );
  const [share, setShare] = useState<PassportVersion | null>(null);
  const [category, setCategory] = useState("All skills");
  const [copyStatus, setCopyStatus] = useState("");
  const awards = history.data?.[0]?.awards || [];
  const categories = ["All skills", ...new Set(awards.map((a) => a.category))];
  const filtered = awards.filter(
    (a) => category === "All skills" || a.category === category,
  );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("Workspace identifier copied");
    } catch {
      setCopyStatus("Couldn’t copy. Select and copy the identifier above.");
    }
    setTimeout(() => setCopyStatus(""), 4000);
  }
  return (
    <Shell>
      <PageHeading
        eyebrow="YOUR PERMANENT LEARNING RECORD"
        title="My AI Skills Passport"
        description="One identity. Every achievement. A record that grows with you."
      >
        {p?.latest && (
          <a
            className="button secondary"
            href={`${API}/api/v1/me/passport/versions/${p.latest.version}/download`}
          >
            <Download size={15} />
            Download latest PDF
          </a>
        )}
      </PageHeading>
      {loading || pending ? (
        <Skeleton />
      ) : !session ? (
        <EmptyState
          icon={LockKeyhole}
          title="Your skills have a home here"
          description="Sign in to open your private passport, see your achievements, and download issued credentials."
          href="/login?next=/passport"
          action="Sign in to your passport"
        />
      ) : !enabled ? (
        <EmptyState
          icon={GraduationCap}
          title="You’re in your administrator account"
          description="Your account isn’t linked to a personal student record. You can manage student passports from your university workspace."
          href="/admin"
          action="Open administration"
        />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        p && (
          <>
            <BtuPassportReplica passport={p} awards={awards} />
            <div className="passport-layout passport-summary-layout">
              <section className="passport-detail">
                <div className="section-head" style={{ marginTop: 0 }}>
                  <h2>
                    {p.latest
                      ? "Your current credential"
                      : "Your workspace is ready"}
                  </h2>
                  <Badge tone={p.latest ? "blue" : "neutral"}>
                    {p.latest ? `Version ${p.latest.version}` : "Pre-issuance"}
                  </Badge>
                </div>
                <p className="muted">
                  {p.latest
                    ? "Your latest finalized passport includes every achievement recorded in this version. Share a verification link to let others check its proof."
                    : p.universityVerified
                      ? "Your university record is linked. Your first issued passport will appear here once processing and blockchain registration are complete."
                      : "Your private workspace is active. An authorized university administrator can connect it to your student record."}
                </p>
                <div className="passport-grid">
                  {[
                    { value: p.counts.skills, label: "Recorded skills" },
                    { value: p.counts.badges, label: "Earned badges" },
                    { value: p.counts.versions, label: "Issued versions" },
                  ].map((m) => (
                    <div className="passport-metric" key={m.label}>
                      <strong>{m.value}</strong>
                      <small>{m.label}</small>
                    </div>
                  ))}
                </div>
                <div className="identity-box" style={{ marginTop: 24 }}>
                  <span className="mini-kicker">
                    {p.passportId
                      ? "PERMANENT PASSPORT IDENTIFIER"
                      : p.workspaceId
                        ? "PRIVATE WORKSPACE IDENTIFIER"
                        : "UNIVERSITY RECORD"}
                  </span>
                  <code>
                    {p.passportId ||
                      p.workspaceId ||
                      (p.universityVerified
                        ? "Linked · awaiting first issuance"
                        : "Awaiting university record")}
                  </code>
                </div>
                {p.latest ? (
                  <div className="page-actions" style={{ marginTop: 20 }}>
                    <Button onClick={() => setShare(p.latest)}>
                      <QrCode size={15} />
                      Share credential
                    </Button>
                    <Link
                      className="button secondary"
                      href={`/verify?code=${p.latest.verificationCode}`}
                    >
                      <ShieldCheck size={15} />
                      Check proof
                    </Link>
                  </div>
                ) : (
                  p.workspaceId && (
                    <Button
                      secondary
                      className="btn-sm"
                      style={{ marginTop: 16 }}
                      onClick={() => void copy(p.workspaceId!)}
                    >
                      <Copy size={13} />
                      Copy workspace ID
                    </Button>
                  )
                )}
                {p.latest && (
                  <p className="field-help" style={{ marginBottom: 0 }}>
                    {p.latest.issuerTrust === "BTU_CONFIRMED"
                      ? "University-confirmed issuer"
                      : "Demo issuer"}{" "}
                    · Solana {p.latest.cluster || "devnet"}
                    {p.originalIssueDate
                      ? ` · First issued ${dateLabel(p.originalIssueDate)}`
                      : ""}
                  </p>
                )}
                {!p.official && (
                  <p className="field-help" style={{ marginBottom: 0 }}>
                    A workspace identifier is private and is separate from an
                    issued passport or credential.
                  </p>
                )}
              </section>
            </div>
            {p.pending && (
              <div className="notice">
                A new passport version is being processed. Existing finalized
                versions remain available below.
              </div>
            )}
            <section style={{ marginTop: 40 }}>
              <div className="section-head">
                <div>
                  <h2>Your skill collection</h2>
                  <p className="muted">
                    Achievements from your latest finalized passport.
                  </p>
                </div>
                <Badge>
                  {awards.length} {awards.length === 1 ? "skill" : "skills"}
                </Badge>
              </div>
              {history.error ? (
                <ErrorState message={history.error} retry={history.reload} />
              ) : history.loading ? (
                <Skeleton rows={2} />
              ) : awards.length ? (
                <>
                  <div
                    className="filter-group"
                    role="group"
                    aria-label="Filter your skills"
                    style={{ marginBottom: 20 }}
                  >
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="passport-achievements">
                    {filtered.map((a) => (
                      <article
                        className="passport-achievement"
                        key={a.recordId}
                      >
                        <AwardIcon size={24} strokeWidth={1.4} />
                        <div>
                          <Badge
                            tone={
                              a.category.includes("Applied")
                                ? "success"
                                : "neutral"
                            }
                          >
                            {a.category}
                          </Badge>
                          <h3>{a.name}</h3>
                          <p>{a.description}</p>
                          <small>
                            <time dateTime={a.dateEarned}>
                              {dateLabel(a.dateEarned)}
                            </time>{" "}
                            · <span className="mono">{a.badgeCode}</span>
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={AwardIcon}
                  title="Your first achievement belongs here"
                  description="Eligible skills and badges appear here when your university issues a finalized passport."
                />
              )}
            </section>
            <section style={{ marginTop: 40 }}>
              <div className="section-head">
                <div>
                  <h2>Achievement & version history</h2>
                  <p className="muted">
                    A cumulative record with the same permanent passport
                    identity.
                  </p>
                </div>
                <Layers3 size={18} className="muted" />
              </div>
              {history.data?.length ? (
                <div className="passport-history">
                  {history.data.map((v) => (
                    <details key={v.version}>
                      <summary>
                        <FileBadge2 size={18} />
                        <span>Version {v.version}</span>
                        <Badge tone={v.isLatest ? "blue" : "neutral"}>
                          {v.isLatest ? "Latest finalized" : "Historical"}
                        </Badge>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {v.skillAwardCount} awards
                        </span>
                        <ChevronRight size={15} />
                      </summary>
                      <div className="version-meta">
                        <span>
                          {v.finalizedAt
                            ? dateLabel(v.finalizedAt)
                            : "Finalized"}
                        </span>
                        <span>{v.pageCount} pages</span>
                        <code>{v.verificationCode}</code>
                      </div>
                      <div className="page-actions">
                        <a
                          className="button secondary btn-sm"
                          href={`${API}/api/v1/me/passport/versions/${v.version}/download`}
                        >
                          <Download size={13} />
                          Download PDF
                        </a>
                        <Button
                          secondary
                          className="btn-sm"
                          onClick={() => setShare(v)}
                        >
                          <QrCode size={13} />
                          Share link & QR
                        </Button>
                        <Link
                          className="button secondary btn-sm"
                          href={`/verify?code=${v.verificationCode}`}
                        >
                          <ShieldCheck size={13} />
                          Verify version
                        </Link>
                      </div>
                      <div
                        className="achievement-list"
                        style={{ marginTop: 20 }}
                      >
                        {v.awards.map((a) => (
                          <div className="achievement-row" key={a.recordId}>
                            <span className="achievement-icon">
                              <BookOpen size={17} />
                            </span>
                            <div>
                              <strong>{a.name}</strong>
                              <span>{a.category}</span>
                            </div>
                            <time dateTime={a.dateEarned}>
                              {dateLabel(a.dateEarned)}
                            </time>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="results-empty">
                  Your issued versions will appear here. Every version preserves
                  its own verifiable history.
                </p>
              )}
            </section>
            {share && p.passportId && (
              <QrShareModal
                open
                onClose={() => setShare(null)}
                passportId={p.passportId}
                studentName={
                  p.student
                    ? `${p.student.firstName} ${p.student.lastName}`
                    : undefined
                }
                version={share.version}
                verificationCode={share.verificationCode}
                isLatest={share.isLatest}
              />
            )}
          </>
        )
      )}
      {copyStatus && (
        <div className="toast" role="status">
          {copyStatus}
        </div>
      )}
    </Shell>
  );
}
