"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import {useEffect, useState} from "react";
import {Clock3, Download, ExternalLink, FileBadge2, GraduationCap, LockKeyhole, ShieldCheck} from "lucide-react";
import {Shell} from "@/components/shell";
import {Badge, EmptyState, ErrorState, PageHeading, Skeleton} from "@/components/ui";
import {API, useSession} from "@/lib/session";
import {useResource} from "@/lib/use-resource";
import {type Passport, type PassportVersion, dateLabel} from "@/lib/passport";

const issuedPdfUrl = (version: number, inline: boolean) =>
  `${API}/api/v1/me/passport/versions/${version}/download${inline ? "?inline=1" : ""}`;

/** Only immutable, finalized issued PDF bytes are shown in this workspace. */
export default function PassportPage() {
  const {t, locale} = useI18n();
  const {session, loading} = useSession();
  const enabled = !!session && (session.role === "student" || !!session.studentId);
  const passport = useResource<Passport>("/me/passport", enabled);
  const issued = !!passport.data?.official && !!passport.data.latest && !!passport.data.passportId;
  const history = useResource<PassportVersion[]>("/me/passport/versions", enabled && issued);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const p = passport.data;
  const latest = p?.latest;
  const selected = history.data?.find(v => v.version === selectedVersion && (v.isLatest || v.finalizedAt)) || latest;

  useEffect(() => {
    setSelectedVersion(null);
  }, [latest?.version, session?.subject]);

  return (
    <Shell>
      <PageHeading
        eyebrow={t("passport.eyebrow")}
        title={t("passport.heading")}
        description={issued ? t("passport.descriptionIssued") : t("passport.descriptionPending")}
      >
        {issued && latest && (
          <a className="button secondary" href={issuedPdfUrl(selected?.version || latest.version, false)}>
            <Download size={15}/> {t("passport.downloadIssued")}
          </a>
        )}
      </PageHeading>

      {loading || passport.loading ? <Skeleton/> :
        !session ? (
          <EmptyState
            icon={LockKeyhole}
            title={t("passport.signInTitle")}
            description={t("passport.signInText")}
            href="/login?next=/passport"
            action={t("common.signIn")}
          />
        ) : !enabled ? (
          <EmptyState
            icon={GraduationCap}
            title={t("passport.noLinked")}
            description={t("passport.noLinkedText")}
            href="/admin"
            action="Open administration"
          />
        ) : passport.error ? (
          <ErrorState message={passport.error} retry={passport.reload}/>
        ) : !issued || !latest ? (
          <section className="passport-unissued-state" role="status" aria-labelledby="passport-unissued-title">
            <span className="passport-unissued-icon"><Clock3 size={28} strokeWidth={1.5}/></span>
            <Badge tone={p?.pending ? "warning" : "neutral"}>{p?.pending ? t("passport.inProgress") : t("passport.notIssued")}</Badge>
            <h2 id="passport-unissued-title">{t("passport.unissuedHeading")}</h2>
            <p>
              {p?.pending
                ? t("passport.pendingText")
                : p?.universityVerified
                  ? t("passport.verifiedNoIssue")
                  : t("passport.unverifiedNoIssue")}
            </p>
            <p className="passport-unissued-note">{t("passport.noID")}</p>
          </section>
        ) : (
          <>
            {p?.pending && (
              <div className="notice" role="status">
                {t("passport.pendingNewer")}
              </div>
            )}
            <section className="passport-issued-only" aria-labelledby="issued-document-title">
              <div className="passport-issued-only-header">
                <div>
                  <div className="eyebrow">{t("passport.finalizedDocument")}</div>
                  <h2 id="issued-document-title">{t("passport.issuedVersion",{version:selected?.version || latest.version})}</h2>
                  <p className="muted">
                    {t("dashboard.passportId")}: <code>{p!.passportId}</code>
                    {selected?.finalizedAt ? ` · ${t("passport.issuedAt",{date:dateLabel(selected.finalizedAt)})}` : ""}
                  </p>
                </div>
                <Badge tone={selected?.isLatest ? "success" : "neutral"}>
                  {selected?.isLatest ? t("passport.latestFinalized") : t("passport.historical")}
                </Badge>
              </div>
              <div className="passport-issued-only-actions">
                <a className="button secondary" href={issuedPdfUrl(selected?.version || latest.version, false)}>
                  <Download size={15}/> {t("passport.downloadExact")}
                </a>
                <a className="button secondary" href={issuedPdfUrl(selected?.version || latest.version, true)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15}/> {t("passport.openPDF")}
                </a>
                <Link className="button secondary" href={`/verify?code=${selected?.verificationCode || latest.verificationCode}`}>
                  <ShieldCheck size={15}/> {t("passport.verify")}
                </Link>
              </div>
              <div className="passport-issued-only-frame">
                <object
                  key={selected?.version || latest.version}
                  data={issuedPdfUrl(selected?.version || latest.version, true)}
                  type="application/pdf"
                  aria-label={t("passport.pdfLabel",{version:selected?.version || latest.version})}
                >
                  <div className="passport-pdf-fallback">
                    <FileBadge2 size={22}/>
                    <p>{t("passport.browser")}</p>
                    <a href={issuedPdfUrl(selected?.version || latest.version, true)} target="_blank" rel="noopener noreferrer">
                      {t("passport.openIssued")}
                    </a>
                  </div>
                </object>
              </div>
              <p className="field-help">{t("passport.trustIntro")} <strong>{selected?.issuerTrust === "BTU_CONFIRMED" ? t("passport.btuConfirmed") : t("passport.demoIssuer")}</strong>.</p>
            </section>
            {!!history.data?.length && history.data.length > 1 && (
              <section className="passport-issued-history" aria-labelledby="passport-versions-title">
                <div className="section-head">
                  <div>
                    <h2 id="passport-versions-title">{t("passport.versions")}</h2>
                    <p className="muted">{t("passport.versionsText")}</p>
                  </div>
                </div>
                <div className="passport-issued-version-list">
                  {history.data.map(version => (
                    <button type="button" key={version.version}
                      aria-pressed={(selected?.version || latest.version) === version.version}
                      onClick={() => setSelectedVersion(version.version)}>
                      <FileBadge2 size={17}/>
                      <span>{t("common.version")} {version.version}</span>
                      <span className="muted">{version.finalizedAt ? dateLabel(version.finalizedAt) : t("common.finalized")}</span>
                      {version.isLatest && <Badge tone="success">{t("common.latest")}</Badge>}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {history.error && <ErrorState message={history.error} retry={history.reload}/>}
          </>
        )}
    </Shell>
  );
}
