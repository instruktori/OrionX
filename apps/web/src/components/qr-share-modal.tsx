"use client";
import Link from "next/link";
import {useEffect, useState} from "react";
import {Copy, Check, ExternalLink, QrCode, ShieldCheck} from "lucide-react";
import {ImageDialog} from "./image-dialog";
import {generateQrDataUrl} from "@/lib/qr-pdf";

type QrShareModalProps = {
  open: boolean;
  onClose: () => void;
  passportId: string;
  studentName?: string;
  version: number;
  verificationCode: string;
  isLatest: boolean;
};

export function QrShareModal({
  open,
  onClose,
  passportId,
  studentName,
  version,
  verificationCode,
  isLatest,
}: QrShareModalProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify?code=${encodeURIComponent(verificationCode)}`
      : `/verify?code=${encodeURIComponent(verificationCode)}`;

  useEffect(() => {
    if (!open || !verificationCode) return;
    let active = true;
    generateQrDataUrl(shareUrl)
      .then(dataUrl => {
        if (active) setQrUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrUrl("");
      });
    return () => {
      active = false;
    };
  }, [open, shareUrl, verificationCode]);

  const copyText = async (value: string, type: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value);
      if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <ImageDialog
      title={`Share & Verify · ${passportId} (V${version})`}
      open={open}
      onClose={onClose}
    >
      <div className="qr-share-modal">
        <div className="qr-share-top">
          <span className={`pill ${isLatest ? "pill-cyan" : "pill-pink"}`}>
            {isLatest ? "LATEST FINALIZED VERSION" : `HISTORICAL VERSION V${version} (SUPERSEDED)`}
          </span>
          {studentName && <h3 style={{margin: "10px 0 4px"}}>{studentName}</h3>}
          <p className="muted" style={{margin: 0}}>
            Scan with any phone camera or the OrionX verifier to inspect the on-chain proof for Version {version}.
          </p>
        </div>

        <div className="qr-frame">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt={`Verification QR code for ${passportId} V${version}`}
              width={230}
              height={230}
            />
          ) : (
            <div className="qr-placeholder">
              <QrCode size={42} />
            </div>
          )}
        </div>

        <div className="identity-box" style={{textAlign: "left"}}>
          <span className="mini-kicker">VERIFICATION CODE (VERSION {version})</span>
          <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10}}>
            <code className="mono">{verificationCode}</code>
            <button
              type="button"
              className="button secondary btn-sm"
              onClick={() => void copyText(verificationCode, "code")}
            >
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              {copiedCode ? "Copied" : "Copy code"}
            </button>
          </div>
        </div>

        <div className="identity-box" style={{textAlign: "left"}}>
          <span className="mini-kicker">PUBLIC VERIFICATION LINK</span>
          <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10}}>
            <code className="mono" style={{fontSize: 11}}>{shareUrl}</code>
            <button
              type="button"
              className="button btn-sm"
              onClick={() => void copyText(shareUrl, "link")}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? "Copied link" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="page-actions" style={{justifyContent: "space-between", marginTop: 18}}>
          <span className="muted" style={{display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11}}>
            <ShieldCheck size={15} color="var(--cyan)" />
            No account needed to verify
          </span>
          <Link className="button secondary" href={`/verify?code=${encodeURIComponent(verificationCode)}`} onClick={onClose}>
            Open in Verifier <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </ImageDialog>
  );
}
