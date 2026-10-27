"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  FileQuestion,
  GraduationCap,
  History,
  LockKeyhole,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Shell } from "@/components/shell";
import {
  Badge,
  EmptyState,
  ErrorState,
  PageHeading,
  Skeleton,
} from "@/components/ui";
import { useSession } from "@/lib/session";
import { useResource } from "@/lib/use-resource";
import type { Catalog } from "@/lib/assessments";
import { dateLabel } from "@/lib/passport";

export default function Examinations() {
  const { session, loading } = useSession();
  const {
    data,
    error,
    loading: pending,
    reload,
  } = useResource<Catalog>("/assessments", !!session);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All assessments");
  const assessments =
    data?.assessments.filter(
      (a) =>
        (a.title + " " + a.skills.join(" "))
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter !== "In progress" || !!a.activeAttemptId),
    ) || [];
  return (
    <Shell>
      <PageHeading
        eyebrow="LEARNING & ASSESSMENT"
        title="Put your skills to the test."
        description="Focused assessments. Clear expectations. A record of your progress."
      >
        {session?.role === "admin" && (
          <Link className="button secondary" href="/admin/assessments">
            Assessment studio
            <ArrowRight size={15} />
          </Link>
        )}
      </PageHeading>
      {loading ? (
        <Skeleton />
      ) : !session ? (
        <EmptyState
          icon={LockKeyhole}
          title="Your next challenge is waiting"
          description="Sign in to explore assessments published by your university, resume an attempt, and review your results."
          href="/login?next=/examinations"
          action="Sign in to explore"
        />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : pending ? (
        <Skeleton />
      ) : (
        <>
          {!data?.eligible && (
            <div className="notice">
              <GraduationCap
                size={16}
                style={{ verticalAlign: "middle", marginRight: 8 }}
              />
              Browse assessment details now. Your university must link your
              student record before you can begin.
            </div>
          )}
          <div className="collection-toolbar">
            <div
              className="filter-group"
              role="group"
              aria-label="Filter assessments"
            >
              {["All assessments", "In progress"].map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f}
                  {f === "All assessments" && data
                    ? ` · ${data.assessments.length}`
                    : ""}
                </button>
              ))}
            </div>
            <label className="search-field">
              <span className="sr-only">Search assessments</span>
              <Search size={16} />
              <input
                className="input"
                placeholder="Search title or skill…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          {assessments.length ? (
            <div className="assessment-list">
              {assessments.map((a) => {
                const exhausted =
                  a.attemptsUsed >= a.maxAttempts && !a.activeAttemptId;
                return (
                  <article className="assessment-row" key={a.id}>
                    <span className="assessment-row-icon">
                      <BookOpen size={22} strokeWidth={1.5} />
                    </span>
                    <div>
                      <Badge tone={a.activeAttemptId ? "blue" : "neutral"}>
                        {a.activeAttemptId ? "In progress" : a.difficulty}
                      </Badge>
                      <h2>
                        <Link href={`/examinations/${a.id}`}>{a.title}</Link>
                      </h2>
                      <p>{a.description}</p>
                      <div className="assessment-meta">
                        <span>
                          <Clock3 size={13} />
                          {a.durationMinutes
                            ? `${a.durationMinutes} minutes`
                            : "No time limit"}
                        </span>
                        <span>
                          <FileQuestion size={13} />
                          {a.questionCount} questions
                        </span>
                        <span>
                          <ShieldCheck size={13} />
                          {a.passingPercent}% to pass
                        </span>
                      </div>
                      <div className="assessment-tags">
                        {a.skills.map((s) => (
                          <span className="assessment-tag" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="assessment-row-action">
                      <Link
                        className={`button ${a.activeAttemptId ? "" : "secondary"}`}
                        href={
                          a.activeAttemptId
                            ? `/examinations/attempts/${a.activeAttemptId}`
                            : `/examinations/${a.id}`
                        }
                      >
                        {a.activeAttemptId
                          ? "Resume attempt"
                          : "View assessment"}
                        <ArrowRight size={14} />
                      </Link>
                      <small>
                        {exhausted
                          ? "All attempts used"
                          : `${a.maxAttempts - a.attemptsUsed} ${a.maxAttempts - a.attemptsUsed === 1 ? "attempt" : "attempts"} available`}
                      </small>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title={
                query
                  ? "No matching assessments"
                  : filter === "In progress"
                    ? "A clear starting point"
                    : "Your next assessment is on its way"
              }
              description={
                query
                  ? "Try another title or skill, or clear your search."
                  : filter === "In progress"
                    ? "You don’t have any active attempts. Browse all assessments to choose what’s next."
                    : "Published university assessments will appear here. There’s nothing you need to do for now."
              }
            />
          )}
          <section className="history-section">
            <div className="section-head">
              <h2>Assessment history</h2>
              <History size={17} className="muted" />
            </div>
            {data?.history.length ? (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Assessment history"
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>Assessment</th>
                      <th>Date</th>
                      <th>Attempt</th>
                      <th>Outcome</th>
                      <th>
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <strong>{h.title}</strong>
                        </td>
                        <td>{dateLabel(h.startedAt)}</td>
                        <td>{h.number}</td>
                        <td>
                          <Badge
                            tone={
                              !h.submittedAt
                                ? "blue"
                                : h.passed
                                  ? "success"
                                  : "warning"
                            }
                          >
                            {!h.submittedAt
                              ? "In progress"
                              : `${h.passed ? "Passed" : "Not passed"} · ${h.scorePercent}%`}
                          </Badge>
                        </td>
                        <td>
                          <Link
                            className="action-link"
                            href={`/examinations/attempts/${h.id}`}
                          >
                            {h.submittedAt ? "View result" : "Resume"}
                            <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="results-empty">
                Your attempts and results will appear here after you begin an
                assessment.
              </p>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}
