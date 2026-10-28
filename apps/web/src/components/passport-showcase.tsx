"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, BookOpen, GraduationCap, Layers3, Pause, Play, Sun } from "lucide-react";
import { skillTypes } from "@/lib/design";
import { SkillField } from "./skill-field";
import styles from "./passport-showcase.module.css";

const formats = [
  { short: "Focused", icon: BookOpen, title: "Small steps. Lasting skills.", summary: "Workshops and masterclasses turn a focused learning experience into part of your permanent record." },
  { short: "Applied", icon: Layers3, title: "Put your knowledge to work.", summary: "Practical challenges, bootcamps, and projects capture what you can do with the skills you learn." },
  { short: "Academic", icon: GraduationCap, title: "Go deeper. Keep the proof.", summary: "Academic courses recognize extended, formally assessed learning alongside your other achievements." },
] as const;

export function PassportShowcase({ showHeading = true }: { showHeading?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mood, setMood] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => {
      preference.removeEventListener("change", sync);
    };
  }, []);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % formats.length;
    else if (event.key === "ArrowLeft") next = (index + formats.length - 1) % formats.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = formats.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.showcase} data-paused={paused || reducedMotion} data-format={selected ?? "overview"}>
      <div className={styles.stage}>
        {showHeading && <div className={styles.stageHeader}>
          <h2>Your learning, connected</h2>
          <p>A skillset that keeps growing</p>
        </div>}
        <SkillField format={selected ?? 0} mood={mood} paused={paused || reducedMotion} />
        <div className={styles.stageControls} role="group" aria-label="Skill field controls">
          <button type="button" className={styles.motionButton} disabled={reducedMotion} onClick={() => setPaused(!paused)} aria-label={reducedMotion ? "Animation disabled by reduced motion preference" : paused ? "Play badge animation" : "Pause badge animation"} aria-pressed={paused || reducedMotion}>
            {paused || reducedMotion ? <Play size={12} /> : <Pause size={12} />}
            {reducedMotion ? "Still" : paused ? "Play" : "Pause"}
          </button>
          <button className={styles.moodButton} type="button" onClick={() => setMood((mood + 1) % 3)} aria-label={`Lighting: ${["Dawn", "Daylight", "Dusk"][mood]}. Change lighting mood`}>
            <Sun size={14} />{["Dawn", "Daylight", "Dusk"][mood]}
          </button>
        </div>
      </div>
      <div className={styles.explorer}>
        <div className={styles.explorerHeading}><span>Explore the learning formats</span><ArrowUpRight size={15} aria-hidden="true" /></div>
        <div role="tablist" aria-label="Learning formats" className={styles.tabs}>
          {formats.map((item, i) => (
            <button key={item.short} ref={el => { tabs.current[i] = el; }} id={`format-tab-${i}`} type="button" role="tab" aria-selected={selected === i} aria-controls={`format-panel-${i}`} tabIndex={selected === i || (selected === null && i === 0) ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={event => navigate(event, i)}>
              <item.icon size={15} strokeWidth={1.7} />{item.short}
            </button>
          ))}
        </div>
        {formats.map((item, i) => (
          <div key={item.short} id={`format-panel-${i}`} role="tabpanel" aria-labelledby={`format-tab-${i}`} hidden={selected !== i} className={styles.detail} tabIndex={0}>
            <div className={styles.detailTitle}><Image src={`/images/btu/vector/${skillTypes[i].image}.svg`} alt={`${skillTypes[i].label} badge artwork`} width={64} height={56} unoptimized /><h3>{item.title}</h3></div>
            <p>{item.summary}</p>
          </div>
        ))}
        {selected !== null && <p className={styles.disclaimer}>Illustrative preview. No credential has been issued.</p>}
      </div>
    </div>
  );
}
