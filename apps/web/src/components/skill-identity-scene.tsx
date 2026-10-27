"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Pause, Play, ShieldCheck } from "lucide-react";
import styles from "./skill-identity-scene.module.css";

const skills = [
  {
    id: "skill",
    name: "AI Skill",
    label: "Focused learning",
    description: "Workshops and masterclasses. A new capability, made visible.",
    image: "/images/btu/vector/ai-skill.svg",
    width: 328,
    height: 284,
  },
  {
    id: "applied",
    name: "AI Applied Skill",
    label: "Applied learning",
    description: "Practical challenges and projects. Knowledge put to work.",
    image: "/images/btu/vector/ai-applied.svg",
    width: 656,
    height: 211,
  },
  {
    id: "advanced",
    name: "AI Advanced Skill",
    label: "Academic learning",
    description:
      "Extended academic study. Deeper understanding, on the record.",
    image: "/images/btu/vector/ai-advanced.svg",
    width: 304,
    height: 304,
  },
] as const;

type SkillId = (typeof skills)[number]["id"];

/** The animation illustrates the product; it never represents an issued credential. */
export function SkillIdentityScene() {
  const figure = useRef<HTMLElement>(null);
  const id = useId();
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<SkillId | null>(null);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  // A still composition is also the server-rendered and no-JavaScript fallback.
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setPageVisible(!document.hidden);
    onPreference();
    onVisibility();
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { threshold: 0.15 },
          )
        : null;
    if (observer && figure.current) observer.observe(figure.current);
    else setInView(true);

    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const playing =
    !paused && !selected && !reducedMotion && inView && pageVisible;
  const detail = skills.find((skill) => skill.id === selected);

  function toggleMotion() {
    if (selected) {
      setSelected(null);
      setPaused(false);
    } else {
      setPaused((value) => !value);
    }
  }

  return (
    <figure
      ref={figure}
      className={styles.scene}
      data-motion={playing ? "running" : "paused"}
      data-focus={selected || "all"}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <div className={styles.caption}>
        <span className="mono">01 / YOUR DIGITAL IDENTITY</span>
        <button
          type="button"
          className={styles.motionControl}
          onClick={toggleMotion}
          aria-label={
            paused || selected
              ? "Resume identity animation"
              : "Pause identity animation"
          }
          aria-pressed={paused || Boolean(selected)}
          hidden={reducedMotion}
        >
          {paused || selected ? <Play size={12} /> : <Pause size={12} />}
          <span>{paused || selected ? "Resume" : "Pause"}</span>
        </button>
      </div>

      <div className={styles.canvas}>
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.atmosphere} aria-hidden="true" />
        <svg
          className={styles.connections}
          viewBox="0 0 560 424"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`${id}-signal`}
              x1="80"
              y1="90"
              x2="390"
              y2="310"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#97b4ff" />
              <stop offset=".55" stopColor="#668cff" />
              <stop offset="1" stopColor="#68c9d5" />
            </linearGradient>
          </defs>
          <ellipse
            className={styles.orbit}
            cx="286"
            cy="204"
            rx="174"
            ry="134"
            transform="rotate(-24 286 204)"
          />
          <ellipse
            className={styles.orbitInner}
            cx="286"
            cy="204"
            rx="128"
            ry="96"
            transform="rotate(-24 286 204)"
          />
          <g className={styles.routeSkill}>
            <path
              className={styles.track}
              d="M130 108H179Q202 108 202 131V168Q202 190 224 190H248"
            />
            <path
              className={styles.signal}
              pathLength="1"
              stroke={`url(#${id}-signal)`}
              d="M130 108H179Q202 108 202 131V168Q202 190 224 190H248"
            />
            <circle className={styles.junction} cx="202" cy="148" r="3" />
          </g>
          <g className={styles.routeApplied}>
            <path
              className={styles.track}
              d="M419 105H379Q357 105 357 127V167Q357 190 334 190H324"
            />
            <path
              className={styles.signal}
              pathLength="1"
              stroke={`url(#${id}-signal)`}
              d="M419 105H379Q357 105 357 127V167Q357 190 334 190H324"
            />
            <circle className={styles.junction} cx="357" cy="148" r="3" />
          </g>
          <g className={styles.routeAdvanced}>
            <path
              className={styles.track}
              d="M131 295H179Q202 295 202 272V212Q202 190 225 190H248"
            />
            <path
              className={styles.signal}
              pathLength="1"
              stroke={`url(#${id}-signal)`}
              d="M131 295H179Q202 295 202 272V212Q202 190 225 190H248"
            />
            <circle className={styles.junction} cx="202" cy="253" r="3" />
          </g>
          <path
            className={styles.track}
            d="M325 206H341Q358 206 358 224V276Q358 295 379 295H404"
          />
          <path
            className={`${styles.signal} ${styles.outputSignal}`}
            pathLength="1"
            stroke={`url(#${id}-signal)`}
            d="M325 206H341Q358 206 358 224V276Q358 295 379 295H404"
          />
          <circle className={styles.orbitPoint} cx="387" cy="85" r="2.5" />
          <circle className={styles.orbitPoint} cx="315" cy="346" r="2" />
          <path
            className={styles.crosshair}
            d="M270 48h8m-4-4v8M479 226h8m-4-4v8M176 355h8m-4-4v8"
          />
        </svg>

        {skills.map((skill, index) => (
          <button
            key={skill.id}
            type="button"
            className={`${styles.skillNode} ${styles[skill.id]}`}
            aria-label={`Explore ${skill.name}: ${skill.label}`}
            aria-pressed={selected === skill.id}
            aria-controls={`${id}-detail`}
            onClick={() =>
              setSelected((current) => (current === skill.id ? null : skill.id))
            }
          >
            <span className={styles.nodeIndex} aria-hidden="true">
              0{index + 1}
            </span>
            <span className={styles.artwork}>
              <img
                src={skill.image}
                alt=""
                width={skill.width}
                height={skill.height}
                draggable={false}
              />
            </span>
            <span className={styles.nodeLabel}>
              <span className={styles.labelFull}>{skill.label}</span>
              <span className={styles.labelShort}>
                {skill.label.split(" ")[0]}
              </span>
            </span>
            <ArrowUpRight
              className={styles.inspectIcon}
              size={12}
              aria-hidden="true"
            />
          </button>
        ))}

        <div className={styles.identity} aria-hidden="true">
          <span className={styles.identityHalo} />
          <div className={styles.identityCore}>
            <svg
              viewBox="0 0 64 64"
              fill="none"
              className={styles.identityMark}
            >
              <circle
                cx="32"
                cy="32"
                r="23"
                stroke="currentColor"
                strokeWidth="1.2"
                opacity=".45"
              />
              <path
                d="M9 32c0-12.7 10.3-23 23-23M55 32c0 12.7-10.3 23-23 23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M32 12c1.5 16 4 18.5 20 20-16 1.5-18.5 4-20 20-1.5-16-4-18.5-20-20 16-1.5 18.5-4 20-20Z"
                fill="currentColor"
              />
            </svg>
            <span>ORIONX ID</span>
          </div>
          <span className={styles.identityLabel}>Permanent identity</span>
          <span className={styles.identitySub}>
            Yours. Across every achievement.
          </span>
        </div>

        <div className={styles.recognition} aria-hidden="true">
          <span className={styles.recognitionIcon}>
            <ShieldCheck size={19} strokeWidth={1.5} />
          </span>
          <span>
            <strong>University recognition</strong>
            <small>Built for BTU</small>
          </span>
          <span className={styles.recognitionDot} />
        </div>
        <span className={styles.canvasNote} aria-hidden="true">
          ONE RECORD / ALWAYS GROWING
        </span>
      </div>

      <figcaption className={styles.description}>
        <div
          className={styles.detail}
          id={`${id}-detail`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className={styles.detailMark} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div>
            <strong id={`${id}-title`}>
              {detail ? detail.name : "Different paths. One permanent record."}
            </strong>
            <p>
              {detail
                ? detail.description
                : "Every skill you build becomes part of a bigger picture."}
            </p>
          </div>
        </div>
        <p id={`${id}-description`} className={styles.disclaimer}>
          Illustrative preview · no credential issued
          <span>
            Explore a badge above <ArrowUpRight size={10} aria-hidden="true" />
          </span>
        </p>
      </figcaption>
    </figure>
  );
}
