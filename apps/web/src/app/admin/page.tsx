"use client";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {Shell} from "@/components/shell";
import {api, useSession} from "@/lib/session";

type Passport = {
  id: string;
  publicId: string;
  latestFinalizedVersion: number;
  activeVersionId: string | null;
  student: {externalId: string; firstName: string; lastName: string; program: string};
  _count: {versions: number};
};

export default function Admin() {
  const {session, loading, signOut} = useSession();
  const [records, setRecords] = useState<Passport[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [run, setRun] = useState<{id: string; state: string; totals: Record<string, number>} | null>(null);

  const load = () =>
    api("/admin/passports")
      .then(setRecords)
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load student records"));

  useEffect(() => {
    if (session?.role === "admin") load();
  }, [session?.role]);

  useEffect(() => {
    if (!run || !["QUEUED", "RUNNING"].includes(run.state)) return;
    const timer = setInterval(
      () =>
        api("/admin/sync-runs/" + run.id)
          .then(r => {
            setRun(r);
            if (!["QUEUED", "RUNNING"].includes(r.state)) load();
          })
          .catch(e => setError(e instanceof Error ? e.message : "Unable to check sync status")),
      2000,
    );
    return () => clearInterval(timer);
  }, [run?.id, run?.state]);

  const filtered = useMemo(
    () =>
      records.filter(r =>
        [r.publicId, r.student.firstName + " " + r.student.lastName, r.student.program].some(s =>
          s.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [records, query],
  );

  return (
    <Shell>
      <div className="eyebrow">OPERATIONS / DEMO WORKSPACE</div>
      <h1>Passport administration</h1>
      <p className="lead">Manage synchronization and inspect the durable issuance ledger.</p>
      {loading ? (
        <p role="status">Loading session…</p>
      ) : !session ? (
        <section className="card" style={{maxWidth: 560}}>
          <h2>Administrator sign in required</h2>
          <p className="muted" style={{marginBottom: 18}}>
            Sign in with a Google account explicitly bound to the administrator role.
          </p>
          <Link className="button" href="/login?next=/admin">
            Continue with Google
          </Link>
        </section>
      ) : session.role !== "admin" ? (
        <section className="card" style={{maxWidth: 620}}>
          <h2>Administrator authorization required</h2>
          <p role="alert" className="notice">
            Your account does not have administrator access. Signed in as <b>{session.email || session.subject}</b> (
            <code>{session.role || "IDENTITY_UNBOUND"}</code>).
          </p>
          <div className="page-actions" style={{marginTop: 16}}>
            <Link className="button" href="/passport">
              My Passport
            </Link>
            <button type="button" className="button secondary" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="stats">
            {[
              {label: "Imported passports", value: records.length},
              {label: "Finalized versions", value: records.reduce((n, p) => n + p.latestFinalizedVersion, 0)},
              {label: "Updates in progress", value: records.filter(r => r.activeVersionId).length},
            ].map(s => (
              <section className="card" key={s.label}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
              </section>
            ))}
          </div>
          <section className="card" style={{marginBottom: 24}}>
            <div className="section-head" style={{marginTop: 0}}>
              <h2>Synchronize source</h2>
              <button
                className="button"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  setError("");
                  try {
                    setRun(await api("/admin/sync", {method: "POST", headers: {"Idempotency-Key": crypto.randomUUID()}}));
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Synchronization unavailable");
                  } finally {
                    setSyncing(false);
                  }
                }}
              >
                {syncing ? "Synchronizing…" : "Run synchronization"}
              </button>
            </div>
            <p className="muted">
              Source status never establishes blockchain proof. Only finalized registrations count as issued.
            </p>
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
            <div className="section-head" style={{marginTop: 0}}>
              <h2>Student records</h2>
              <span className="pill">FICTIONAL TEST DATA</span>
            </div>
            <input
              aria-label="Search student records"
              placeholder="Search name, passport or program"
              className="input"
              value={query}
              onChange={e => setQuery(e.target.value)}
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
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td>
                        <b>
                          {p.student.firstName} {p.student.lastName}
                        </b>
                        <div className="muted">{p.student.program}</div>
                      </td>
                      <td>{p.publicId}</td>
                      <td>{p.latestFinalizedVersion ? "V" + p.latestFinalizedVersion : "Not issued"}</td>
                      <td>{p.activeVersionId ? "Processing" : "—"}</td>
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
