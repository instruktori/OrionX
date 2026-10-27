import { z } from "zod";
import {
  Prisma,
  type Assessment,
  type AssessmentAttempt,
} from "@prisma/client";
import { prisma } from "@orionx/db";
import { DomainError } from "@orionx/core/src/errors";
import type { Identity } from "@orionx/core/src/auth";

const questionSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE"]),
    prompt: z.string().trim().min(10).max(3000),
    options: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
          text: z.string().trim().min(1).max(1000),
        }),
      )
      .min(2)
      .max(8),
    correctOptionIds: z
      .array(z.string())
      .min(1, "Select at least one correct answer for every question.")
      .max(8),
  })
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    if (
      new Set(ids).size !== ids.length ||
      new Set(q.correctOptionIds).size !== q.correctOptionIds.length ||
      q.correctOptionIds.some((id) => !ids.includes(id)) ||
      (q.type === "SINGLE_CHOICE" && q.correctOptionIds.length !== 1)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Each question requires unique options and a valid answer key",
      });
    }
  });
export const assessmentSchema = z
  .object({
    title: z.string().trim().min(5).max(160),
    description: z.string().trim().min(20).max(3000),
    objectives: z.array(z.string().trim().min(3).max(300)).min(1).max(12),
    skills: z.array(z.string().trim().min(2).max(100)).min(1).max(12),
    difficulty: z.enum(["Foundational", "Intermediate", "Advanced"]),
    durationMinutes: z.number().int().min(1).max(180).nullable(),
    passingPercent: z.number().int().min(1).max(100),
    maxAttempts: z.number().int().min(1).max(10),
    questions: z.array(questionSchema).min(1).max(60),
  })
  .superRefine((a, ctx) => {
    if (new Set(a.questions.map((q) => q.id)).size !== a.questions.length)
      ctx.addIssue({
        code: "custom",
        message: "Question identifiers must be unique",
      });
  });
export type AssessmentContent = z.infer<typeof assessmentSchema>;
export type Answers = Record<string, string[]>;
const updateSchema = z.object({
  revision: z.number().int().nonnegative(),
  answers: z.record(z.string().max(64), z.array(z.string().max(64)).max(8)),
  flagged: z.array(z.string().max(64)).max(60),
});
const asJson = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
const parse = <T>(schema: z.ZodType<T>, body: unknown): T => {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new DomainError(
      "INVALID_ASSESSMENT",
      result.error.issues[0]?.message || "Check assessment fields",
      400,
    );
  return result.data;
};
export function studentForAssessment(user: Identity) {
  if (
    !user.studentId ||
    (user.verification !== "UNIVERSITY_VERIFIED" &&
      user.verification !== "ADMIN")
  )
    throw new DomainError(
      "STUDENT_LINK_REQUIRED",
      "Your university must link your student record before you can begin an assessment.",
      403,
    );
  return user.studentId;
}
export function publicAssessment(
  a: Assessment | (AssessmentContent & { id?: string }),
) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    objectives: a.objectives,
    skills: a.skills,
    difficulty: a.difficulty,
    durationMinutes: a.durationMinutes,
    passingPercent: a.passingPercent,
    maxAttempts: a.maxAttempts,
    questionCount: (a.questions as AssessmentContent["questions"]).length,
    questionTypes: [
      ...new Set(
        (a.questions as AssessmentContent["questions"]).map((q) => q.type),
      ),
    ],
  };
}
export function validateAnswers(
  content: AssessmentContent,
  answers: Answers,
  flagged: string[],
) {
  const ids = content.questions.map((q) => q.id);
  if (
    Object.keys(answers).some((id) => !ids.includes(id)) ||
    flagged.some((id) => !ids.includes(id)) ||
    new Set(flagged).size !== flagged.length
  )
    throw new DomainError(
      "INVALID_ANSWERS",
      "Unknown question identifier",
      400,
    );
  for (const q of content.questions) {
    const selected = answers[q.id] || [];
    if (
      new Set(selected).size !== selected.length ||
      selected.some((id) => !q.options.some((o) => o.id === id)) ||
      (q.type === "SINGLE_CHOICE" && selected.length > 1)
    )
      throw new DomainError(
        "INVALID_ANSWERS",
        "Answer selection is not valid for this question",
        400,
      );
  }
}
export function grade(content: AssessmentContent, answers: Answers) {
  const correct = content.questions.filter((q) => {
    const selected = answers[q.id] || [];
    return (
      selected.length === q.correctOptionIds.length &&
      q.correctOptionIds.every((id) => selected.includes(id))
    );
  }).length;
  // Use the exact ratio for passing; rounding is for presentation only.
  return {
    scorePercent: Math.round((correct * 100) / content.questions.length),
    passed: correct * 100 >= content.passingPercent * content.questions.length,
  };
}
export function publicAttempt(a: AssessmentAttempt, now = new Date()) {
  const content = a.content as AssessmentContent;
  return {
    id: a.id,
    assessmentId: a.assessmentId,
    number: a.number,
    revision: a.revision,
    startedAt: a.startedAt,
    expiresAt: a.expiresAt,
    submittedAt: a.submittedAt,
    updatedAt: a.updatedAt,
    serverNow: now,
    answers: a.answers,
    flagged: a.flagged,
    scorePercent: a.submittedAt ? a.scorePercent : null,
    passed: a.submittedAt ? a.passed : null,
    assessment: publicAssessment(content),
    questions: content.questions.map(({ correctOptionIds: _key, ...q }) => q),
  };
}
async function expire(a: AssessmentAttempt): Promise<AssessmentAttempt> {
  for (let retry = 0; retry < 4; retry++) {
    if (a.submittedAt || !a.expiresAt || a.expiresAt.getTime() > Date.now())
      return a;
    const result = grade(a.content as AssessmentContent, a.answers as Answers);
    const changed = await prisma.assessmentAttempt.updateMany({
      where: { id: a.id, submittedAt: null, revision: a.revision },
      data: { ...result, submittedAt: a.expiresAt, revision: { increment: 1 } },
    });
    a = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: a.id },
    });
    if (changed.count || a.submittedAt) return a;
  }
  throw new DomainError(
    "ATTEMPT_BUSY",
    "Your result is being finalized. Please reload in a moment.",
    409,
  );
}
export async function catalog(user: Identity) {
  const assessments = await prisma.assessment.findMany({
    where: { publishedAt: { not: null }, archivedAt: null },
    orderBy: { publishedAt: "desc" },
    take: 100,
  });
  const [recent, relevant, completedCount] = user.studentId
    ? await Promise.all([
        prisma.assessmentAttempt.findMany({
          where: { studentId: user.studentId },
          orderBy: { startedAt: "desc" },
          take: 200,
        }),
        prisma.assessmentAttempt.findMany({
          where: {
            studentId: user.studentId,
            assessmentId: { in: assessments.map((a) => a.id) },
          },
        }),
        prisma.assessmentAttempt.count({
          where: { studentId: user.studentId, submittedAt: { not: null } },
        }),
      ])
    : [[], [], 0];
  const attempts = [
    ...new Map([...recent, ...relevant].map((a) => [a.id, a])).values(),
  ];
  const resolved = await Promise.all(attempts.map(expire));
  const byId = new Map(resolved.map((a) => [a.id, a]));
  return {
    eligible: !!user.studentId,
    completedCount:
      completedCount +
      resolved.filter(
        (a) =>
          a.submittedAt &&
          !attempts.find((original) => original.id === a.id)?.submittedAt,
      ).length,
    assessments: assessments.map((a) => ({
      ...publicAssessment(a),
      attemptsUsed: attempts.filter((t) => t.assessmentId === a.id).length,
      activeAttemptId:
        resolved.find((t) => t.assessmentId === a.id && !t.submittedAt)?.id ||
        null,
    })),
    history: recent
      .map((original) => byId.get(original.id)!)
      .map((a) => ({
        id: a.id,
        assessmentId: a.assessmentId,
        title: (a.content as AssessmentContent).title,
        number: a.number,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        scorePercent: a.scorePercent,
        passed: a.passed,
      })),
  };
}
export async function assessmentDetail(id: string, user: Identity) {
  const a = await prisma.assessment.findFirst({
    where: { id, publishedAt: { not: null }, archivedAt: null },
  });
  if (!a) throw new DomainError("NOT_FOUND", "Assessment not found", 404);
  const attempts = user.studentId
    ? await prisma.assessmentAttempt.findMany({
        where: { assessmentId: id, studentId: user.studentId },
        orderBy: { number: "desc" },
      })
    : [];
  const resolved = await Promise.all(attempts.map(expire));
  return {
    ...publicAssessment(a),
    eligible: !!user.studentId,
    attemptsUsed: resolved.length,
    activeAttemptId: resolved.find((t) => !t.submittedAt)?.id || null,
  };
}
export async function beginAttempt(id: string, user: Identity) {
  const studentId = studentForAssessment(user);
  // Serializable transaction plus a unique attempt number prevents parallel start requests
  // from exceeding attempt limits, including across server instances.
  for (let retry = 0; retry < 4; retry++) {
    try {
      const attempt = await prisma.$transaction(
        async (tx) => {
          const assessment = await tx.assessment.findFirst({
            where: { id, publishedAt: { not: null }, archivedAt: null },
          });
          if (!assessment)
            throw new DomainError("NOT_FOUND", "Assessment not found", 404);
          const attempts = await tx.assessmentAttempt.findMany({
            where: { assessmentId: id, studentId },
            orderBy: { number: "desc" },
          });
          const active = attempts.find((t) => !t.submittedAt);
          if (active) return active;
          if (attempts.length >= assessment.maxAttempts)
            throw new DomainError(
              "ATTEMPTS_EXHAUSTED",
              "You have used all attempts for this assessment.",
              409,
            );
          const now = new Date();
          return tx.assessmentAttempt.create({
            data: {
              assessmentId: id,
              studentId,
              number: attempts.length + 1,
              content: asJson(parse(assessmentSchema, assessment)),
              answers: {},
              flagged: [],
              startedAt: now,
              expiresAt: assessment.durationMinutes
                ? new Date(now.getTime() + assessment.durationMinutes * 60000)
                : null,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return publicAttempt(await expire(attempt));
    } catch (error) {
      if (
        ["P2034", "P2002"].includes((error as { code?: string }).code || "") &&
        retry < 3
      )
        continue;
      throw error;
    }
  }
  throw new DomainError(
    "ATTEMPT_BUSY",
    "Please try starting the assessment again",
    409,
  );
}
async function ownedAttempt(id: string, user: Identity) {
  const studentId = studentForAssessment(user);
  const attempt = await prisma.assessmentAttempt.findFirst({
    where: { id, studentId },
  });
  if (!attempt) throw new DomainError("NOT_FOUND", "Attempt not found", 404);
  return expire(attempt);
}
export async function readAttempt(id: string, user: Identity) {
  return publicAttempt(await ownedAttempt(id, user));
}
export async function saveAttempt(
  id: string,
  user: Identity,
  body: unknown,
  submit = false,
) {
  const input = parse(updateSchema, body);
  const attempt = await ownedAttempt(id, user);
  if (attempt.submittedAt) return publicAttempt(attempt); // Idempotent submission and expired attempts.
  const content = attempt.content as AssessmentContent;
  validateAnswers(content, input.answers, input.flagged);
  const now = new Date();
  const result = await prisma.assessmentAttempt.updateMany({
    where: {
      id,
      studentId: attempt.studentId,
      submittedAt: null,
      revision: input.revision,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: {
      answers: asJson(input.answers),
      flagged: asJson(input.flagged),
      revision: { increment: 1 },
      ...(submit ? { ...grade(content, input.answers), submittedAt: now } : {}),
    },
  });
  if (!result.count) {
    const current = await ownedAttempt(id, user);
    if (current.submittedAt) return publicAttempt(current);
    throw new DomainError(
      "ATTEMPT_CONFLICT",
      "This attempt changed in another tab. Reload the saved attempt before continuing.",
      409,
    );
  }
  return publicAttempt(
    await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id } }),
  );
}
export async function listAdminAssessments() {
  const assessments = await prisma.assessment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { attempts: true } } },
  });
  // Keys are accepted on authoring, never included in list responses.
  return assessments.map((a) => ({
    ...publicAssessment(a),
    publishedAt: a.publishedAt,
    archivedAt: a.archivedAt,
    createdAt: a.createdAt,
    attemptCount: a._count.attempts,
  }));
}
export async function createAssessment(body: unknown, user: Identity) {
  const content = parse(assessmentSchema, body);
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.assessment.create({
      data: {
        ...content,
        objectives: asJson(content.objectives),
        skills: asJson(content.skills),
        questions: asJson(content.questions),
        createdBy: user.subject,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: user.subject,
        action: "ASSESSMENT_CREATED",
        targetId: assessment.id,
        detail: { title: assessment.title },
      },
    });
    return publicAssessment(assessment);
  });
}
export async function publishAssessment(id: string, user: Identity) {
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.archivedAt)
      throw new DomainError("NOT_FOUND", "Assessment not found", 404);
    parse(assessmentSchema, assessment);
    if (!assessment.publishedAt) {
      await tx.assessment.update({
        where: { id },
        data: { publishedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.subject,
          action: "ASSESSMENT_PUBLISHED",
          targetId: id,
          detail: { title: assessment.title },
        },
      });
    }
    return { ok: true };
  });
}
export async function archiveAssessment(id: string, user: Identity) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.assessment.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (!changed.count)
      throw new DomainError("NOT_FOUND", "Active assessment not found", 404);
    await tx.auditEvent.create({
      data: {
        actorId: user.subject,
        action: "ASSESSMENT_ARCHIVED",
        targetId: id,
        detail: {},
      },
    });
    return { ok: true };
  });
}

/** Answer keys may be read by server-authorized administrators only. */
export async function readAdminAssessment(id: string) {
  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment)
    throw new DomainError("NOT_FOUND", "Assessment not found", 404);
  return {
    ...parse(assessmentSchema, assessment),
    id: assessment.id,
    publishedAt: assessment.publishedAt,
    archivedAt: assessment.archivedAt,
  };
}
export async function updateAssessment(
  id: string,
  body: unknown,
  user: Identity,
) {
  const content = parse(assessmentSchema, body);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.assessment.updateMany({
      where: { id, publishedAt: null, archivedAt: null },
      data: {
        ...content,
        objectives: asJson(content.objectives),
        skills: asJson(content.skills),
        questions: asJson(content.questions),
      },
    });
    if (!changed.count)
      throw new DomainError(
        "ASSESSMENT_LOCKED",
        "Only active drafts can be edited. Published assessments are fixed for grading integrity.",
        409,
      );
    await tx.auditEvent.create({
      data: {
        actorId: user.subject,
        action: "ASSESSMENT_UPDATED",
        targetId: id,
        detail: { title: content.title },
      },
    });
    return { ok: true };
  });
}
