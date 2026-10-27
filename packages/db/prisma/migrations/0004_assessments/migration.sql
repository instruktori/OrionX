-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "passingPercent" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "flagged" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "scorePercent" INTEGER,
    "passed" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentAttempt_studentId_startedAt_idx" ON "AssessmentAttempt"("studentId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAttempt_assessmentId_studentId_number_key" ON "AssessmentAttempt"("assessmentId", "studentId", "number");

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Assessment content contains private answer keys. Students access sanitized API
-- responses only; direct browser access is denied even on exposed schemas.
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentAttempt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Assessment", "AssessmentAttempt" FROM PUBLIC, anon, authenticated;
ALTER TABLE "Assessment" ADD CONSTRAINT "assessment_rules" CHECK ("passingPercent" BETWEEN 1 AND 100 AND "maxAttempts" BETWEEN 1 AND 10 AND ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 1 AND 180));
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "attempt_number_positive" CHECK ("number" > 0 AND "revision" >= 0);
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "attempt_result_consistent" CHECK (("submittedAt" IS NULL AND "scorePercent" IS NULL AND "passed" IS NULL) OR ("submittedAt" IS NOT NULL AND "scorePercent" IS NOT NULL AND "scorePercent" BETWEEN 0 AND 100 AND "passed" IS NOT NULL));
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
