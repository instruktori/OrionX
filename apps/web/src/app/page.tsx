import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  FileBadge2,
  Layers3,
  LockKeyhole,
  MoveUpRight,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { SkillCollection } from "@/components/skill-collection";
import { students } from "@/lib/demo";
import { imagePath } from "@/lib/design";

export default function Home() {
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LEARNING, RECOGNIZED</div>
          <h1>A little learning. A lasting record.</h1>
          <p className="lead">
            A home for your AI skills and the experiences behind them.
          </p>
        </div>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">ONE PASSPORT. ROOM TO GROW.</span>
          <h2>
            Build skills.
            <br />
            <span>Keep the story.</span>
          </h2>
          <p>
            Every new skill belongs in your story. Explore a passport that grows
            with you.
          </p>
          <Link className="button" href="/passport">
            Explore your passport <ArrowRight size={17} />
          </Link>
          <a className="hero-text-link" href="#skill-collection">
            Browse sample skills <ArrowUpRight size={15} />
          </a>
        </div>
        <Link
          className="hero-art"
          href="/passport"
          aria-label="Explore the BTU passport design"
        >
          <Image
            src={imagePath("passport-cover")}
            width={906}
            height={593}
            alt="Original BTU AI Skills Digital Passport cover design with colorful stamps"
            priority
            fetchPriority="high"
            sizes="(max-width: 760px) 90vw, 48vw"
          />
          <span className="hero-art-caption">
            The BTU passport design <MoveUpRight size={15} />
          </span>
        </Link>
      </section>
      <div className="preview-notice" role="note">
        <LockKeyhole size={16} />
        <p>
          <strong>You’re exploring a preview.</strong> All student records are
          fictional. No official credentials or blockchain proof are
          represented.
        </p>
      </div>
      <section
        className="stats overview-stats"
        aria-label="Sample workspace statistics"
      >
        {[
          {
            label: "Sample achievements",
            value: "12",
            hint: "Across the demo workspace",
            icon: BookOpen,
          },
          {
            label: "Sample passports",
            value: "03",
            hint: "One record per student",
            icon: FileBadge2,
          },
          {
            label: "Learning formats",
            value: "03",
            hint: "Focused, applied & academic",
            icon: Layers3,
          },
          {
            label: "Credential status",
            value: "Preview",
            hint: "No official issuance",
            icon: ShieldCheck,
          },
        ].map((s) => (
          <div className="stat-item" key={s.label}>
            <div className="stat-top">
              <span className="stat-label">{s.label}</span>
              <s.icon size={18} />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-bottom">{s.hint}</div>
          </div>
        ))}
      </section>
      <SkillCollection />
      <div className="overview-bottom">
        <section className="card recent-passports">
          <div className="section-head">
            <h2>Recent sample passports</h2>
            <Link className="action-link" href="/admin">
              Administration <ArrowUpRight size={16} />
            </Link>
          </div>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Sample passport records"
          >
            <table className="table">
              <caption className="sr-only">
                Fictional students and sample passport versions
              </caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Passport ID</th>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="student-cell">
                        <span className="student-avatar" aria-hidden="true">
                          {s.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <div>
                          <b>{s.name}</b>
                          <div className="muted">{s.program}</div>
                          <div className="mobile-passport-id mono">{s.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{s.id}</td>
                    <td>V{s.version}</td>
                    <td>
                      <span className="pill">{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="journey">
          <BookOpen size={25} />
          <h2>
            One ID.
            <br />
            An evolving skillset.
          </h2>
          <p>
            Your passport keeps the same permanent ID as new achievements are
            added.
          </p>
          <ol>
            {[
              "Learn through an eligible experience",
              "Add skills to the same passport",
              "Keep a history of every version",
            ].map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <Link className="action-link" href="/passport">
            See how it comes together <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <footer className="page-footer">
        <span>OrionX / AI Skills Digital Passport</span>
        <Link href="/verify">
          Explore verification <ArrowUpRight size={14} />
        </Link>
      </footer>
    </Shell>
  );
}
