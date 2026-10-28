"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import { ArrowRight, BookOpen, GraduationCap, Link2 } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import styles from "./landing-story.module.css";

const storySteps = (t: ReturnType<typeof useI18n>["t"]) => [
  {
    icon: BookOpen,
    title: t("story.firstTitle"),
    description:
      t("story.firstText"),
    detail: t("story.firstDetail"),
  },
  {
    icon: GraduationCap,
    title: t("story.secondTitle"),
    description:
      t("story.secondText"),
    detail: t("story.secondDetail"),
  },
  {
    icon: Link2,
    title: t("story.thirdTitle"),
    description:
      t("story.thirdText"),
    detail: t("story.thirdDetail"),
  },
];

export function LandingStory() {
  const { t } = useI18n();
  const steps = storySteps(t);
  return (
    <>
      <section
        className={styles.story}
        id="how-it-works"
        aria-labelledby="learning-story-title"
      >
        <div className={styles.intro}>
          <h2 id="learning-story-title">{t("story.heading")}</h2>
          <p>
            {t("story.intro")}
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
          <h2 id="start-title">{t("story.ctaHeading")}</h2>
          <p>{t("story.ctaText")}</p>
        </div>
        <Link
          href="/login?next=/dashboard"
          className={`button ${styles.startButton}`}
        >
          {t("home.open")}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Link href="/" aria-label="OrionX home">
            <BrandLogo width={109} height={29} className={styles.logo} />
          </Link>
          <span>{t("shell.aiSkillsPassport")}</span>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/verify">{t("shell.verify")}</Link>
          <span>{t("story.network")}</span>
        </div>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} OrionX
        </p>
      </footer>
    </>
  );
}
