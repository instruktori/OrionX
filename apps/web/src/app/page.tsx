"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n-provider";
import { toMtavruli } from "@/lib/i18n";
import { ArrowDown, ArrowRight, Fingerprint, Layers3, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/shell";
import { PassportShowcase } from "@/components/passport-showcase";
import { LandingStory } from "@/components/landing-story";
import styles from "./landing.module.css";

export default function Home() {
  const { t, locale } = useI18n();
  return (
    <Shell>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.copy}>
            <a className={styles.eyebrow} href="#how-it-works">
              <span className={styles.eyebrowMark}><Layers3 size={14} /></span>
              {t("home.eyebrow")} <ArrowRight size={13} />
            </a>
            <h1 id="hero-title">
              {locale === "ka" ? (
                <>{toMtavruli(t("home.titleLine1"))}<br />{toMtavruli(t("home.titleLine2"))}</>
              ) : (
                <>{t("home.titleLine1")}<br />{t("home.titleLine2")}<br className={styles.desktopBreak} /> {t("home.titleLine3")}</>
              )}
            </h1>
            <p>{t("home.intro")}</p>
            <div className={styles.actions}>
              <Link className={`button ${styles.primary}`} href="/login?next=/dashboard">
                {t("home.open")} <ArrowRight size={16} />
              </Link>
              <Link className={styles.verify} href="/verify">{t("home.verify")} <ArrowRight size={15} /></Link>
            </div>
          </div>
          <PassportShowcase />
        </section>
        <section className={styles.foundation} aria-label={t("home.foundations")}>
          <div className={styles.university}>
            <span className={styles.btu}>BTU</span>
            <span>{t("home.builtFor")}<br /><strong>Business and Technology University</strong></span>
          </div>
          <div className={styles.principles}>
            <span><Fingerprint size={18} />{t("home.identity")}</span>
            <span><Layers3 size={18} />{t("home.cumulative")}</span>
            <span><ShieldCheck size={18} />{t("home.independent")}</span>
          </div>
          <a className={styles.explore} href="#how-it-works" aria-label={t("home.explore")}><ArrowDown size={18} /></a>
        </section>
        <LandingStory />
      </div>
    </Shell>
  );
}
