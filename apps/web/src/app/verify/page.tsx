"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/shell";
import {
  ShieldCheck,
  UploadCloud,
  Search,
  AlertCircle,
  FileCheck2,
  LockKeyhole,
  Fingerprint,
  History,
  LoaderCircle,
  Camera,
  CameraOff,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  discoverCodesFromPdfFile,
  decodeQrFromImageFile,
  decodeQrFromVideoFrame,
  isValidVerificationCode,
} from "@/lib/qr-pdf";

type Result = {
  message: string;
  errorCode?: string;
  unavailable?: boolean;
  registration?: string;
  integrity?: string;
  issuerTrust?: string;
  currency?: string;
  officialBtu?: boolean;
  version?: number;
  pdfSha256?: string;
  versionPda?: string;
  programId?: string;
  verifiedCode?: string;
  chainEvidence?: Record<string, string | number>;
};

const API = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/+$/, "");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Verify() {
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [discoveryNote, setDiscoveryNote] = useState("");
  const [discoveredCodes, setDiscoveredCodes] = useState<string[]>([]);
  const [discrepancy, setDiscrepancy] = useState<{
    typedCode: string;
    pdfCode: string;
  } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState<"code" | "file" | null>(null);

  // Camera & image QR scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const normalized = code.trim().toUpperCase();
  const valid =
    /^D1-[A-Z2-7]{32}$/.test(normalized) && isValidVerificationCode(normalized);
  const codeError = touched && !valid;

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const runVerification = useCallback(
    async (targetCode: string, pdfFile: File | null, withFile: boolean) => {
      const cleanCode = targetCode.trim().toUpperCase();
      if (withFile && (!pdfFile || fileError)) return;
      if (!withFile && !/^D1-[A-Z2-7]{32}$/.test(cleanCode)) {
        setTouched(true);
        return;
      }
      setPending(withFile ? "file" : "code");
      setResult(null);
      try {
        let response: Response;
        if (withFile && pdfFile) {
          const form = new FormData();
          if (cleanCode) form.append("code", cleanCode);
          form.append("file", pdfFile);
          response = await fetch(API + "/api/v1/verify/file", {
            method: "POST",
            body: form,
          });
        } else {
          response = await fetch(
            API + "/api/v1/verify/" + encodeURIComponent(cleanCode),
          );
        }
        const data = await response.json().catch(() => ({}));
        if (data.verifiedCode && !code) {
          setCode(data.verifiedCode);
        }
        // Preserve structured proof fields on BOTH 200 and non-200 (e.g. HTTP 422 MISMATCH or 404 UNKNOWN_CODE)!
        setResult({
          errorCode: data.errorCode || data.error?.code,
          unavailable: response.status >= 500,
          message:
            data.message ||
            data.error?.message ||
            (response.ok
              ? "No verified proof returned."
              : "Verification could not be completed. Check your code and try again."),
          registration: data.registration,
          integrity: data.integrity,
          issuerTrust: data.issuerTrust,
          currency: data.currency,
          officialBtu: data.officialBtu,
          version: data.version,
          pdfSha256: data.pdfSha256,
          versionPda: data.versionPda,
          programId: data.programId,
          verifiedCode: data.verifiedCode || cleanCode,
          chainEvidence: data.chainEvidence,
        });
      } catch {
        setResult({
          unavailable: true,
          message:
            "The verification service is unavailable. No proof has been established. Please try again later.",
        });
      } finally {
        setPending(null);
      }
    },
    [code, fileError],
  );

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("code");
    if (value) {
      const clean = value.trim().toUpperCase();
      setCode(clean);
      if (/^D1-[A-Z2-7]{32}$/.test(clean)) {
        void runVerification(clean, null, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(withFile: boolean) {
    setTouched(true);
    if (pending) return;
    if (withFile) {
      if (!file || fileError) return;
      await runVerification(normalized, file, true);
    } else {
      if (!valid) return;
      await runVerification(normalized, null, false);
    }
  }

  const handlePdfSelection = async (selected: File | null) => {
    setFile(selected);
    setResult(null);
    setDiscoveryNote("");
    setDiscoveredCodes([]);
    setDiscrepancy(null);

    if (!selected) {
      setFileError("");
      return;
    }
    if (!/\.pdf$/i.test(selected.name)) {
      setFileError("Choose a PDF document to continue.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError("This file exceeds 10 MB. Choose a smaller PDF.");
      return;
    }
    if (selected.size === 0) {
      setFileError("This PDF is empty. Choose the original document.");
      return;
    }
    setFileError("");

    try {
      const discovery = await discoverCodesFromPdfFile(selected);
      setDiscoveredCodes(discovery.codes);
      if (discovery.codes.length === 1) {
        const pdfCode = discovery.codes[0];
        if (valid && normalized !== pdfCode) {
          setDiscrepancy({ typedCode: normalized, pdfCode });
          setDiscoveryNote(
            `Detected embedded code ${pdfCode} in the PDF, which differs from your entered code ${normalized}.`,
          );
        } else {
          setCode(pdfCode);
          setTouched(false);
          setDiscoveryNote(
            `Auto-detected verification code ${pdfCode} from the PDF QR/document. Comparing exact bytes…`,
          );
          await runVerification(pdfCode, selected, true);
        }
      } else if (discovery.codes.length > 1) {
        setDiscoveryNote(
          `Found ${discovery.codes.length} distinct verification codes in this PDF. Select which code to verify below.`,
        );
      } else if (discovery.unrelatedQrPayloads.length > 0) {
        setDiscoveryNote(
          "Found a QR code in this PDF, but it is not an OrionX passport code. Enter the D1-… code manually to compare bytes.",
        );
      } else {
        setDiscoveryNote(
          valid
            ? "Ready to compare against the entered verification code."
            : "Could not auto-detect an embedded QR code from this scan. Enter the D1-… code printed on the passport to compare bytes.",
        );
      }
    } catch {
      setDiscoveryNote(
        "Ready to compare. Click Compare PDF to verify the document bytes.",
      );
    }
  };

  const startCameraScan = async () => {
    setCameraError("");
    setScanStatus("Requesting camera access…");
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraError(
        "Camera access is not supported in this browser. Upload a QR screenshot or PDF instead.",
      );
      setScanStatus("");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setScanStatus("Point your camera at a passport QR code…");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 50);

      scanTimerRef.current = window.setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const decoded = decodeQrFromVideoFrame(
          videoRef.current,
          canvasRef.current,
        );
        if (decoded.codes.length > 0) {
          const found = decoded.codes[0];
          stopCamera();
          setCode(found);
          setTouched(false);
          setScanStatus(`Scanned QR code ${found} — verifying…`);
          void runVerification(found, file, Boolean(file && !fileError));
        } else if (decoded.rawPayload) {
          setScanStatus(
            "Detected a non-OrionX QR code. Point the camera at the passport verification QR.",
          );
        }
      }, 250);
    } catch {
      setCameraError(
        "Camera permission was denied or no camera hardware was found. You can upload a photo/screenshot of the QR code or drop the PDF instead.",
      );
      setScanStatus("");
      stopCamera();
    }
  };

  const handleQrImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    setCameraError("");
    setScanStatus("Scanning uploaded image for QR code…");
    try {
      const decoded = await decodeQrFromImageFile(imgFile);
      if (decoded.codes.length > 0) {
        const found = decoded.codes[0];
        setCode(found);
        setTouched(false);
        setScanStatus(`Decoded ${found} from image — verifying record…`);
        await runVerification(found, file, Boolean(file && !fileError));
      } else if (decoded.rawPayload) {
        setCameraError(
          `Found a QR code in the image (${decoded.rawPayload.slice(0, 60)}), but it does not contain a valid OrionX D1-… verification code.`,
        );
        setScanStatus("");
      } else {
        setCameraError(
          "No readable QR code was detected in that image. Try a clearer screenshot or upload the original PDF.",
        );
        setScanStatus("");
      }
    } catch {
      setCameraError(
        "Could not read that image file. Choose a PNG, JPG, or WebP screenshot.",
      );
      setScanStatus("");
    } finally {
      e.target.value = "";
    }
  };

  const isTampered = result?.integrity === "MISMATCH";
  const isRegistered = result?.registration === "REGISTERED";
  const isMatched = isRegistered && result?.integrity === "MATCH";
  const isUnavailable =
    result?.unavailable || result?.registration === "UNAVAILABLE";

  return (
    <Shell>
      <div className="page-heading">
        <div>
          <div className="eyebrow">INDEPENDENT CREDENTIAL VERIFICATION</div>
          <h1>Trust, with proof.</h1>
          <p className="lead">
            Check a passport’s registration and issuer, or upload its PDF to
            verify document integrity. No account required.
          </p>
        </div>
        <div className="page-actions">
          {!cameraActive ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => void startCameraScan()}
            >
              <Camera size={16} /> Scan QR with Camera
            </button>
          ) : (
            <button
              type="button"
              className="button button-crimson"
              onClick={stopCamera}
            >
              <CameraOff size={16} /> Stop Camera
            </button>
          )}
          <label className="button secondary" style={{ cursor: "pointer" }}>
            <ImageIcon size={16} /> Scan QR Image / Screenshot
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleQrImageUpload}
            />
          </label>
        </div>
      </div>

      {/* Live Camera QR Scanner Panel */}
      {(cameraActive || cameraError || scanStatus) && (
        <section className="card scanner-card" style={{ marginBottom: 22 }}>
          <div
            className="section-head"
            style={{ marginTop: 0, marginBottom: 12 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Camera size={18} color="var(--cyan)" />
              <h2 style={{ margin: 0, fontSize: 18 }}>QR Code Scanner</h2>
            </div>
            {cameraActive && (
              <button
                type="button"
                className="button secondary btn-sm"
                onClick={stopCamera}
              >
                Stop Scanning
              </button>
            )}
          </div>
          {scanStatus && (
            <p role="status" className="muted" style={{ margin: "0 0 10px" }}>
              {scanStatus}
            </p>
          )}
          {cameraError && (
            <p
              role="alert"
              className="notice notice-crimson"
              style={{ margin: "0 0 10px" }}
            >
              {cameraError}
            </p>
          )}
          {cameraActive && (
            <div className="camera-stage">
              <video
                ref={videoRef}
                playsInline
                muted
                className="camera-video"
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
          )}
        </section>
      )}

      <div className="verification-grid">
        {/* Card 1: Compare Original PDF (with Zero-Transcription Auto-Discovery) */}
        <section className="card">
          <div className="verify-heading">
            <div className="skill-icon icon-cyan">
              <UploadCloud size={21} />
            </div>
            <div>
              <h2>Drop or Select Passport PDF</h2>
              <p className="muted">
                Automatically extracts the embedded QR/version code and verifies
                every byte against Solana Devnet.
              </p>
            </div>
          </div>
          <div className="upload-zone">
            <UploadCloud size={26} />
            <label htmlFor="verify-file">
              Choose or drop an issued passport PDF
              <span>
                PDF files only (max 10 MB). Code is auto-detected when present.
              </span>
            </label>
          </div>
          <input
            id="verify-file"
            className="file-input"
            type="file"
            accept="application/pdf,.pdf"
            disabled={!!pending}
            aria-invalid={!!fileError}
            aria-describedby="file-hint"
            onChange={(e) => {
              const selected = e.target.files?.[0] || null;
              void handlePdfSelection(selected);
            }}
          />
          <p
            id="file-hint"
            className={`field-help${fileError ? " field-error" : ""}`}
            aria-live="polite"
          >
            {fileError ||
              discoveryNote ||
              (file
                ? "Ready to compare. Your PDF is checked against its registered SHA-256 fingerprint."
                : "Select a passport PDF to automatically discover its code and verify its exact bytes.")}
          </p>

          {discoveredCodes.length > 1 && (
            <div className="notice" style={{ marginTop: 0, marginBottom: 14 }}>
              <strong>Multiple codes detected in PDF — choose one:</strong>
              <div className="page-actions" style={{ marginTop: 8 }}>
                {discoveredCodes.map((dc) => (
                  <button
                    key={dc}
                    type="button"
                    className="button secondary btn-sm mono"
                    onClick={() => {
                      setCode(dc);
                      void runVerification(dc, file, true);
                    }}
                  >
                    {dc}
                  </button>
                ))}
              </div>
            </div>
          )}

          {discrepancy && file && (
            <div
              className="notice notice-crimson"
              style={{ marginTop: 0, marginBottom: 14 }}
            >
              <strong>Code Discrepancy Detected:</strong> This PDF contains{" "}
              <code className="mono">{discrepancy.pdfCode}</code>, while the
              input box has{" "}
              <code className="mono">{discrepancy.typedCode}</code>.
              <div className="page-actions" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="button btn-sm"
                  onClick={() => {
                    setCode(discrepancy.pdfCode);
                    setDiscrepancy(null);
                    void runVerification(discrepancy.pdfCode, file, true);
                  }}
                >
                  Verify PDF’s Code ({discrepancy.pdfCode.slice(0, 10)}…)
                </button>
                <button
                  type="button"
                  className="button secondary btn-sm"
                  onClick={() => {
                    setDiscrepancy(null);
                    void runVerification(discrepancy.typedCode, file, true);
                  }}
                >
                  Verify Typed Code ({discrepancy.typedCode.slice(0, 10)}…)
                </button>
              </div>
            </div>
          )}

          <button
            className="button"
            type="button"
            disabled={
              (!valid && discoveredCodes.length === 0) ||
              !file ||
              !!fileError ||
              !!pending
            }
            aria-busy={pending === "file"}
            onClick={() => void check(true)}
          >
            {pending === "file" ? (
              <LoaderCircle size={16} />
            ) : (
              <FileCheck2 size={16} />
            )}{" "}
            {pending === "file" ? "Comparing document…" : "Compare PDF"}
          </button>
        </section>

        {/* Card 2: Lookup by Verification Code */}
        <section className="card">
          <div className="verify-heading">
            <div className="skill-icon">
              <Search size={21} />
            </div>
            <div>
              <h2>Find the Passport Record by Code</h2>
              <p className="muted">
                Verify a version code printed on a passport or shared via link.
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void check(false);
            }}
            noValidate
          >
            <label htmlFor="verify-code" className="field-label">
              Verification code
            </label>
            <input
              id="verify-code"
              className="input mono"
              value={code}
              disabled={!!pending}
              onChange={(e) => {
                setCode(e.target.value);
                setResult(null);
                setDiscrepancy(null);
              }}
              onBlur={() => setTouched(true)}
              placeholder="D1- followed by 32 characters"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={codeError}
              aria-describedby="code-hint"
            />
            <p
              id="code-hint"
              className={`field-help${codeError ? " field-error" : ""}`}
              aria-live="polite"
            >
              {codeError
                ? "Enter a canonical D1- code followed by 32 Base32 characters (A-Z, 2-7)."
                : "Filled automatically when you drop a passport PDF, scan a QR code, or open a verification link."}
            </p>
            <button
              className="button secondary"
              type="submit"
              disabled={!!pending}
              aria-busy={pending === "code"}
            >
              {pending === "code" ? (
                <LoaderCircle size={16} />
              ) : (
                <Search size={16} />
              )}{" "}
              {pending === "code" ? "Checking record…" : "Verify code"}
            </button>
          </form>
        </section>
      </div>

      {/* Verification Result & 4-Pillar Proof Scorecard */}
      <div role="status" aria-live="polite">
        {pending && (
          <p className="field-help" style={{ marginTop: 18 }}>
            {pending === "file"
              ? "Comparing your PDF bytes with the finalized Solana Devnet record…"
              : "Looking up the passport version record on Solana Devnet…"}
          </p>
        )}

        {result && (
          <section
            className={`result-panel ${
              isTampered
                ? "result-panel-crimson"
                : isUnavailable
                  ? "result-panel-blue"
                  : isMatched
                    ? "result-panel-cyan"
                    : isRegistered
                      ? "result-panel-blue"
                      : "result-panel-crimson"
            }`}
          >
            <div
              className="info-line"
              style={{ justifyContent: "space-between", marginBottom: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isTampered || !isRegistered ? (
                  <AlertTriangle size={22} color="var(--crimson)" />
                ) : isMatched ? (
                  <CheckCircle2 size={22} color="var(--cyan)" />
                ) : (
                  <AlertCircle size={22} color="var(--primary)" />
                )}
                <strong style={{ fontSize: 16 }}>
                  {isUnavailable
                    ? "Verification is temporarily unavailable"
                    : isTampered
                      ? "This document doesn’t match its registered proof"
                      : isMatched
                        ? "Document matches its registered proof"
                        : isRegistered
                          ? "Registered record found"
                          : result.errorCode === "UNKNOWN_CODE"
                            ? "No credential found for this code"
                            : "Verification could not be completed"}
                </strong>
              </div>
              {result.version != null && (
                <span className="pill pill-blue">
                  PASSPORT VERSION V{result.version}
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: 14,
                color: "var(--ink)",
                margin: "6px 0 16px",
              }}
            >
              {result.message}
            </p>

            {/* Legacy & Automated Test Compatible Pills */}
            <div className="info-line" style={{ marginBottom: 18 }}>
              {result.registration && (
                <span
                  className={`pill ${
                    result.registration === "REGISTERED"
                      ? "pill-cyan"
                      : "pill-crimson"
                  }`}
                >
                  Record: {result.registration}
                </span>
              )}
              {result.integrity && (
                <span
                  className={`pill ${
                    result.integrity === "MATCH"
                      ? "pill-cyan"
                      : result.integrity === "MISMATCH"
                        ? "pill-crimson"
                        : "pill-blue"
                  }`}
                >
                  Document: {result.integrity}
                </span>
              )}
              {result.currency && (
                <span
                  className={`pill ${
                    result.currency === "LATEST" ? "pill-blue" : "pill-pink"
                  }`}
                >
                  Version: {result.currency}
                </span>
              )}
              {result.issuerTrust && (
                <span className="pill">Issuer: {result.issuerTrust}</span>
              )}
              <span className="pill">
                BTU authority:{" "}
                {result.officialBtu === true ? "Confirmed" : "Not confirmed"}
              </span>
            </div>

            {/* 4-Pillar Nontechnical Explainer Grid */}
            {result.registration && (
              <div className="proof-pillars-grid">
                <div className="proof-pillar-card">
                  <span className="mini-kicker">1. CHAIN RECORD</span>
                  <strong>{result.registration}</strong>
                  <p className="muted">
                    {result.registration === "REGISTERED"
                      ? "This version code is anchored and finalized on the Solana Devnet registry."
                      : "No finalized blockchain record exists for this verification code."}
                  </p>
                </div>

                <div className="proof-pillar-card">
                  <span className="mini-kicker">2. PDF BYTE INTEGRITY</span>
                  <strong
                    style={{
                      color:
                        result.integrity === "MISMATCH"
                          ? "var(--crimson)"
                          : result.integrity === "MATCH"
                            ? "var(--cyan-ink)"
                            : undefined,
                    }}
                  >
                    {result.integrity || "NOT CHECKED"}
                  </strong>
                  <p className="muted">
                    {result.integrity === "MATCH"
                      ? "Every byte of your uploaded PDF matches the SHA-256 hash recorded on-chain."
                      : result.integrity === "MISMATCH"
                        ? "The uploaded PDF has been altered—its SHA-256 fingerprint does not match the registered version."
                        : "Code lookup only. Upload the PDF above to verify that the document bytes have not been modified."}
                  </p>
                </div>

                <div className="proof-pillar-card">
                  <span className="mini-kicker">3. VERSION CURRENCY</span>
                  <strong>{result.currency || "UNKNOWN"}</strong>
                  <p className="muted">
                    {result.currency === "LATEST"
                      ? "This is the newest cumulative version issued for this student passport."
                      : result.currency === "SUPERSEDED"
                        ? "Authentic historical version. A newer cumulative version with additional skills has since been issued."
                        : "Version lineage could not be established."}
                  </p>
                </div>

                <div className="proof-pillar-card">
                  <span className="mini-kicker">4. ISSUER AUTHORITY</span>
                  <strong>
                    {result.officialBtu ? "BTU CONFIRMED" : "DEMO ISSUER"}
                  </strong>
                  <p className="muted">
                    {result.officialBtu
                      ? "Signed by an officially attested university issuer key."
                      : "Issued by the OrionX hackathon simulated Devnet issuer (officialBtu=false)."}
                  </p>
                </div>
              </div>
            )}

            {/* Technical Chain Evidence Accordion */}
            {(result.pdfSha256 ||
              result.versionPda ||
              result.chainEvidence) && (
              <details style={{ marginTop: 16 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  Inspect cryptographic & Solana Devnet proof metadata
                </summary>
                <div className="identity-box" style={{ marginTop: 10 }}>
                  {result.verifiedCode && (
                    <div>
                      <span className="mini-kicker">VERIFIED CODE: </span>
                      <code className="mono">{result.verifiedCode}</code>
                    </div>
                  )}
                  {result.pdfSha256 && (
                    <div>
                      <span className="mini-kicker">
                        REGISTERED PDF SHA-256:{" "}
                      </span>
                      <code className="mono">{result.pdfSha256}</code>
                    </div>
                  )}
                  {result.versionPda && (
                    <div>
                      <span className="mini-kicker">SOLANA VERSION PDA: </span>
                      <code className="mono">{result.versionPda}</code>
                    </div>
                  )}
                  {result.chainEvidence?.explorerAccount && (
                    <div style={{ marginTop: 6 }}>
                      <a
                        href={String(result.chainEvidence.explorerAccount)}
                        target="_blank"
                        rel="noreferrer"
                        className="action-link"
                      >
                        View account on Solana Explorer (Devnet){" "}
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </div>
              </details>
            )}
          </section>
        )}
      </div>

      <section className="verification-explainer">
        <h2>Understand what’s being checked</h2>
        <div className="verification-checks">
          {[
            {
              icon: Fingerprint,
              title: "Document integrity",
              description:
                "The PDF’s fingerprint is compared with its registered proof. A code lookup checks registration; upload the PDF to check that its contents match.",
            },
            {
              icon: History,
              title: "Version history",
              description:
                "See whether a credential is the latest cumulative version or a historical record. A newer version doesn’t erase the history of an earlier one.",
            },
            {
              icon: ShieldCheck,
              title: "Issuer authority",
              description:
                "Blockchain registration and university authority are separate checks. A demo issuer is identified explicitly and doesn’t establish official university authorization.",
            },
          ].map((x) => (
            <div key={x.title} className="explainer-card">
              <x.icon size={23} />
              <h3>{x.title}</h3>
              <p>{x.description}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="preview-notice">
        <LockKeyhole size={16} />
        <p>
          Preview artwork does not establish proof. Official BTU authorization
          requires independent university confirmation.
        </p>
      </div>
    </Shell>
  );
}
