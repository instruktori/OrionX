import Link from "next/link";
import { ArrowRight, BookOpen, GraduationCap, Link2 } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import styles from "./landing-story.module.css";

const steps = [
  {
    icon: BookOpen,
    title: "Learn something new.",
    description:
      "A focused workshop, a practical project, an academic course. Every learning format has a place in your passport.",
    detail: "Develop your AI skills",
  },
  {
    icon: GraduationCap,
    title: "Make it part of your record.",
    description:
      "Your university records eligible achievements. Each issued version adds to your history, with the same permanent passport identity.",
    detail: "University recognition",
  },
  {
    icon: Link2,
    title: "Take your progress with you.",
    description:
      "Share your passport PDF or verification link. Others can check the record, its history, and the authority of its issuer.",
    detail: "Share verifiable proof",
  },
];

export function LandingStory() {
  return (
    <>
      <section
        className={styles.story}
        id="how-it-works"
        aria-labelledby="learning-story-title"
      >
        <div className={styles.intro}>
          <h2 id="learning-story-title">Built around the way you learn.</h2>
          <p>
            Learning takes different paths. Your achievements belong together,
            in a record that grows with you.
          </p>
        </div>
        <ol className={styles.process}>
          {steps.map((step, index) => (
            <li className={styles.step} key={step.title}>
              <div className={styles.stepMarker} aria-hidden="true">
                <span className={styles.number}>{index + 1}</span>
                <step.icon size={23} strokeWidth={1.65} />
              </div>
              <div className={styles.stepContent}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <span className={styles.stepDetail}>{step.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.start} aria-labelledby="start-title">
        <div>
          <h2 id="start-title">Your next chapter starts here.</h2>
          <p>Open your private workspace. Keep building your story.</p>
        </div>
        <Link
          href="/login?next=/dashboard"
          className={`button ${styles.startButton}`}
        >
          Open your workspace
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Link href="/" aria-label="OrionX home">
            <BrandLogo width={109} height={29} className={styles.logo} />
          </Link>
          <span>AI Skills Digital Passport</span>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/verify">Verify a credential</Link>
          <span>Verification uses Solana Devnet.</span>
        </div>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} OrionX
        </p>
      </footer>
    </>
  );
}
