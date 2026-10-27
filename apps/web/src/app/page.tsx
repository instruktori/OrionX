import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileCheck2,
  Fingerprint,
  GraduationCap,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { PassportIdentity } from "@/components/passport-identity";
import { BrandLogo } from "@/components/brand-logo";

export default function Home() {
  return (
    <Shell>
      <section className="landing-hero">
        <div className="landing-copy">
          <div className="landing-eyebrow">
            <span className="tiny-square" />A NEW STANDARD FOR SKILLS
            RECOGNITION
          </div>
          <h1>
            Your skills.
            <br />
            <span>A record that lasts.</span>
          </h1>
          <p>
            Turn what you learn into a lasting, verifiable record. Your AI
            skills, recognized by your university and connected in one digital
            passport.
          </p>
          <div className="page-actions">
            <Link className="button" href="/login?next=/dashboard">
              Open your workspace
              <ArrowRight size={16} />
            </Link>
            <Link className="button secondary" href="/verify">
              <ShieldCheck size={16} />
              Verify a credential
            </Link>
          </div>
          <div className="landing-trust">
            <GraduationCap size={17} />
            <span>Built for Business and Technology University</span>
          </div>
        </div>
        <div className="landing-product">
          <div className="product-caption">
            <span className="mono">01 / YOUR DIGITAL IDENTITY</span>
            <span>
              Designed to grow with you
              <ArrowUpRight size={13} />
            </span>
          </div>
          <PassportIdentity />
          <div className="product-record">
            <span className="record-connector" />
            <div>
              <Layers3 size={16} />
              <span>One passport. A cumulative history.</span>
            </div>
            <span className="mono">∞</span>
          </div>
          <div className="showcase-label">
            Passport interface · illustrative, no credential issued
          </div>
        </div>
      </section>
      <div className="landing-principles">
        <span>
          <Fingerprint size={18} />
          Permanent identity
        </span>
        <span>
          <Layers3 size={18} />
          Cumulative achievements
        </span>
        <span>
          <ShieldCheck size={18} />
          Independent verification
        </span>
        <a href="#how-it-works">
          Explore the passport
          <ArrowDown size={15} />
        </a>
      </div>
      <section className="landing-process" id="how-it-works">
        <div className="section-intro">
          <div className="eyebrow">FROM LEARNING TO LASTING PROOF</div>
          <h2>
            Every achievement.
            <br />
            Part of a bigger picture.
          </h2>
          <p>
            A workshop today. An applied project next semester. Your passport
            brings the experiences together, while keeping their history intact.
          </p>
        </div>
        <div className="process-list">
          {[
            {
              number: "01",
              icon: BookOpen,
              title: "Develop your AI skills",
              description:
                "Build knowledge through workshops, practical projects, and academic courses. Different learning formats have their own place in your passport.",
            },
            {
              number: "02",
              icon: GraduationCap,
              title: "Get recognized by your university",
              description:
                "Authorized staff record eligible achievements. Each issued version adds to your existing skills and keeps the same permanent passport identity.",
            },
            {
              number: "03",
              icon: FileCheck2,
              title: "Share proof that can be checked",
              description:
                "Share a verification link or your passport PDF. A verifier can check registration, document integrity, version history, and issuer authority independently.",
            },
          ].map((s) => (
            <div className="process-row" key={s.number}>
              <span className="mono">{s.number}</span>
              <s.icon size={23} strokeWidth={1.4} />
              <div>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="landing-learning">
        <div>
          <div className="eyebrow">ONE RECORD. EVERY LEARNING FORMAT.</div>
          <h2>
            Build capability.
            <br />
            Make progress visible.
          </h2>
          <p>
            Workshops, practical projects, and academic courses each have a
            place in your passport. Your university records eligible skills and
            badges, adding every achievement to the same permanent identity.
          </p>
          <Link className="action-link" href="/passport">
            Explore your passport
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="learning-formats">
          <div>
            <span className="format-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <h3>AI Skill</h3>
              <p>Focused workshops and masterclasses</p>
            </div>
            <span className="mono">01</span>
          </div>
          <div>
            <span className="format-icon">
              <Layers3 size={20} />
            </span>
            <div>
              <h3>AI Applied Skill</h3>
              <p>Practical challenges and hands-on projects</p>
            </div>
            <span className="mono">02</span>
          </div>
          <div>
            <span className="format-icon">
              <GraduationCap size={20} />
            </span>
            <div>
              <h3>AI Advanced Skill</h3>
              <p>Extended academic learning</p>
            </div>
            <span className="mono">03</span>
          </div>
        </div>
      </section>
      <section className="landing-cta">
        <BrandLogo className="cta-brand-logo" width={198} height={52} />
        <h2>The next chapter is yours.</h2>
        <p>Start with your private workspace. Grow your record over time.</p>
        <Link className="button" href="/login?next=/dashboard">
          Get started with OrionX
          <ArrowRight size={16} />
        </Link>
      </section>
      <footer className="page-footer">
        <span>
          © {new Date().getFullYear()} OrionX · AI Skills Digital Passport
        </span>
        <div>
          <span className="muted">Blockchain proof uses Solana Devnet</span>
          <Link href="/verify">
            Verify a credential
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </footer>
    </Shell>
  );
}
