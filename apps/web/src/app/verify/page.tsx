"use client";
import { useEffect, useState } from "react";
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
} from "lucide-react";

type Result = {
  message: string;
  registration?: string;
  integrity?: string;
  issuerTrust?: string;
  currency?: string;
  officialBtu?: boolean;
};
// Preserve the existing public verification API. No issuance or chain logic lives in the UI.
const API = (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/+$/, "");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function Verify() {
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState<"code" | "file" | null>(null);
  const normalized = code.trim().toUpperCase();
  const valid = /^D1-[A-Z2-7]{32}$/.test(normalized);
  const codeError = touched && !valid;
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("code");
    if (value) setCode(value);
  }, []);

  async function check(withFile: boolean) {
    setTouched(true);
    if (!valid || pending || (withFile && (!file || fileError))) return;
    setPending(withFile ? "file" : "code");
    setResult(null);
    try {
      let response: Response;
      if (withFile) {
        const form = new FormData();
        form.append("code", normalized);
        form.append("file", file!);
        response = await fetch(API + "/api/v1/verify/file", {
          method: "POST",
          body: form,
        });
      } else
        response = await fetch(
          API + "/api/v1/verify/" + encodeURIComponent(normalized),
        );
      const data = await response.json();
      if (!response.ok) {
        setResult({
          message:
            data.error?.message ||
            data.message ||
            "Verification could not be completed. Check your code and try again.",
        });
      } else {
        setResult({
          message: data.message || "No verified proof returned.",
          registration: data.registration,
          integrity: data.integrity,
          issuerTrust: data.issuerTrust,
          currency: data.currency,
          officialBtu: data.officialBtu,
        });
      }
    } catch {
      setResult({
        message:
          "The verification service is unavailable. No proof has been established. Please try again later.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Shell>
      <div className="eyebrow">OPEN TO EVERYONE</div>
      <h1>Verify a digital passport</h1>
      <p className="lead">
        Check a passport’s record and compare its PDF. No account needed.
      </p>
      <div className="verification-grid">
        <section className="card">
          <div className="verify-heading">
            <div className="skill-icon">
              <Search size={21} />
            </div>
            <div>
              <h2>Find the passport record</h2>
              <p className="muted">
                Start with the code printed on the document.
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
              className="input"
              value={code}
              disabled={!!pending}
              onChange={(e) => {
                setCode(e.target.value);
                setResult(null);
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
                ? "Enter D1- followed by 32 letters (A-Z) or digits (2-7)."
                : "The code identifies the record. A successful check is needed to establish proof."}
            </p>
            <button
              className="button"
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
        <section className="card">
          <div className="verify-heading">
            <div className="skill-icon">
              <UploadCloud size={21} />
            </div>
            <div>
              <h2>Compare the original PDF</h2>
              <p className="muted">
                Optional. Check whether the document has changed.
              </p>
            </div>
          </div>
          <div className="upload-zone">
            <UploadCloud size={26} />
            <label htmlFor="verify-file">
              Choose a passport PDF
              <span>PDF files only. Maximum size 10 MB.</span>
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
              setFile(selected);
              setResult(null);
              setFileError(
                selected && !/\.pdf$/i.test(selected.name)
                  ? "Choose a PDF document to continue."
                  : selected && selected.size > MAX_FILE_SIZE
                    ? "This file exceeds 10 MB. Choose a smaller PDF."
                    : selected && selected.size === 0
                      ? "This PDF is empty. Choose the original document."
                      : "",
              );
            }}
          />
          <p
            id="file-hint"
            className={`field-help${fileError ? " field-error" : ""}`}
            aria-live="polite"
          >
            {fileError ||
              (file
                ? "Ready to compare. Your PDF is sent only when you select Compare PDF."
                : "Choose a file and enter its verification code to compare the document.")}
          </p>
          <button
            className="button secondary"
            type="button"
            disabled={!valid || !file || !!fileError || !!pending}
            aria-busy={pending === "file"}
            onClick={() => check(true)}
          >
            {pending === "file" ? (
              <LoaderCircle size={16} />
            ) : (
              <FileCheck2 size={16} />
            )}{" "}
            {pending === "file" ? "Comparing document…" : "Compare PDF"}
          </button>
        </section>
      </div>
      <div role="status" aria-live="polite">
        {pending && (
          <p className="field-help">
            {pending === "file"
              ? "Comparing your document with its registered record…"
              : "Looking up the passport record…"}
          </p>
        )}
        {result && (
          <section className="result-panel">
            <div className="info-line">
              <AlertCircle size={20} />
              <strong>Verification result</strong>
            </div>
            <p>{result.message}</p>
            <div className="info-line">
              {result.registration && (
                <span className="pill">Record: {result.registration}</span>
              )}
              {result.integrity && (
                <span className="pill">Document: {result.integrity}</span>
              )}
              {result.currency && (
                <span className="pill">Version: {result.currency}</span>
              )}
              {result.issuerTrust && (
                <span className="pill">Issuer: {result.issuerTrust}</span>
              )}
              <span className="pill">
                BTU authority:{" "}
                {result.officialBtu === true ? "Confirmed" : "Not confirmed"}
              </span>
            </div>
          </section>
        )}
      </div>
      <section className="verification-explainer">
        <h2>What a verification checks</h2>
        <div className="verification-checks">
          {[
            {
              icon: Fingerprint,
              title: "The document",
              description:
                "Compares the exact PDF with its registered fingerprint. Even a small edit changes that fingerprint.",
            },
            {
              icon: ShieldCheck,
              title: "The issuer",
              description:
                "Checks the issuer’s identity separately from the document’s integrity.",
            },
            {
              icon: History,
              title: "The version",
              description:
                "Checks whether the document is the latest version of the same permanent passport.",
            },
          ].map((x) => (
            <div key={x.title}>
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
