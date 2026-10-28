"use client";
import Image from "next/image";
import {useState} from "react";
import {Download, ExternalLink, FileCheck2, LayoutGrid, ShieldCheck} from "lucide-react";
import {imagePath} from "@/lib/design";
import {type Award, type Passport, dateLabel} from "@/lib/passport";
import {API} from "@/lib/session";

/**
 * Faithful visual adaptation of BTU's four supplied landscape pages.
 *
 * The original, lossless-source-derived page artwork remains the background:
 * university logo, five cover stamps, borders, footer, and typography are not
 * redrawn or approximated. Only student fields / variable skill areas are
 * placed over the supplied blank and sample-content areas.
 *
 * This is NOT the finalized issued PDF. Only /download serves the exact
 * immutable bytes whose hash was committed to Solana.
 */
type Sheet = {id: string;label: string;art: string;offset?: number;items?: Award[]};
const PAGE_SKILLS = 10;
const PAGE_DETAILS = 5;
function split(items: Award[], size: number) {
  const result: Award[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result.length ? result : [[]];
}
function stampImage(category: string) {
  if (category === "AI Applied Skill") return "ai-applied";
  if (category === "AI Advanced Skill") return "ai-advanced";
  return "ai-skill";
}
function shortDate(value: string) {
  if (!value) return "—";
  return dateLabel(value);
}

export function BtuPassportReplica({passport, awards}: {passport: Passport; awards: Award[]}) {
  const [selected, setSelected] = useState(0);
  const [view, setView] = useState<"personal" | "reference" | "issued">("personal");
  const latest = passport.latest;
  const student = passport.student;
  const issued = !!latest && !!passport.passportId && !!student;
  const passportId = passport.passportId || "";
  const sheets: Sheet[] = [
    {id: "cover", label: "Cover", art: "passport-cover"},
    {id: "about", label: "About", art: "passport-about"},
    ...split(awards, PAGE_SKILLS).map((items, i) => ({
      id: "skillset-" + i, label: i ? "Skills " + (i + 1) : "Verified skillset", art: "passport-skillset", items, offset: i * PAGE_SKILLS,
    })),
    ...split(awards, PAGE_DETAILS).map((items, i) => ({
      id: "details-" + i, label: i ? "Details " + (i + 1) : "Skill details", art: "passport-details", items, offset: i * PAGE_DETAILS,
    })),
  ];
  const active = sheets[Math.min(selected, sheets.length - 1)];
  const isReference = view === "reference" || !issued;
  const pdfUrl = latest ? `${API}/api/v1/me/passport/versions/${latest.version}/download` : "";
  const canViewIssued = !!latest;
  return (
    <section className="btu-replica" aria-labelledby="btu-passport-title">
      <div className="btu-replica-head">
        <div>
          <div className="btu-replica-kicker">BTU · ORIGINAL PASSPORT DESIGN</div>
          <h2 id="btu-passport-title">Your digital passport</h2>
          <p>The official four-part BTU visual system, with your cumulative skills and permanent identity.</p>
        </div>
        {issued && <div className="btu-replica-status"><FileCheck2 size={15}/> Version {latest.version} · {awards.length} verified skills</div>}
      </div>
      <div className="btu-replica-toolbar">
        <div className="btu-replica-tabs" role="group" aria-label="Passport display mode">
          <button type="button" aria-pressed={view === "personal"} onClick={() => {setView("personal");setSelected(0);}}><LayoutGrid size={15}/> BTU layout</button>
          <button type="button" aria-pressed={view === "reference"} onClick={() => {setView("reference");setSelected(0);}}>Original template</button>
          {canViewIssued && <button type="button" aria-pressed={view === "issued"} onClick={() => setView("issued")}><FileCheck2 size={15}/> Issued PDF</button>}
        </div>
        {latest && <a className="btu-replica-download" href={pdfUrl}><Download size={15}/> Download verified PDF</a>}
      </div>
      {view === "issued" && canViewIssued ? (
        <div className="btu-issued-viewer">
          <div className="btu-issued-viewer-bar">
            <ShieldCheck size={16}/>
            <span>Original finalized PDF · exact bytes of version {latest.version}</span>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Open in new tab</a>
          </div>
          <object data={pdfUrl} type="application/pdf" aria-label="Your issued BTU Digital Passport PDF">
            <div className="btu-pdf-fallback">
              Your browser cannot show the PDF inline.
              <a href={pdfUrl}>Open or download your verified document.</a>
            </div>
          </object>
        </div>
      ) : (
        <>
          <div className="btu-sheet-scroller" role="region" aria-label="BTU passport page" tabIndex={0}>
            <div className="btu-sheet" key={active.id + "-" + (isReference ? "reference" : "personal")}>
              <Image src={imagePath(active.art)} alt={`BTU supplied artwork: ${active.label}`} fill unoptimized priority={selected === 0} sizes="(max-width: 1024px) 700px, 1100px" className="btu-sheet-art" />
              {!isReference && (
                <>
                  {active.id === "cover" && <>
                    <span className="btu-cover-name">{student!.firstName}</span>
                    <span className="btu-cover-surname">{student!.lastName}</span>
                    <span className="btu-cover-issue">{passport.originalIssueDate ? shortDate(passport.originalIssueDate) : "—"}</span>
                    <span className="btu-cover-id">{passportId}</span>
                  </>}
                  {active.id === "about" && <span className="btu-about-id">{passportId}</span>}
                  {active.id.startsWith("skillset-") && <>
                    <div className="btu-dynamic-area btu-skill-area">
                      <h3>VERIFIED AI SKILLSET</h3>
                      <p>Collection of BTU-verified AI Skill Stamps{active.offset ? ` · continued (${active.offset + 1}–${active.offset + (active.items?.length || 0)})` : ""}</p>
                      <div className="btu-skill-grid">
                        {active.items?.map(a => <div className="btu-skill-slot" key={a.recordId}>
                          <span className="btu-slot-date">{shortDate(a.dateEarned)}</span>
                          <Image src={imagePath(stampImage(a.category))} width={220} height={120} alt={`${a.category} BTU stamp`} unoptimized className="btu-slot-stamp"/>
                          <strong title={a.name}>{a.name}</strong>
                          <span className="btu-slot-category">{a.category}</span>
                        </div>)}
                        {Array.from({length: Math.max(0, 10 - (active.items?.length || 0))}, (_, i) => <div className="btu-skill-slot btu-skill-empty" key={"empty-" + i} aria-hidden="true"/>)}
                      </div>
                    </div>
                    <span className="btu-skill-page-id">{passportId}</span>
                  </>}
                  {active.id.startsWith("details-") && <>
                    <div className="btu-dynamic-area btu-details-area">
                      <h3>AI SKILLS DETAILED INFORMATION</h3>
                      <p>Detailed record of verified AI skills and learning experiences{active.offset ? " · continued" : ""}</p>
                      <div className="btu-details-table-wrap">
                        <table className="btu-details-table">
                          <thead><tr><th>STAMP TYPE</th><th>SKILL</th><th>DESCRIPTION</th><th>EARNED THROUGH</th><th>DATE EARNED</th></tr></thead>
                          <tbody>{active.items?.map(a => <tr key={a.recordId}>
                            <td><Image src={imagePath(stampImage(a.category))} width={150} height={75} alt={`${a.category} BTU stamp`} unoptimized /></td>
                            <td><strong>{a.name}</strong></td>
                            <td>{a.description || "—"}</td>
                            <td><span className="btu-unavailable" title="The BTU source provides no separate activity field">—</span></td>
                            <td>{shortDate(a.dateEarned)}</td>
                          </tr>)}</tbody>
                        </table>
                      </div>
                    </div>
                    <span className="btu-details-page-id">{passportId}</span>
                  </>}
                </>
              )}
            </div>
          </div>
          <div className="btu-page-controls">
            <span className="btu-page-counter">PAGE {selected + 1} / {isReference ? 4 : sheets.length}</span>
            <div className="btu-page-choices" role="group" aria-label="Select passport page">
              {(isReference ? [
                {id:"cover",label:"Cover",art:"passport-cover"},
                {id:"about",label:"About",art:"passport-about"},
                {id:"skillset-0",label:"Verified skillset",art:"passport-skillset"},
                {id:"details-0",label:"Skill details",art:"passport-details"},
              ] : sheets).map((sheet, i) =>
                <button key={sheet.id} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)}>{String(i + 1).padStart(2, "0")} <span>{sheet.label}</span></button>
              )}
            </div>
          </div>
          <p className="btu-replica-disclaimer">
            {isReference
              ? "BTU's supplied design reference contains illustrative sample skills and stamps. This is not an issued credential."
              : "Live layout preview using BTU's original artwork. The finalized PDF is the authoritative document: use 'Issued PDF' or download it to view the exact immutable file registered on Solana."}
            {latest?.issuerTrust !== "BTU_CONFIRMED" && " Demo issuer only; this preview does not establish official BTU authorization."}
          </p>
        </>
      )}
    </section>
  );
}
