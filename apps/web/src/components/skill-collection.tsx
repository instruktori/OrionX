"use client";
import Image from "next/image";
import { useI18n } from "@/lib/i18n-provider";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, Search, X } from "lucide-react";
import { skills } from "@/lib/demo";
import { imagePath, skillTypes } from "@/lib/design";
import { ImageDialog } from "./image-dialog";

export function SkillCollection() {
  const {t} = useI18n();
  const [category, setCategory] = useState("All skills");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof skills)[number] | null>(
    null,
  );
  const filtered = skills.filter(
    (s) =>
      (category === "All skills" || s.category === category) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section id="skill-collection" className="collection">
      <div className="section-head">
        <div>
          <h2>{t("skills.heading")}</h2>
          <p className="muted">
            Sample achievements, in the original BTU stamp system.
          </p>
        </div>
        <span className="sample-label">{t("skills.sampleCount")}</span>
      </div>
      <div className="collection-toolbar">
        <div
          className="filter-group"
          role="group"
          aria-label={t("skills.filter")}
        >
          {["All skills", ...skillTypes.map((t) => t.id)].map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "All skills" ? t("skills.all") : c}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={17} aria-hidden="true" />
          <label className="sr-only" htmlFor="skill-search">
            Search sample skills
          </label>
          <input
            id="skill-search"
            className="input"
            placeholder={t("skills.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label={t("skills.clear")}
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <p className="sr-only" role="status">
        {t("skills.found",{count:filtered.length})}
      </p>
      <div className="skill-cards">
        {filtered.map((s) => {
          const type = skillTypes.find((t) => t.id === s.category)!;
          return (
            <button
              type="button"
              className="skill-card"
              key={s.name}
              onClick={() => setSelected(s)}
            >
              <div className={`stamp-stage stamp-${type.image}`}>
                <Image
                  src={imagePath(type.image)}
                  alt=""
                  width={540}
                  height={390}
                  quality={100}
                  unoptimized
                  className="skill-stamp"
                />
                <ArrowUpRight size={19} className="skill-card-arrow" />
              </div>
              <div className="skill-card-body">
                <span className="category-label">{s.category}</span>
                <h3>{s.name}</h3>
                <span className="skill-date">
                  <CalendarDays size={14} />
                  {s.date}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={25} />
          <h3>{t("skills.empty")}</h3>
          <p>{t("skills.emptyHelp")}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setQuery("");
              setCategory("All skills");
            }}
          >
            Reset filters
          </button>
        </div>
      )}
      <ImageDialog
        title={t("skills.sample")}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="skill-detail">
            <Image
              src={imagePath(
                skillTypes.find((t) => t.id === selected.category)!.image,
              )}
              alt={`${selected.category} stamp`}
              width={600}
              height={450}
              quality={100}
              unoptimized
              className="skill-stamp"
            />
            <span className="category-label">{selected.category}</span>
            <h3>{selected.name}</h3>
            <p>{selected.description}</p>
            <p className="muted">{t("skills.earned")} {selected.date}</p>
            <div className="notice">
              This is a fictional achievement for exploring the passport design.
            </div>
          </div>
        )}
      </ImageDialog>
    </section>
  );
}
