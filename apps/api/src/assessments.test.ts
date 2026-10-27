import { describe, expect, it } from "vitest";
import {
  assessmentSchema,
  grade,
  publicAssessment,
  publicAttempt,
  studentForAssessment,
  validateAnswers,
  type AssessmentContent,
  type Answers,
} from "./assessments";
import type { AssessmentAttempt } from "@prisma/client";

export const content: AssessmentContent = {
  title: "Responsible AI foundations",
  description: "Evaluate safe and effective use of AI in university work.",
  objectives: ["Recognize when generated claims need independent verification"],
  skills: ["AI literacy", "Responsible AI"],
  difficulty: "Foundational",
  durationMinutes: 20,
  passingPercent: 70,
  maxAttempts: 2,
  questions: [
    {
      id: "q1",
      type: "SINGLE_CHOICE",
      prompt: "What should you do before using an AI-generated citation?",
      options: [
        { id: "a", text: "Verify the source independently" },
        { id: "b", text: "Assume it exists" },
      ],
      correctOptionIds: ["a"],
    },
    {
      id: "q2",
      type: "MULTIPLE_CHOICE",
      prompt: "Which information should you protect before sharing a prompt?",
      options: [
        { id: "a", text: "Private student records" },
        { id: "b", text: "Public course descriptions" },
        { id: "c", text: "Account credentials" },
      ],
      correctOptionIds: ["a", "c"],
    },
  ],
};
describe("assessment integrity", () => {
  it("validates keys, unique option IDs, and question identities", () => {
    expect(assessmentSchema.safeParse(content).success).toBe(true);
    for (const question of [
      { ...content.questions[0], correctOptionIds: ["unknown"] },
      { ...content.questions[0], correctOptionIds: ["a", "b"] },
      {
        ...content.questions[0],
        options: [
          { id: "a", text: "One" },
          { id: "a", text: "Two" },
        ],
      },
    ])
      expect(
        assessmentSchema.safeParse({ ...content, questions: [question] })
          .success,
      ).toBe(false);
    expect(
      assessmentSchema.safeParse({
        ...content,
        questions: [content.questions[0], content.questions[0]],
      }).success,
    ).toBe(false);
  });
  it("grades multi-answer questions by exact match, independently of order", () => {
    expect(grade(content, { q1: ["a"], q2: ["c", "a"] })).toEqual({
      scorePercent: 100,
      passed: true,
    });
    expect(grade(content, { q1: ["a"], q2: ["a"] })).toEqual({
      scorePercent: 50,
      passed: false,
    });
    expect(grade(content, { q1: ["a"], q2: ["a", "b", "c"] })).toEqual({
      scorePercent: 50,
      passed: false,
    });
    expect(grade(content, {})).toEqual({ scorePercent: 0, passed: false });
  });
  it("does not round a failing result into a passing result", () => {
    const three = {
      ...content,
      passingPercent: 67,
      questions: [...content.questions, { ...content.questions[0], id: "q3" }],
    };
    expect(grade(three, { q1: ["a"], q3: ["a"] })).toEqual({
      scorePercent: 67,
      passed: false,
    });
  });
  it("rejects unknown questions/options, repeated selections, and invalid single selections", () => {
    const invalidAnswers: Answers[] = [
      { evil: ["a"] },
      { q1: ["invalid"] },
      { q1: ["a", "b"] },
      { q2: ["a", "a"] },
    ];
    for (const answers of invalidAnswers)
      expect(() => validateAnswers(content, answers, [])).toThrow();
    expect(() => validateAnswers(content, {}, ["unknown"])).toThrow();
    expect(() => validateAnswers(content, {}, ["q1", "q1"])).toThrow();
    expect(() =>
      validateAnswers(content, { q1: [], q2: ["a", "c"] }, ["q1"]),
    ).not.toThrow();
  });
  it("never sends keys, private snapshots, or unsubmitted scores to students", () => {
    const attempt = {
      id: "attempt-1",
      assessmentId: "assessment-1",
      studentId: "private-student",
      number: 1,
      content,
      answers: { q1: ["a"] },
      flagged: [],
      revision: 1,
      startedAt: new Date(),
      expiresAt: null,
      submittedAt: null,
      scorePercent: 100,
      passed: true,
      updatedAt: new Date(),
    } as unknown as AssessmentAttempt;
    const safe = publicAttempt(attempt);
    expect(JSON.stringify(safe)).not.toMatch(
      /correctOptionIds|private-student/,
    );
    expect(safe.scorePercent).toBeNull();
    expect(safe.passed).toBeNull();
    expect(JSON.stringify(publicAssessment(content))).not.toContain("options");
  });
  it("requires an administrator-linked student identity", () => {
    expect(() =>
      studentForAssessment({
        subject: "s",
        provider: "p",
        role: "student",
        verification: "SELF_REGISTERED",
      }),
    ).toThrow();
    expect(() =>
      studentForAssessment({
        subject: "s",
        provider: "p",
        role: "admin",
        verification: "ADMIN",
      }),
    ).toThrow();
    expect(
      studentForAssessment({
        subject: "s",
        provider: "p",
        role: "student",
        verification: "UNIVERSITY_VERIFIED",
        studentId: "student-1",
      }),
    ).toBe("student-1");
  });
});
