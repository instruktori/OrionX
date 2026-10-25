"use client";
import Image from "next/image";
import { useState } from "react";
import { Expand, ArrowUpRight, FileImage } from "lucide-react";
import { coverArtwork, imagePath, skillTypes } from "@/lib/design";
import { ImageDialog } from "./image-dialog";

const pages = [
  { id: "cover", label: "Cover" },
  { id: "about", label: "About & stamps" },
  { id: "skillset", label: "Skill collection" },
  { id: "details", label: "Skill details" },
];
export function PassportPreview() {
  const [page, setPage] = useState(pages[0]);
  const [zoom, setZoom] = useState(false);
  const [reference, setReference] = useState(false);
  return (
    <section className="preview-section" aria-labelledby="preview-title">
      <div className="section-head">
        <div>
          <h2 id="preview-title">Inside the passport</h2>
          <p className="muted">
            Explore all four pages of the supplied BTU design.
          </p>
        </div>
        <span className="sample-label">
          <FileImage size={14} />
          Design reference
        </span>
      </div>
      <div className="preview-layout">
        <div className="preview-main">
          <div
            className="filter-group preview-pages"
            role="group"
            aria-label="Passport preview page"
          >
            {pages.map((p) => (
              <button
                type="button"
                key={p.id}
                aria-pressed={page.id === p.id}
                onClick={() => setPage(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="passport-page-button"
            onClick={() => setZoom(true)}
            aria-label={`Enlarge passport ${page.label.toLowerCase()}`}
          >
            <Image
              src={imagePath(`passport-${page.id}`)}
              alt={`BTU passport template: ${page.label}. Sample design artwork, not an issued credential.`}
              width={1812}
              height={1186}
              quality={100}
              unoptimized
              priority
            />
            <span className="preview-enlarge">
              <Expand size={16} />
              Enlarge page
            </span>
          </button>
          <p className="preview-caption">
            Template artwork only. Issuer and verification stamps do not
            establish issuance or proof.
          </p>
        </div>
        <aside className="stamp-guide">
          <h3>Three ways to grow.</h3>
          <p className="muted">
            Different learning experiences. One evolving record.
          </p>
          {skillTypes.map((t) => (
            <div className="guide-item" key={t.id}>
              <Image
                src={imagePath(t.image)}
                alt={`${t.label} stamp`}
                width={320}
                height={260}
                quality={100}
                unoptimized
              />
              <div>
                <h4>{t.label}</h4>
                <p>{t.format}</p>
              </div>
            </div>
          ))}
          <p className="guide-note">
            These are learning formats, not levels to unlock. You can earn any
            stamp type independently.
          </p>
        </aside>
      </div>
      <details className="artwork-details">
        <summary>
          Explore the original cover artwork <ArrowUpRight size={17} />
        </summary>
        <p className="muted">
          All five supplied cover stamps, preserved in their original colors.
          These are reference assets, not credential status indicators.
        </p>
        <div className="artwork-grid">
          {coverArtwork.map((a) => (
            <figure key={a.image}>
              <div>
                <Image
                  src={imagePath(a.image)}
                  alt={`${a.label}, supplied design artwork`}
                  width={a.width}
                  height={a.height}
                  quality={100}
                  unoptimized
                />
              </div>
              <figcaption>{a.label}</figcaption>
            </figure>
          ))}
        </div>
        <button
          type="button"
          className="action-link"
          onClick={() => setReference(true)}
        >
          View the complete reference sheet <ArrowUpRight size={16} />
        </button>
      </details>
      <ImageDialog
        title={`Passport template: ${page.label}`}
        open={zoom}
        onClose={() => setZoom(false)}
      >
        <Image
          className="dialog-image"
          src={imagePath(`passport-${page.id}`)}
          alt={`${page.label} of the supplied BTU template. Not an issued credential.`}
          width={1812}
          height={1186}
          quality={100}
          unoptimized
        />
        <p className="preview-caption">
          Design reference only. No credential has been issued.
        </p>
      </ImageDialog>
      <ImageDialog
        title="Original BTU passport reference"
        open={reference}
        onClose={() => setReference(false)}
      >
        <Image
          className="dialog-image"
          src={imagePath("passport-reference")}
          alt="Complete supplied four-page BTU passport design reference"
          width={3000}
          height={2120}
          quality={100}
          unoptimized
        />
        <p className="preview-caption">
          Original design reference. The stamps shown are artwork only.
        </p>
      </ImageDialog>
    </section>
  );
}
