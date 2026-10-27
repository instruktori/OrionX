"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileBadge2,
  GraduationCap,
  Layers3,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeading,
  Skeleton,
} from "@/components/ui";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import { type Passport, type PassportVersion, dateLabel } from "@/lib/passport";
import type { Catalog } from "@/lib/assessments";

export default function Dashboard() {
  const { session, loading } = useSession();
  const eligible =
    !!session && (session.role === "student" || !!session.studentId);
  const passport = useResource<Passport>("/me/passport", eligible);
  const versions = useResource<PassportVersion[]>(
    "/me/passport/versions",
    eligible,
  );
  const exams = useResource<Catalog>("/assessments", !!session);
  const p = passport.data;
  const awards = versions.data?.[0]?.awards || [];
  const name = p?.student?.firstName || session?.email?.split("@")[0];
  return (
    <Shell>
      <PageHeading
        eyebrow="YOUR LEARNING WORKSPACE"
        title={name ? `Welcome back, ${name}.` : "Make your progress count."}
        description="A clear view of your skills, achievements, and what comes next."
      >
        <Link className="button secondary" href="/passport">
          Open passport
          <ArrowUpRight size={15} />
        </Link>
      </PageHeading>
      {loading ? (
        <Skeleton />
      ) : !session ? (
        <EmptyState
          icon={LockKeyhole}
          title="Your progress starts here"
          description="Sign in to see your personal learning record, available assessments, and university-issued credentials."
          href="/login?next=/dashboard"
          action="Sign in to your workspace"
        />
      ) : !eligible ? (
        <EmptyState
          icon={GraduationCap}
          title="Your university workspace is ready"
          description="Manage student records, credential issuance, and assessments from your administration workspace."
          href="/admin"
          action="Open administration"
        />
      ) : passport.error ? (
        <ErrorState message={passport.error} retry={passport.reload} />
      ) : passport.loading ? (
        <Skeleton />
      ) : (
        p && (
          <>
            <section className="dashboard-metrics" aria-label="Your progress">
              {[
                {
                  label: "Skills recorded",
                  value: p.counts.skills,
                  icon: BookOpen,
                  hint: "In finalized passport versions",
                },
                {
                  label: "Earned badges",
                  value: p.counts.badges,
                  icon: Award,
                  hint: "University-recorded achievements",
                },
                {
                  label: "Passport versions",
                  value: p.counts.versions,
                  icon: Layers3,
                  hint: "Your cumulative history",
                },
                {
                  label: "Assessments completed",
                  value: exams.data?.completedCount ?? "—",
                  icon: Check,
                  hint: "Submitted attempts",
                },
              ].map((m) => (
                <div key={m.label} className="dashboard-metric">
                  <div>
                    <span>{m.label}</span>
                    <m.icon size={16} />
                  </div>
                  <strong>{m.value}</strong>
                  <small>{m.hint}</small>
                </div>
              ))}
            </section>
            <div className="dashboard-grid">
              <div>
                <section className="workspace-section">
                  <div className="section-head">
                    <div>
                      <h2>Your next step</h2>
                      <p className="muted">
                        Keep your learning moving forward.
                      </p>
                    </div>
                  </div>
                  {p.pending ? (
                    <div className="next-action">
                      <span className="action-icon">
                        <Clock3 size={23} />
                      </span>
                      <div>
                        <Badge tone="warning">Processing</Badge>
                        <h3>Your passport is being updated</h3>
                        <p>
                          New achievements will appear after the next version is
                          finalized.
                        </p>
                        <Link className="action-link" href="/passport">
                          View version history
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  ) : !p.universityVerified ? (
                    <div className="next-action">
                      <span className="action-icon">
                        <GraduationCap size={23} />
                      </span>
                      <div>
                        <Badge tone="blue">Get connected</Badge>
                        <h3>Connect your university record</h3>
                        <p>
                          Share your workspace identifier with an authorized
                          university administrator to link your student record.
                        </p>
                        <Link className="action-link" href="/passport">
                          Find your workspace ID
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="next-action">
                      <span className="action-icon">
                        <BookOpen size={23} />
                      </span>
                      <div>
                        <Badge tone="blue">Continue learning</Badge>
                        <h3>Put your AI knowledge into practice</h3>
                        <p>
                          Explore published assessments and review the skills
                          they cover.
                        </p>
                        <Link className="action-link" href="/examinations">
                          Browse assessments
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  )}
                </section>
                <section className="workspace-section">
                  <div className="section-head">
                    <div>
                      <h2>Recent achievements</h2>
                      <p className="muted">
                        The latest additions to your record.
                      </p>
                    </div>
                    <Link href="/passport" className="action-link">
                      View all
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                  {versions.error ? (
                    <ErrorState
                      message={versions.error}
                      retry={versions.reload}
                    />
                  ) : awards.length ? (
                    <div className="achievement-list">
                      {awards
                        .slice(-4)
                        .reverse()
                        .map((a) => (
                          <div className="achievement-row" key={a.recordId}>
                            <span className="achievement-icon">
                              <Award size={20} />
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
                  ) : (
                    <div className="inline-empty">
                      <Award size={25} strokeWidth={1.4} />
                      <h3>Room for your first achievement</h3>
                      <p>
                        Skills appear here when your university issues a
                        finalized passport version.
                      </p>
                    </div>
                  )}
                </section>
                <section className="workspace-section">
                  <div className="section-head">
                    <h2>Available assessments</h2>
                    <Link className="action-link" href="/examinations">
                      Explore all
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                  {exams.error ? (
                    <ErrorState message={exams.error} retry={exams.reload} />
                  ) : exams.loading ? (
                    <Skeleton rows={1} />
                  ) : exams.data?.assessments.length ? (
                    <div className="assessment-compact-list">
                      {exams.data.assessments.slice(0, 3).map((a) => (
                        <Link key={a.id} href={`/examinations/${a.id}`}>
                          <span className="action-icon">
                            <BookOpen size={19} />
                          </span>
                          <div>
                            <strong>{a.title}</strong>
                            <small>
                              {a.questionCount} questions ·{" "}
                              {a.durationMinutes
                                ? `${a.durationMinutes} min`
                                : "Untimed"}{" "}
                              · {a.difficulty}
                            </small>
                          </div>
                          <ChevronRight size={17} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="inline-empty compact">
                      <BookOpen size={23} />
                      <p>
                        Your university hasn’t published an assessment yet. New
                        assessments will appear here.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              <aside className="dashboard-aside">
                <section className="passport-summary">
                  <span className="mini-kicker">YOUR DIGITAL PASSPORT</span>
                  <FileBadge2 size={32} strokeWidth={1.3} />
                  <h2>
                    {p.official
                      ? "A growing record."
                      : "Ready for what’s next."}
                  </h2>
                  <p>
                    {p.official
                      ? "Every issued version builds on your achievements."
                      : "Your private workspace is the start of your skills record."}
                  </p>
                  <div className="summary-id">
                    <small>
                      {p.passportId
                        ? "PASSPORT ID"
                        : p.workspaceId
                          ? "WORKSPACE ID"
                          : "UNIVERSITY RECORD"}
                    </small>
                    <code>
                      {p.passportId ||
                        p.workspaceId ||
                        (p.universityVerified
                          ? "Linked · awaiting first issuance"
                          : "Awaiting university link")}
                    </code>
                  </div>
                  <Link className="button secondary" href="/passport">
                    View my passport
                    <ArrowRight size={15} />
                  </Link>
                </section>
                <section className="setup-checklist">
                  <h3>Your passport journey</h3>
                  {[
                    {
                      done: true,
                      title: "Workspace created",
                      desc: "Your private learning space",
                    },
                    {
                      done: p.universityVerified,
                      title: "University record linked",
                      desc: p.universityVerified
                        ? "Connected by your university"
                        : "Your administrator can help",
                    },
                    {
                      done: !!p.latest,
                      title: "First credential issued",
                      desc: p.latest
                        ? `Version ${p.latest.version} finalized`
                        : "Appears after authorized issuance",
                    },
                  ].map((s, i) => (
                    <div key={s.title} className={s.done ? "complete" : ""}>
                      <span>{s.done ? <Check size={12} /> : i + 1}</span>
                      <div>
                        <strong>{s.title}</strong>
                        <small>{s.desc}</small>
                      </div>
                    </div>
                  ))}
                </section>
                <div className="privacy-note">
                  <ShieldCheck size={17} />
                  <p>
                    Your records stay private. You choose which verification
                    links to share.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )
      )}
    </Shell>
  );
}
