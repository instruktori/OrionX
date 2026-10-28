import Link from "next/link";
import { ArrowDown, ArrowRight, Fingerprint, Layers3, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PassportShowcase } from "@/components/passport-showcase";
import { LandingStory } from "@/components/landing-story";
import styles from "./landing.module.css";

export default function Home() {
  return (
    <Shell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.copy}>
            <a className={styles.eyebrow} href="#how-it-works">
              <span className={styles.eyebrowMark}><Layers3 size={14} /></span>
              Your AI skills, connected <ArrowRight size={13} />
            </a>
            <h1 id="hero-title">Your skills.<br />A record<br className={styles.desktopBreak} /> that lasts.</h1>
            <p>Turn what you learn into a lasting, verifiable record. Every achievement, together in your digital passport.</p>
            <div className={styles.actions}>
              <Link className={`button ${styles.primary}`} href="/login?next=/dashboard">
                Open your workspace <ArrowRight size={16} />
              </Link>
              <Link className={styles.verify} href="/verify">Verify a credential <ArrowRight size={15} /></Link>
            </div>
          </div>
          <PassportShowcase />
        </section>
        <section className={styles.foundation} aria-label="Passport foundations">
          <div className={styles.university}>
            <span className={styles.btu}>BTU</span>
            <span>Built for<br /><strong>Business and Technology University</strong></span>
          </div>
          <div className={styles.principles}>
            <span><Fingerprint size={18} />Permanent identity</span>
            <span><Layers3 size={18} />Cumulative achievements</span>
            <span><ShieldCheck size={18} />Independent verification</span>
          </div>
          <a className={styles.explore} href="#how-it-works" aria-label="Explore how the passport works"><ArrowDown size={18} /></a>
        </section>
        <LandingStory />
      </div>
    </Shell>
  );
}
