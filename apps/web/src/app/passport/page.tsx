"use client";

import Link from "next/link";
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
        eyebrow="YOUR UNIVERSITY-ISSUED CREDENTIAL"
        title="My AI Skills Passport"
        description={issued ? "View or download the exact PDF issued for your student record." : "Your passport will appear here once it has been issued."}
      >
        {issued && latest && (
          <a className="button secondary" href={issuedPdfUrl(selected?.version || latest.version, false)}>
            <Download size={15}/> Download issued PDF
          </a>
        )}
      </PageHeading>

      {loading || passport.loading ? <Skeleton/> :
        !session ? (
          <EmptyState
            icon={LockKeyhole}
            title="Sign in to view your passport"
            description="Your issued university passport is private. Sign in with your account to view or download it."
            href="/login?next=/passport"
            action="Sign in"
          />
        ) : !enabled ? (
          <EmptyState
            icon={GraduationCap}
            title="No student passport is linked to this account"
            description="This is an administrator account without a linked student record. Only a student with a finalized passport can view an issued document."
            href="/admin"
            action="Open administration"
          />
        ) : passport.error ? (
          <ErrorState message={passport.error} retry={passport.reload}/>
        ) : !issued || !latest ? (
          <section className="passport-unissued-state" role="status" aria-labelledby="passport-unissued-title">
            <span className="passport-unissued-icon"><Clock3 size={28} strokeWidth={1.5}/></span>
            <Badge tone={p?.pending ? "warning" : "neutral"}>{p?.pending ? "Issuance in progress" : "Not issued"}</Badge>
            <h2 id="passport-unissued-title">You don’t have an issued Digital Passport yet.</h2>
            <p>
              {p?.pending
                ? "Your first passport is being processed. It will be available after the PDF has been finalized and its issuance recorded."
                : p?.universityVerified
                  ? "Your university account is connected, but no passport has been issued. Your university administrator will make it available when issuance is complete."
                  : "Your account does not yet have an issued passport. An authorized university administrator must connect your student record and issue the document."}
            </p>
            <p className="passport-unissued-note">You do not have an issued Passport ID, a document to preview or a PDF to download.</p>
          </section>
        ) : (
          <>
            {p?.pending && (
              <div className="notice" role="status">
                A newer passport version is being processed. Your last finalized PDF remains available below.
              </div>
            )}
            <section className="passport-issued-only" aria-labelledby="issued-document-title">
              <div className="passport-issued-only-header">
                <div>
                  <div className="eyebrow">FINALIZED DOCUMENT</div>
                  <h2 id="issued-document-title">Issued PDF · Version {selected?.version || latest.version}</h2>
                  <p className="muted">
                    Passport ID: <code>{p!.passportId}</code>
                    {selected?.finalizedAt ? ` · Issued ${dateLabel(selected.finalizedAt)}` : ""}
                  </p>
                </div>
                <Badge tone={selected?.isLatest ? "success" : "neutral"}>
                  {selected?.isLatest ? "Latest finalized" : "Historical version"}
                </Badge>
              </div>
              <div className="passport-issued-only-actions">
                <a className="button secondary" href={issuedPdfUrl(selected?.version || latest.version, false)}>
                  <Download size={15}/> Download exact PDF
                </a>
                <a className="button secondary" href={issuedPdfUrl(selected?.version || latest.version, true)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15}/> Open PDF
                </a>
                <Link className="button secondary" href={`/verify?code=${selected?.verificationCode || latest.verificationCode}`}>
                  <ShieldCheck size={15}/> Verify document
                </Link>
              </div>
              <div className="passport-issued-only-frame">
                <object
                  key={selected?.version || latest.version}
                  data={issuedPdfUrl(selected?.version || latest.version, true)}
                  type="application/pdf"
                  aria-label={`Finalized passport PDF version ${selected?.version || latest.version}`}
                >
                  <div className="passport-pdf-fallback">
                    <FileBadge2 size={22}/>
                    <p>Your browser cannot display this PDF inline.</p>
                    <a href={issuedPdfUrl(selected?.version || latest.version, true)} target="_blank" rel="noopener noreferrer">
                      Open the issued document
                    </a>
                  </div>
                </object>
              </div>
              <p className="field-help">The preview above loads the actual stored PDF, not a replica or sample artwork. The issuer trust status is <strong>{selected?.issuerTrust === "BTU_CONFIRMED" ? "BTU confirmed" : "demo issuer (BTU authorization unconfirmed)"}</strong>.</p>
            </section>
            {!!history.data?.length && history.data.length > 1 && (
              <section className="passport-issued-history" aria-labelledby="passport-versions-title">
                <div className="section-head">
                  <div>
                    <h2 id="passport-versions-title">Issued versions</h2>
                    <p className="muted">Select a finalized version to view its original, immutable PDF.</p>
                  </div>
                </div>
                <div className="passport-issued-version-list">
                  {history.data.map(version => (
                    <button type="button" key={version.version}
                      aria-pressed={(selected?.version || latest.version) === version.version}
                      onClick={() => setSelectedVersion(version.version)}>
                      <FileBadge2 size={17}/>
                      <span>Version {version.version}</span>
                      <span className="muted">{version.finalizedAt ? dateLabel(version.finalizedAt) : "Finalized"}</span>
                      {version.isLatest && <Badge tone="success">Latest</Badge>}
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
