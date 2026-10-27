export type Assessment = {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  skills: string[];
  difficulty: string;
  durationMinutes: number | null;
  passingPercent: number;
  maxAttempts: number;
  questionCount: number;
  questionTypes: string[];
  attemptsUsed: number;
  activeAttemptId: string | null;
  eligible?: boolean;
};
export type AttemptSummary = {
  id: string;
  assessmentId: string;
  title: string;
  number: number;
  startedAt: string;
  submittedAt: string | null;
  scorePercent: number | null;
  passed: boolean | null;
};
export type Catalog = {
  completedCount: number;
  eligible: boolean;
  assessments: Assessment[];
  history: AttemptSummary[];
};
export type Question = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  prompt: string;
  options: { id: string; text: string }[];
};
export type Attempt = {
  id: string;
  assessmentId: string;
  number: number;
  revision: number;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  serverNow: string;
  answers: Record<string, string[]>;
  flagged: string[];
  scorePercent: number | null;
  passed: boolean | null;
  assessment: Assessment;
  questions: Question[];
};
