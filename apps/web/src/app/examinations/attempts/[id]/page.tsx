"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Cloud,
  Flag,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { api, useSession } from "@/lib/session";
import type { Attempt } from "@/lib/assessments";
import { dateLabel } from "@/lib/passport";

export default function AssessmentAttemptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading } = useSession();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [answers, setAnswers] = useState<Attempt["answers"]>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("All changes saved");
  const [now, setNow] = useState(Date.now());
  const [retry, setRetry] = useState(0);
  const current = useRef<Attempt | null>(null);
  const responses = useRef<Attempt["answers"]>({});
  const flags = useRef<string[]>([]);
  const generation = useRef(0);
  const savedGeneration = useRef(0);
  const lastSaveAt = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const submitLock = useRef(false);
  const clockOffset = useRef(0);
  const expiryChecking = useRef(false);
  const heading = useRef<HTMLLegendElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const applyServer = useCallback((value: Attempt, reset = false) => {
    current.current = value;
    clockOffset.current = Date.parse(value.serverNow) - Date.now();
    setAttempt(value);
    setNow(Date.now());
    if (reset || value.submittedAt) {
      responses.current = value.answers;
      flags.current = value.flagged;
      setAnswers(value.answers);
      setFlagged(value.flagged);
      generation.current = 0;
      savedGeneration.current = 0;
    }
  }, []);
  useEffect(() => {
    if (!session) {
      setFetching(false);
      return;
    }
    let active = true;
    current.current = null;
    setAttempt(null);
    setIndex(0);
    setStatus("All changes saved");
    setFetching(true);
    setLoadError("");
    setSaveError("");
    api(`/assessment-attempts/${id}`)
      .then((value) => {
        if (active) applyServer(value, true);
      })
      .catch((e) => {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : "Unable to load attempt",
          );
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [id, session?.subject, retry, applyServer]);
  const persist = useCallback(
    (submit = false) => {
      let taskResult: Attempt | null = null;
      const task = queue.current
        .catch(() => {})
        .then(async () => {
          const a = current.current;
          if (!a || a.id !== id || a.submittedAt) {
            taskResult = a;
            return;
          }
          if (!submit && savedGeneration.current === generation.current) return;
          const change = generation.current;
          lastSaveAt.current = Date.now();
          if (mounted.current) {
            setStatus(submit ? "Submitting…" : "Saving…");
            setSaveError("");
          }
          const value: Attempt = await api(
            `/assessment-attempts/${id}/${submit ? "submit" : "save"}`,
            {
              method: "POST",
              body: JSON.stringify({
                revision: a.revision,
                answers: responses.current,
                flagged: flags.current,
              }),
            },
          );
          taskResult = value;
          savedGeneration.current = change;
          if (mounted.current && current.current?.id === value.id) {
            applyServer(value);
            setStatus(
              generation.current === change
                ? "All changes saved"
                : "Unsaved changes",
            );
          }
        });
      queue.current = task;
      return task
        .then(() => taskResult)
        .catch((e) => {
          if (mounted.current) {
            setStatus("Changes not saved");
            setSaveError(
              e instanceof Error
                ? e.message
                : "Unable to save. Check your connection and try again.",
            );
          }
          throw e;
        });
    },
    [id, applyServer],
  );
  useEffect(() => {
    if (
      !attempt ||
      attempt.submittedAt ||
      generation.current === savedGeneration.current ||
      submitting
    )
      return;
    const timer = setTimeout(
      () => {
        void persist().catch(() => {});
      },
      Math.max(650, 2500 - (Date.now() - lastSaveAt.current)),
    );
    return () => clearTimeout(timer);
  }, [answers, flagged, attempt?.id, submitting, persist]);
  useEffect(() => {
    if (!attempt || attempt.submittedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [attempt?.id, attempt?.submittedAt]);
  const remaining = attempt?.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(attempt.expiresAt) - now - clockOffset.current) / 1000,
        ),
      )
    : null;
  const expired = remaining === 0;
  useEffect(() => {
    if (!expired || !attempt || attempt.submittedAt || expiryChecking.current)
      return;
    expiryChecking.current = true;
    setStatus("Checking final result…");
    queue.current
      .catch(() => {})
      .then(() => api(`/assessment-attempts/${id}`))
      .then((a) => {
        if (mounted.current) applyServer(a, true);
      })
      .catch(() => {
        if (mounted.current)
          setSaveError(
            "Time has ended. Reconnect and reload to retrieve your result. The server uses your last saved answers.",
          );
      })
      .finally(() => {
        expiryChecking.current = false;
      });
  }, [expired, attempt?.id, attempt?.submittedAt, id, applyServer]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (
        generation.current !== savedGeneration.current &&
        !current.current?.submittedAt
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  function select(optionId: string) {
    const q = attempt?.questions[index];
    if (!q || expired || submitting) return;
    const previous = responses.current[q.id] || [];
    const next =
      q.type === "SINGLE_CHOICE"
        ? [optionId]
        : previous.includes(optionId)
          ? previous.filter((o) => o !== optionId)
          : [...previous, optionId];
    responses.current = { ...responses.current, [q.id]: next };
    generation.current++;
    setAnswers(responses.current);
    setStatus("Unsaved changes");
  }
  function toggleFlag() {
    const q = attempt?.questions[index];
    if (!q || expired || submitting) return;
    flags.current = flags.current.includes(q.id)
      ? flags.current.filter((f) => f !== q.id)
      : [...flags.current, q.id];
    generation.current++;
    setFlagged(flags.current);
    setStatus("Unsaved changes");
  }
  function navigate(n: number) {
    setIndex(n);
    setTimeout(() => heading.current?.focus(), 0);
  }
  async function submit() {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await persist(true);
      setReview(false);
    } catch {
    } finally {
      submitLock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }
  async function saveAndLeave() {
    try {
      await persist();
      router.push("/examinations");
    } catch {}
  }
  const answered =
    attempt?.questions.filter((q) => (answers[q.id] || []).length > 0).length ||
    0;
  const unanswered =
    attempt?.questions
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => !(answers[q.id] || []).length) || [];
  const q = attempt?.questions[index];
  return (
    <Shell onExit={() => void saveAndLeave()} exitBusy={submitting}>
      {loading || fetching ? (
        <Skeleton />
      ) : !session ? (
        <EmptyState
          icon={LockKeyhole}
          title="Sign in to return to your assessment"
          description="Your saved progress is tied to your private university account."
          href={`/login?next=/examinations/attempts/${id}`}
          action="Sign in"
        />
      ) : loadError ? (
        <ErrorState message={loadError} retry={() => setRetry((n) => n + 1)} />
      ) : attempt?.submittedAt ? (
        <div className="result-layout">
          <Link className="back-link" href="/examinations">
            <ArrowLeft size={15} />
            All assessments
          </Link>
          <div className="result-hero" style={{ marginTop: 25 }}>
            <div>
              <Badge tone={attempt.passed ? "success" : "warning"}>
                {attempt.passed ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <BookOpen size={12} />
                )}{" "}
                {attempt.passed
                  ? "Assessment passed"
                  : "Assessment completed · not passed"}
              </Badge>
              <h1>
                {attempt.passed
                  ? "A step forward. Well earned."
                  : "A clearer view of what’s next."}
              </h1>
              <p>{attempt.assessment.title}</p>
              <p>
                {attempt.passed
                  ? "You met the passing requirement for this assessment. Your result is saved in your assessment history."
                  : "Review the assessment objectives before your next eligible attempt. This result stays in your learning history."}
              </p>
            </div>
            <div className="result-score">
              <strong>{attempt.scorePercent}%</strong>
              <span>{attempt.assessment.passingPercent}% required to pass</span>
            </div>
          </div>
          <div className="result-details">
            <section className="card">
              <h2>Assessment details</h2>
              <dl className="exam-facts" style={{ marginBottom: 0 }}>
                <div>
                  <dt>Completed</dt>
                  <dd>{dateLabel(attempt.submittedAt)}</dd>
                </div>
                <div>
                  <dt>Attempt</dt>
                  <dd>
                    {attempt.number} of {attempt.assessment.maxAttempts}
                  </dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>{attempt.questions.length}</dd>
                </div>
                <div>
                  <dt>Answered</dt>
                  <dd>
                    {answered} of {attempt.questions.length}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="card">
              <h2>{attempt.passed ? "Skills covered" : "Areas to revisit"}</h2>
              <div className="assessment-tags">
                {attempt.assessment.skills.map((s) => (
                  <span className="assessment-tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="privacy-note" style={{ marginTop: 20 }}>
                <ShieldCheck size={17} />
                <p>
                  Assessment results are separate from university-issued
                  credentials. Your university decides whether an achievement
                  qualifies for a passport badge.
                </p>
              </div>
            </section>
          </div>
          <section className="result-next-steps">
            <h2>Keep your momentum.</h2>
            <div className="page-actions">
              <Link className="button" href="/examinations">
                Explore assessments
                <ArrowRight size={15} />
              </Link>
              <Link className="button secondary" href="/passport">
                <Award size={15} />
                View my passport
              </Link>
              {!attempt.passed &&
                attempt.number < attempt.assessment.maxAttempts && (
                  <Link
                    className="button secondary"
                    href={`/examinations/${attempt.assessmentId}`}
                  >
                    Review assessment
                  </Link>
                )}
            </div>
          </section>
        </div>
      ) : (
        attempt &&
        q && (
          <>
            <div className="exam-titlebar">
              <div>
                <div className="eyebrow">
                  ASSESSMENT · ATTEMPT {attempt.number}
                </div>
                <h1>{attempt.assessment.title}</h1>
              </div>
              <div className="top-actions">
                <span className="exam-save-status" role="status">
                  <Cloud size={13} />
                  {status}
                </span>
                <div
                  className={`timer ${remaining !== null && remaining < 120 ? "timer-warning" : ""}`}
                  aria-label={
                    remaining === null
                      ? "No time limit"
                      : `${Math.floor(remaining / 60)} minutes and ${remaining % 60} seconds remaining`
                  }
                >
                  <Clock3 size={14} />
                  {remaining === null
                    ? "Untimed"
                    : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}
                </div>
              </div>
            </div>
            {saveError && (
              <div>
                <ErrorState message={saveError} />
                <div className="page-actions" style={{ marginBottom: 20 }}>
                  <Button
                    secondary
                    onClick={() => void persist().catch(() => {})}
                    disabled={expired || submitting}
                  >
                    Retry saving
                  </Button>
                  <Button secondary onClick={() => setRetry((n) => n + 1)}>
                    Reload saved attempt
                  </Button>
                </div>
              </div>
            )}
            {expired && (
              <div className="notice">
                Your time has ended. Your last saved answers are being finalized
                by the server.{" "}
                <button
                  type="button"
                  className="action-link"
                  style={{ background: "none", border: 0 }}
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Retrieve result
                </button>
              </div>
            )}
            <div className="exam-layout">
              <section className="exam-question-panel">
                <div className="exam-progress-caption">
                  <span>
                    Question {index + 1} of {attempt.questions.length}
                  </span>
                  <span>{answered} answered</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Questions answered"
                  aria-valuenow={answered}
                  aria-valuemin={0}
                  aria-valuemax={attempt.questions.length}
                >
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(answered / attempt.questions.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="question-heading">
                  <span className="mini-kicker">
                    {q.type === "MULTIPLE_CHOICE"
                      ? "MULTIPLE ANSWERS"
                      : "SINGLE ANSWER"}
                  </span>
                  <button
                    type="button"
                    className="flag-button"
                    aria-pressed={flagged.includes(q.id)}
                    onClick={toggleFlag}
                    disabled={expired || submitting}
                  >
                    <Flag size={13} />
                    {flagged.includes(q.id)
                      ? "Flagged for review"
                      : "Flag for review"}
                  </button>
                </div>
                <fieldset
                  className="question-fieldset"
                  disabled={expired || submitting}
                >
                  <legend ref={heading} tabIndex={-1}>
                    {q.prompt}
                  </legend>
                  <p className="question-help">
                    {q.type === "MULTIPLE_CHOICE"
                      ? "Select all answers that apply."
                      : "Select one answer."}
                  </p>
                  <div className="answer-options">
                    {q.options.map((o, i) => (
                      <label
                        key={`${q.id}-${o.id}`}
                        className={`answer-option ${(answers[q.id] || []).includes(o.id) ? "selected" : ""}`}
                      >
                        <input
                          type={
                            q.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"
                          }
                          name={q.id}
                          value={o.id}
                          checked={(answers[q.id] || []).includes(o.id)}
                          onChange={() => select(o.id)}
                        />
                        <span className="answer-letter">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="answer-text">{o.text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="question-nav-actions">
                  <Button
                    secondary
                    onClick={() => navigate(index - 1)}
                    disabled={index === 0}
                  >
                    <ArrowLeft size={14} />
                    Previous
                  </Button>
                  {index < attempt.questions.length - 1 ? (
                    <Button onClick={() => navigate(index + 1)}>
                      Next question
                      <ArrowRight size={14} />
                    </Button>
                  ) : (
                    <Button onClick={() => setReview(true)} disabled={expired}>
                      Review answers
                      <Check size={14} />
                    </Button>
                  )}
                </div>
                <p className="field-help">
                  Your answers save automatically. For a safe exit, use “Save &
                  leave” below.
                </p>
                <Button
                  secondary
                  className="btn-sm"
                  onClick={() => void saveAndLeave()}
                  disabled={submitting || expired}
                >
                  <Save size={13} />
                  Save & leave
                </Button>
              </section>
              <aside className="question-navigator">
                <h2>Question navigator</h2>
                <p>Jump to a question at any time.</p>
                <div className="question-grid">
                  {attempt.questions.map((question, i) => (
                    <button
                      type="button"
                      key={question.id}
                      onClick={() => navigate(i)}
                      className={`${i === index ? "current" : ""} ${(answers[question.id] || []).length ? "answered" : ""} ${flagged.includes(question.id) ? "flagged" : ""}`}
                      aria-label={`Question ${i + 1}, ${(answers[question.id] || []).length ? "answered" : "unanswered"}${flagged.includes(question.id) ? ", flagged" : ""}`}
                      aria-current={i === index ? "step" : undefined}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="navigator-legend">
                  <span>
                    <i className="legend-square answered" />
                    Answered
                  </span>
                  <span>
                    <i className="legend-square" />
                    Unanswered
                  </span>
                  <span>
                    <i className="legend-square flagged" />
                    Flagged
                  </span>
                </div>
                <Button
                  secondary
                  onClick={() => setReview(true)}
                  disabled={expired || submitting}
                >
                  Review & submit
                  <ArrowRight size={13} />
                </Button>
                <p className="exam-exit-note">
                  You can review your answers before final submission.{" "}
                  {attempt.expiresAt
                    ? "The timer continues while you review or leave this page."
                    : "This attempt has no time limit."}
                </p>
              </aside>
            </div>
            <Dialog
              open={review}
              onClose={() => {
                if (!submitting) setReview(false);
              }}
              title="Ready to submit?"
            >
              <p>
                Take a moment to check your answers. Final submission ends this
                attempt and cannot be undone.
              </p>
              <div className="review-stats">
                <div>
                  <strong>{answered}</strong>Answered
                </div>
                <div>
                  <strong>{unanswered.length}</strong>Unanswered
                </div>
                <div>
                  <strong>{flagged.length}</strong>Flagged for review
                </div>
              </div>
              {unanswered.length > 0 && (
                <>
                  <p>
                    Unanswered questions receive no points. Select a question
                    below to return to it.
                  </p>
                  <div className="review-question-list">
                    {unanswered.map(({ i }) => (
                      <button
                        type="button"
                        key={i}
                        aria-label={`Review unanswered question ${i + 1}`}
                        onClick={() => {
                          setReview(false);
                          navigate(i);
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {flagged.length > 0 && (
                <p>
                  {flagged.length}{" "}
                  {flagged.length === 1 ? "question is" : "questions are"} still
                  flagged. Flags don’t affect your score.
                </p>
              )}
              {saveError && <ErrorState message={saveError} />}
              <div className="page-actions">
                <Button
                  secondary
                  onClick={() => setReview(false)}
                  disabled={submitting}
                >
                  Keep reviewing
                </Button>
                <Button
                  onClick={() => void submit()}
                  busy={submitting}
                  disabled={expired}
                >
                  Submit assessment
                  <Check size={14} />
                </Button>
              </div>
            </Dialog>
          </>
        )
      )}
    </Shell>
  );
}
