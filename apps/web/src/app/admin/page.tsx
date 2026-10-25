"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/shell";
import { api, useSession } from "@/lib/session";

type Passport = {
  id: string;
  publicId: string;
  latestFinalizedVersion: number;
  activeVersionId: string | null;
  student: {
    externalId: string;
    firstName: string;
    lastName: string;
    program: string;
  };
  _count: { versions: number };
};

export default function Admin() {
  const { session, loading, signOut } = useSession();
  const [records, setRecords] = useState<Passport[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const stopProcessing = useRef(false);
  const [run, setRun] = useState<{
    id: string;
    state: string;
    totals: Record<string, number>;
  } | null>(null);

  const load = () =>
    api("/admin/passports")
      .then(setRecords)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Unable to load student records",
        ),
      );

  useEffect(() => () => { stopProcessing.current = true; }, []);

  const processJobs = async () => {
    stopProcessing.current = false;
    setProcessing(true);
    setError("");
    setProgress("Checking pending jobs…");
    let completedStages = 0;
    try {
      while (!stopProcessing.current) {
        const result = await api("/admin/jobs/process", {method: "POST"});
        if (result.processed) completedStages++;
        setProgress(`${completedStages} processing steps finished · ${result.remaining} jobs remaining${result.blocked ? ` · ${result.blocked} need administrator review` : ""}`);
        if (!result.remaining) { await load(); break; }
        const next = result.nextAvailableAt ? new Date(result.nextAvailableAt).getTime() - Date.now() : 2000;
        await new Promise(resolve => setTimeout(resolve, Math.min(10000, Math.max(2000, result.processed ? 2000 : next))));
      }
      if (stopProcessing.current) setProgress("Stopped after the current step. Pending jobs are saved; select Process pending jobs to continue.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing unavailable. Pending jobs are saved; try again.");
    } finally {
      setProcessing(false);
      await load();
    }
  };

  useEffect(() => {
    if (session?.role === "admin") load();
  }, [session?.role]);

  useEffect(() => {
    if (!run || !["QUEUED", "RUNNING"].includes(run.state)) return;
    const timer = setInterval(
      () =>
        api("/admin/sync-runs/" + run.id)
          .then((r) => {
            setRun(r);
            if (!["QUEUED", "RUNNING"].includes(r.state)) load();
          })
          .catch((e) =>
            setError(
              e instanceof Error ? e.message : "Unable to check sync status",
            ),
          ),
      2000,
    );
    return () => clearInterval(timer);
  }, [run?.id, run?.state]);

  const filtered = useMemo(
    () =>
      records.filter((r) =>
        [
          r.publicId,
          r.student.firstName + " " + r.student.lastName,
          r.student.program,
        ].some((s) => s.toLowerCase().includes(query.toLowerCase())),
      ),
    [records, query],
  );

  return (
    <Shell>
      <div className="eyebrow">WORKSPACE OPERATIONS</div>
      <h1>Passport administration</h1>
      <p className="lead">
        Manage student passport records and review their version history.
      </p>
      {loading ? (
        <p className="loading-state" role="status">
          Loading session…
        </p>
      ) : !session ? (
        <section className="card access-card">
          <div>
            <h2>Administrator sign in required</h2>
            <p className="muted">
              Sign in with the Google account linked to your university
              administrator role.
            </p>
          </div>
          <Link className="button" href="/login?next=/admin">
            Continue with Google
          </Link>
        </section>
      ) : session.role !== "admin" ? (
        <section className="card" style={{ maxWidth: 620 }}>
          <h2>Administrator authorization required</h2>
          <p role="alert" className="notice">
            Your account does not have administrator access. Signed in as{" "}
            <b>{session.email || session.subject}</b> (
            <code>{session.role || "IDENTITY_UNBOUND"}</code>).
          </p>
          <div className="page-actions" style={{ marginTop: 16 }}>
            <Link className="button" href="/passport">
              My Passport
            </Link>
            <button
              type="button"
              className="button secondary"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="stats">
            {[
              { label: "Imported passports", value: records.length },
              {
                label: "Finalized versions",
                value: records.reduce(
                  (n, p) => n + p.latestFinalizedVersion,
                  0,
                ),
              },
              {
                label: "Updates in progress",
                value: records.filter((r) => r.activeVersionId).length,
              },
            ].map((s) => (
              <section className="card" key={s.label}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
              </section>
            ))}
          </div>
          <section className="card" style={{ marginBottom: 24 }}>
            <div className="section-head" style={{ marginTop: 0 }}>
              <h2>Synchronize source</h2>
              <button
                className="button"
                disabled={syncing || processing}
                onClick={async () => {
                  setSyncing(true);
                  setError("");
                  try {
                    setRun(
                      await api("/admin/sync", {
                        method: "POST",
                        headers: { "Idempotency-Key": crypto.randomUUID() },
                      }),
                    );
                    await load();
                    await processJobs();
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Synchronization unavailable",
                    );
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? "Synchronizing…" : "Run synchronization"}
              </button>
            </div>
            <p className="muted">
              Run synchronization to import verified source changes and process their PDFs,
              blockchain registration and source updates. Keep this page open while it runs.
              Only finalized registrations count as issued.
            </p>
            <div className="page-actions">
              <button type="button" className="button secondary" disabled={processing || syncing} onClick={() => void processJobs()}>
                {processing ? "Processing jobs…" : "Process pending jobs"}
              </button>
              {processing && <button type="button" className="button secondary" onClick={() => { stopProcessing.current = true; setProgress("Finishing the current step before stopping…"); }}>Stop after current step</button>}
            </div>
            {progress && <p role="status" aria-live="polite" style={{marginTop: 16}}>{progress}</p>}
            {run && (
              <div role="status">
                <strong>{run.state.replaceAll("_", " ")}</strong>
                <p>
                  {Object.entries(run.totals)
                    .map(([k, v]) => k + ": " + v)
                    .join(" · ")}
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
          </section>
          <section className="card">
            <div className="section-head" style={{ marginTop: 0 }}>
              <h2>Student records</h2>
              <span className="pill">FICTIONAL TEST DATA</span>
            </div>
            <label htmlFor="student-search" className="field-label">
              Search student records
            </label>
            <input
              id="student-search"
              aria-label="Search student records"
              placeholder="Search name, passport or program"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>PASSPORT ID</th>
                    <th>ISSUED VERSION</th>
                    <th>UPDATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>
                          {p.student.firstName} {p.student.lastName}
                        </b>
                        <div className="muted">{p.student.program}</div>
                      </td>
                      <td>{p.publicId}</td>
                      <td>
                        {p.latestFinalizedVersion
                          ? "V" + p.latestFinalizedVersion
                          : "Not issued"}
                      </td>
                      <td>{p.activeVersionId ? "Processing" : "None"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <p role="status" className="muted">
                No matching student records.
              </p>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
