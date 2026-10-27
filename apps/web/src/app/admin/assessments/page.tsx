"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Shell } from "@/components/shell";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeading,
  Skeleton,
} from "@/components/ui";
import { api, useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type { Assessment } from "@/lib/assessments";
import { dateLabel } from "@/lib/passport";

type AdminAssessment = Assessment & {
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  attemptCount: number;
};
type DraftQuestion = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
};
const newQuestion = (): DraftQuestion => ({
  id: crypto.randomUUID(),
  type: "SINGLE_CHOICE",
  prompt: "",
  options: [
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ],
  correctOptionIds: [],
});
export default function AssessmentStudio() {
  const { session, loading } = useSession();
  const {
    data: list,
    error,
    loading: pending,
    reload,
  } = useResource<AdminAssessment[]>(
    "/admin/assessments",
    session?.role === "admin",
  );
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [skills, setSkills] = useState("");
  const [difficulty, setDifficulty] = useState("Foundational");
  const [duration, setDuration] = useState("");
  const [passing, setPassing] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    assessment: AdminAssessment;
    action: "publish" | "archive";
  } | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function start() {
    setEditingId(null);
    setCreating(true);
    setActionError("");
    setTitle("");
    setDescription("");
    setObjectives("");
    setSkills("");
    setDifficulty("Foundational");
    setDuration("");
    setPassing(70);
    setMaxAttempts(2);
    setQuestions([newQuestion()]);
  }
  async function edit(id: string) {
    setBusy(true);
    setActionError("");
    try {
      const draft = await api(`/admin/assessments/${id}`);
      setEditingId(id);
      setTitle(draft.title);
      setDescription(draft.description);
      setObjectives(draft.objectives.join("\n"));
      setSkills(draft.skills.join(", "));
      setDifficulty(draft.difficulty);
      setDuration(draft.durationMinutes ? String(draft.durationMinutes) : "");
      setPassing(draft.passingPercent);
      setMaxAttempts(draft.maxAttempts);
      setQuestions(draft.questions);
      setCreating(true);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Unable to open assessment draft",
      );
    } finally {
      setBusy(false);
    }
  }
  function updateQuestion(index: number, change: Partial<DraftQuestion>) {
    setQuestions((qs) =>
      qs.map((q, i) => (i === index ? { ...q, ...change } : q)),
    );
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api(
        editingId
          ? `/admin/assessments/${editingId}/update`
          : "/admin/assessments",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            description,
            objectives: objectives
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            skills: skills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            difficulty,
            durationMinutes: duration ? Number(duration) : null,
            passingPercent: passing,
            maxAttempts,
            questions,
          }),
        },
      );
      setCreating(false);
      reload();
      setToast("Assessment draft saved. Review its details before publishing.");
      setTimeout(() => document.getElementById("main-content")?.focus(), 0);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Unable to create assessment",
      );
    } finally {
      setBusy(false);
    }
  }
  async function act() {
    if (!confirmation || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api(
        `/admin/assessments/${confirmation.assessment.id}/${confirmation.action}`,
        { method: "POST" },
      );
      setToast(
        confirmation.action === "publish"
          ? "Assessment published to linked students."
          : "Assessment archived. Existing attempts are preserved.",
      );
      setConfirmation(null);
      reload();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Unable to update assessment",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <PageHeading
        eyebrow="UNIVERSITY · ASSESSMENT STUDIO"
        title={
          creating
            ? editingId
              ? "Edit assessment draft"
              : "Create an assessment"
            : "Assessment studio"
        }
        description={
          creating
            ? "Set clear expectations and build questions for a focused assessment."
            : "Publish assessments, define attempt rules, and keep a clear audit trail."
        }
      >
        {session?.role === "admin" && !creating && (
          <Button onClick={start}>
            <Plus size={15} />
            New assessment
          </Button>
        )}
      </PageHeading>
      {loading ? (
        <Skeleton />
      ) : !session ? (
        <EmptyState
          icon={LockKeyhole}
          title="Administrator access required"
          description="Sign in with your university-authorized administrator account to manage assessments."
          href="/login?next=/admin/assessments"
          action="Sign in"
        />
      ) : session.role !== "admin" ? (
        <EmptyState
          icon={ShieldCheck}
          title="This workspace is for authorized staff"
          description="You can explore your university’s published assessments from your learning workspace."
          href="/examinations"
          action="Browse assessments"
        />
      ) : creating ? (
        <form className="studio-form" onSubmit={create}>
          <button
            type="button"
            className="back-link"
            style={{
              border: 0,
              background: "none",
              padding: 0,
              marginBottom: 22,
            }}
            onClick={() => setCreating(false)}
            disabled={busy}
          >
            <ArrowLeft size={15} />
            Back to studio
          </button>
          <section className="card">
            <h2>Assessment details</h2>
            <div className="form-stack">
              <label>
                <span className="field-label">Title</span>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  minLength={5}
                  maxLength={160}
                />
              </label>
              <label>
                <span className="field-label">Description</span>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={20}
                  maxLength={3000}
                />
              </label>
              <label>
                <span className="field-label">
                  Learning objectives · one per line
                </span>
                <textarea
                  className="input"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  required
                  maxLength={3600}
                />
              </label>
              <label>
                <span className="field-label">
                  Skills covered · comma separated
                </span>
                <input
                  className="input"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  required
                  maxLength={1200}
                />
              </label>
            </div>
          </section>
          <section className="card">
            <h2>Attempt rules</h2>
            <div className="form-grid">
              <label>
                <span className="field-label">Difficulty</span>
                <select
                  className="input"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  {["Foundational", "Intermediate", "Advanced"].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">
                  Time limit in minutes · optional
                </span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={180}
                  placeholder="Untimed"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Passing requirement (%)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  value={passing}
                  onChange={(e) => setPassing(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                <span className="field-label">Maximum attempts</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={10}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                  required
                />
              </label>
            </div>
            <p className="field-help" style={{ marginBottom: 0 }}>
              Only accounts linked to a university student record can start.
              Each question has equal weight. Multiple-answer questions use
              exact-match scoring. Published content is immutable; archive an
              assessment and create a new version to revise it.
            </p>
          </section>
          <section>
            <div className="section-head">
              <h2>
                Questions <Badge>{questions.length}</Badge>
              </h2>
              <Button
                secondary
                className="btn-sm"
                onClick={() => setQuestions((q) => [...q, newQuestion()])}
                disabled={questions.length >= 60}
              >
                <Plus size={13} />
                Add question
              </Button>
            </div>
            <p className="field-help">
              Mark the correct answer beside each option. Answer keys stay on
              the server and are excluded from student responses.
            </p>
            {questions.map((q, i) => (
              <fieldset className="question-editor" key={q.id} disabled={busy}>
                <div className="question-editor-head">
                  <h3>Question {i + 1}</h3>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() =>
                      setQuestions((qs) => qs.filter((_, n) => n !== i))
                    }
                    disabled={questions.length <= 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="form-stack">
                  <label>
                    <span className="field-label">Question type</span>
                    <select
                      className="input"
                      value={q.type}
                      onChange={(e) =>
                        updateQuestion(i, {
                          type: e.target.value as DraftQuestion["type"],
                          correctOptionIds: [],
                        })
                      }
                    >
                      <option value="SINGLE_CHOICE">Single answer</option>
                      <option value="MULTIPLE_CHOICE">Multiple answers</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Question prompt</span>
                    <textarea
                      className="input"
                      value={q.prompt}
                      onChange={(e) =>
                        updateQuestion(i, { prompt: e.target.value })
                      }
                      required
                      minLength={10}
                      maxLength={3000}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 18 }}>
                  <span className="field-label">
                    Answer options · select{" "}
                    {q.type === "SINGLE_CHOICE"
                      ? "the correct answer"
                      : "all correct answers"}
                  </span>
                  {q.options.map((o, j) => (
                    <div key={o.id} className="editor-option">
                      <input
                        type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                        name={`key-${q.id}`}
                        aria-label={`Question ${i + 1}: option ${j + 1} is correct`}
                        checked={q.correctOptionIds.includes(o.id)}
                        onChange={() =>
                          updateQuestion(i, {
                            correctOptionIds:
                              q.type === "SINGLE_CHOICE"
                                ? [o.id]
                                : q.correctOptionIds.includes(o.id)
                                  ? q.correctOptionIds.filter(
                                      (id) => id !== o.id,
                                    )
                                  : [...q.correctOptionIds, o.id],
                          })
                        }
                      />
                      <input
                        aria-label={`Question ${i + 1}: option ${j + 1} text`}
                        className="input"
                        placeholder={`Option ${j + 1}`}
                        value={o.text}
                        required
                        maxLength={1000}
                        onChange={(e) =>
                          updateQuestion(i, {
                            options: q.options.map((option) =>
                              option.id === o.id
                                ? { ...option, text: e.target.value }
                                : option,
                            ),
                          })
                        }
                      />
                      {q.options.length > 2 && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove option ${j + 1} from question ${i + 1}`}
                          onClick={() =>
                            updateQuestion(i, {
                              options: q.options.filter(
                                (option) => option.id !== o.id,
                              ),
                              correctOptionIds: q.correctOptionIds.filter(
                                (id) => id !== o.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    secondary
                    className="btn-sm"
                    style={{ marginTop: 13 }}
                    disabled={q.options.length >= 8}
                    onClick={() =>
                      updateQuestion(i, {
                        options: [
                          ...q.options,
                          { id: crypto.randomUUID(), text: "" },
                        ],
                      })
                    }
                  >
                    <Plus size={12} />
                    Add option
                  </Button>
                </div>
              </fieldset>
            ))}
          </section>
          {actionError && <ErrorState message={actionError} />}
          <div className="notice">
            This creates a private draft. Publishing is a separate step.
            Assessment results never automatically issue credentials.
          </div>
          <div className="page-actions">
            <Button type="submit" busy={busy}>
              Save assessment draft
              <ArrowRight size={14} />
            </Button>
            <Button
              secondary
              onClick={() => setCreating(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {actionError && !confirmation && <ErrorState message={actionError} />}
          {error ? (
            <ErrorState message={error} retry={reload} />
          ) : pending ? (
            <Skeleton />
          ) : list?.length ? (
            <div
              className="table-wrap"
              role="region"
              aria-label="University assessments"
              tabIndex={0}
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Rules</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.title}</strong>
                        <div className="muted">
                          Created {dateLabel(a.createdAt)} · {a.questionCount}{" "}
                          questions
                        </div>
                      </td>
                      <td>
                        {a.durationMinutes
                          ? `${a.durationMinutes} min`
                          : "Untimed"}
                        <div className="muted">
                          {a.passingPercent}% to pass · {a.maxAttempts} attempts
                        </div>
                      </td>
                      <td>
                        <Badge
                          tone={
                            a.archivedAt
                              ? "neutral"
                              : a.publishedAt
                                ? "success"
                                : "blue"
                          }
                        >
                          {a.archivedAt
                            ? "Archived"
                            : a.publishedAt
                              ? "Published"
                              : "Draft"}
                        </Badge>
                      </td>
                      <td>{a.attemptCount}</td>
                      <td>
                        <div className="page-actions">
                          {!a.archivedAt && !a.publishedAt && (
                            <Button
                              secondary
                              className="btn-sm"
                              onClick={() => void edit(a.id)}
                              disabled={busy}
                            >
                              Edit draft
                            </Button>
                          )}
                          {!a.archivedAt && !a.publishedAt && (
                            <Button
                              secondary
                              className="btn-sm"
                              onClick={() => {
                                setActionError("");
                                setConfirmation({
                                  assessment: a,
                                  action: "publish",
                                });
                              }}
                            >
                              <Send size={12} />
                              Publish
                            </Button>
                          )}
                          {a.publishedAt && !a.archivedAt && (
                            <Link
                              className="action-link"
                              href={`/examinations/${a.id}`}
                            >
                              Overview
                              <ArrowRight size={12} />
                            </Link>
                          )}
                          {!a.archivedAt && (
                            <Button
                              secondary
                              className="btn-sm"
                              onClick={() => {
                                setActionError("");
                                setConfirmation({
                                  assessment: a,
                                  action: "archive",
                                });
                              }}
                            >
                              <Archive size={12} />
                              Archive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="A fresh assessment library"
              description="Create your first assessment with clear objectives, validated answer keys, and server-enforced attempt rules."
            />
          )}
          <div className="privacy-note" style={{ marginTop: 28 }}>
            <ShieldCheck size={18} />
            <p>
              Publishing makes an assessment available to linked students.
              Creation, publishing, and archiving are logged in the university
              audit trail. Credential issuance remains in your existing
              authorized workflow.
            </p>
          </div>
          <Link className="back-link" href="/admin">
            <ArrowLeft size={14} />
            Back to administration
          </Link>
        </>
      )}
      <Dialog
        open={!!confirmation}
        onClose={() => {
          if (!busy) setConfirmation(null);
        }}
        title={
          confirmation?.action === "publish"
            ? "Publish this assessment?"
            : "Archive this assessment?"
        }
      >
        {confirmation && (
          <>
            <p>
              <strong>{confirmation.assessment.title}</strong>
            </p>
            <p>
              {confirmation.action === "publish"
                ? "Linked students will be able to begin immediately. Questions and scoring rules are fixed after publishing. Confirm the rules below before continuing."
                : "This removes the assessment from discovery and prevents new attempts. Existing attempts and results are preserved."}
            </p>
            <dl className="exam-facts">
              <div>
                <dt>Questions</dt>
                <dd>{confirmation.assessment.questionCount}</dd>
              </div>
              <div>
                <dt>Time limit</dt>
                <dd>
                  {confirmation.assessment.durationMinutes
                    ? `${confirmation.assessment.durationMinutes} minutes`
                    : "Untimed"}
                </dd>
              </div>
              <div>
                <dt>Passing score</dt>
                <dd>{confirmation.assessment.passingPercent}%</dd>
              </div>
              <div>
                <dt>Attempts per student</dt>
                <dd>{confirmation.assessment.maxAttempts}</dd>
              </div>
            </dl>
            {actionError && <ErrorState message={actionError} />}
            <div className="page-actions">
              <Button
                secondary
                onClick={() => setConfirmation(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={() => void act()} busy={busy}>
                {confirmation.action === "publish"
                  ? "Publish assessment"
                  : "Archive assessment"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </Shell>
  );
}
