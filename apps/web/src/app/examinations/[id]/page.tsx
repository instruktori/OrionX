"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  LockKeyhole,
} from "lucide-react";
import { Shell } from "@/components/shell";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { api, useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type { Assessment, Attempt } from "@/lib/assessments";

export default function AssessmentIntroduction() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading } = useSession();
  const {
    data: a,
    error,
    loading: pending,
    reload,
  } = useResource<Assessment>(`/assessments/${id}`, !!session);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  async function begin() {
    if (starting) return;
    setStarting(true);
    setStartError("");
    try {
      const attempt: Attempt = await api(`/assessments/${id}/attempts`, {
        method: "POST",
      });
      router.push(`/examinations/attempts/${attempt.id}`);
    } catch (e) {
      setStartError(
        e instanceof Error ? e.message : "Unable to start assessment",
      );
      setStarting(false);
    }
  }
  const exhausted =
    !!a && a.attemptsUsed >= a.maxAttempts && !a.activeAttemptId;
  return (
    <Shell>
      <Link className="back-link" href="/examinations">
        <ArrowLeft size={15} />
        All assessments
      </Link>
      {loading || pending ? (
        <div style={{ marginTop: 30 }}>
          <Skeleton />
        </div>
      ) : !session ? (
        <div style={{ marginTop: 30 }}>
          <EmptyState
            icon={LockKeyhole}
            title="Sign in to view this assessment"
            description="Assessment details and attempts are available in your private workspace."
            href={`/login?next=/examinations/${id}`}
            action="Sign in"
          />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        a && (
          <div className="exam-intro">
            <section className="exam-intro-main">
              <div className="eyebrow">ASSESSMENT OVERVIEW</div>
              <h1>{a.title}</h1>
              <p className="lead">{a.description}</p>
              <div className="assessment-tags">
                <Badge tone="blue">{a.difficulty}</Badge>
                {a.skills.map((s) => (
                  <span className="assessment-tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              <h2>What you’ll demonstrate</h2>
              <ul className="objectives">
                {a.objectives.map((o) => (
                  <li key={o}>
                    <CheckCircle2 size={16} />
                    {o}
                  </li>
                ))}
              </ul>
              <h2>Before you begin</h2>
              <div className="exam-rules">
                <p>
                  This assessment includes{" "}
                  {a.questionTypes.includes("MULTIPLE_CHOICE")
                    ? "single-answer and multiple-answer"
                    : "single-answer"}{" "}
                  questions. Read each question’s instructions before selecting
                  your answer. Each question carries equal weight;
                  multiple-answer questions require all correct selections.
                </p>
                <p>
                  You can move between questions, flag them for review, and
                  change your answers before submitting. Answers are saved
                  automatically while you’re connected.
                </p>
                <p>
                  {a.durationMinutes
                    ? `The ${a.durationMinutes}-minute timer starts when you begin and continues if you leave. When time runs out, the server grades your last saved answers.`
                    : "This assessment has no time limit. You can save your progress and return to the same attempt later."}
                </p>
                <p>
                  You have {a.maxAttempts}{" "}
                  {a.maxAttempts === 1 ? "attempt" : "attempts"} in total. Final
                  submission cannot be undone. Passing an assessment does not
                  automatically issue a badge or university credential.
                </p>
              </div>
            </section>
            <aside className="exam-start-panel">
              <h2>Your assessment at a glance</h2>
              <dl className="exam-facts">
                <div>
                  <dt>Questions</dt>
                  <dd>{a.questionCount}</dd>
                </div>
                <div>
                  <dt>Time limit</dt>
                  <dd>
                    {a.durationMinutes
                      ? `${a.durationMinutes} minutes`
                      : "Untimed"}
                  </dd>
                </div>
                <div>
                  <dt>Passing requirement</dt>
                  <dd>{a.passingPercent}%</dd>
                </div>
                <div>
                  <dt>Attempts used</dt>
                  <dd>
                    {a.attemptsUsed} of {a.maxAttempts}
                  </dd>
                </div>
                <div>
                  <dt>Prerequisite</dt>
                  <dd>Linked university record</dd>
                </div>
                <div>
                  <dt>Save & resume</dt>
                  <dd>Available</dd>
                </div>
              </dl>
              {startError && <ErrorState message={startError} />}
              {a.activeAttemptId ? (
                <Link
                  className="button"
                  href={`/examinations/attempts/${a.activeAttemptId}`}
                >
                  Resume your attempt
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <Button
                  onClick={begin}
                  busy={starting}
                  disabled={!a.eligible || exhausted}
                >
                  {exhausted ? "All attempts used" : "Begin assessment"}
                  {!starting && <ArrowRight size={15} />}
                </Button>
              )}
              {!a.eligible ? (
                <p className="field-help">
                  <GraduationCap
                    size={13}
                    style={{ verticalAlign: "middle", marginRight: 4 }}
                  />
                  Ask your university administrator to link your student record
                  before beginning.
                </p>
              ) : (
                <p className="field-help">
                  {exhausted
                    ? "You can review previous results in assessment history."
                    : a.durationMinutes
                      ? "Starting will begin your timed attempt."
                      : "Your progress stays in your private workspace."}
                </p>
              )}
            </aside>
          </div>
        )
      )}
    </Shell>
  );
}
