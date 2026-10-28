"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
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

export default function Dashboard() {
  const {t, locale} = useI18n();
  const { session, loading } = useSession();
  const eligible =
    !!session && (session.role === "student" || !!session.studentId);
  const passport = useResource<Passport>("/me/passport", eligible);
  const versions = useResource<PassportVersion[]>(
    "/me/passport/versions",
    eligible,
  );
  const p = passport.data;
  const awards = versions.data?.[0]?.awards || [];
  const name = p?.student?.firstName || session?.email?.split("@")[0];
  return (
    <Shell>
      <PageHeading
        eyebrow={t("dashboard.eyebrow")}
        title={name ? t("dashboard.welcome", {name}) : t("dashboard.title")}
        description={t("dashboard.description")}
      >
        <Link className="button secondary" href="/passport">
          {t("dashboard.open")}
          <ArrowUpRight size={15} />
        </Link>
      </PageHeading>
      {loading ? (
        <Skeleton />
      ) : !session ? (
        <EmptyState
          icon={LockKeyhole}
          title={t("dashboard.startTitle")}
          description={t("dashboard.startText")}
          href="/login?next=/dashboard"
          action={t("dashboard.startAction")}
        />
      ) : !eligible ? (
        <EmptyState
          icon={GraduationCap}
          title={t("dashboard.readyTitle")}
          description={t("dashboard.readyText")}
          href="/admin"
          action={t("dashboard.openAdmin")}
        />
      ) : passport.error ? (
        <ErrorState message={passport.error} retry={passport.reload} />
      ) : passport.loading ? (
        <Skeleton />
      ) : (
        p && (
          <>
            <section className="dashboard-metrics" aria-label={t("dashboard.progress")}>
              {[
                {
                  label: t("dashboard.skillsRecorded"),
                  value: p.counts.skills,
                  icon: BookOpen,
                  hint: t("dashboard.skillsHint"),
                },
                {
                  label: t("dashboard.badges"),
                  value: p.counts.badges,
                  icon: Award,
                  hint: t("dashboard.badgesHint"),
                },
                {
                  label: t("dashboard.versions"),
                  value: p.counts.versions,
                  icon: Layers3,
                  hint: t("dashboard.versionsHint"),
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
                      <h2>{t("dashboard.next")}</h2>
                      <p className="muted">
                        {t("dashboard.keepLearning")}
                      </p>
                    </div>
                  </div>
                  {p.pending ? (
                    <div className="next-action">
                      <span className="action-icon">
                        <Clock3 size={23} />
                      </span>
                      <div>
                        <Badge tone="warning">{t("dashboard.processing")}</Badge>
                        <h3>{t("dashboard.updating")}</h3>
                        <p>
                          New achievements will appear after the next version is
                          finalized.
                        </p>
                        <Link className="action-link" href="/passport">
                          {t("dashboard.history")}
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
                        <Badge tone="blue">{t("dashboard.getConnected")}</Badge>
                        <h3>{t("dashboard.connect")}</h3>
                        <p>
                          {t("dashboard.connectBefore")} <strong>{t("dashboard.workspaceId")}</strong> with an authorized
                          university administrator to link your student record. This is not a Passport ID.
                        </p>
                        {p.workspaceId ? (
                          <div className="identity-box">
                            <span className="mini-kicker">{t("dashboard.workspaceNote")}</span>
                            <code>{p.workspaceId}</code>
                          </div>
                        ) : (
                          <p className="muted">{t("dashboard.idPending")}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="next-action">
                      <span className="action-icon">
                        <BookOpen size={23} />
                      </span>
                      <div>
                        <Badge tone="blue">{t("dashboard.yourPassport")}</Badge>
                        <h3>{t("dashboard.gather")}</h3>
                        <p>
                          View your recorded skills, download issued versions,
                          and share a credential verification link.
                        </p>
                        <Link className="action-link" href="/passport">
                          {t("dashboard.viewPassport")}
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  )}
                </section>
                <section className="workspace-section">
                  <div className="section-head">
                    <div>
                      <h2>{t("dashboard.recent")}</h2>
                      <p className="muted">
                        {t("dashboard.recentText")}
                      </p>
                    </div>
                    <Link href="/passport" className="action-link">
                      {t("dashboard.viewAll")}
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
                      <h3>{t("dashboard.empty")}</h3>
                      <p>
                        Skills appear here when your university issues a
                        finalized passport version.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              <aside className="dashboard-aside">
                <section className="passport-summary">
                  <span className="mini-kicker">{t("dashboard.passportEyebrow")}</span>
                  <FileBadge2 size={32} strokeWidth={1.3} />
                  <h2>
                    {p.official
                      ? t("dashboard.growing")
                      : t("dashboard.ready")}
                  </h2>
                  <p>
                    {p.official
                      ? t("dashboard.growingText")
                      : t("dashboard.readyText2")}
                  </p>
                  <div className="summary-id">
                    <small>{p.official && p.latest ? t("dashboard.passportId") : t("dashboard.issuanceStatus")}</small>
                    <code>{p.official && p.latest && p.passportId ? p.passportId : t("dashboard.noId")}</code>
                  </div>
                  <Link className="button secondary" href="/passport">
                    {t("dashboard.viewMy")}
                    <ArrowRight size={15} />
                  </Link>
                </section>
                <section className="setup-checklist">
                  <h3>{t("dashboard.journey")}</h3>
                  {[
                    {
                      done: true,
                      title: t("dashboard.created"),
                      desc: t("dashboard.createdText"),
                    },
                    {
                      done: p.universityVerified,
                      title: t("dashboard.linked"),
                      desc: p.universityVerified
                        ? t("dashboard.connected")
                        : t("dashboard.help"),
                    },
                    {
                      done: !!p.latest,
                      title: t("dashboard.firstIssued"),
                      desc: p.latest
                        ? t("dashboard.finalizedVersion",{version:p.latest.version})
                        : t("dashboard.issuance"),
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
