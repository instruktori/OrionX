-- Additive only: no existing table, row, constraint or trigger is modified.
-- Rollback: DROP TABLE "StudentWorkspace"; (contains no academic data).

-- CreateTable
CREATE TABLE "StudentWorkspace" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "linkedStudentId" TEXT,
    "linkedBy" TEXT,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentWorkspace_workspaceId_key" ON "StudentWorkspace"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWorkspace_provider_subject_key" ON "StudentWorkspace"("provider", "subject");

-- CreateIndex
CREATE INDEX "StudentWorkspace_linkedStudentId_idx" ON "StudentWorkspace"("linkedStudentId");

-- Direct Prisma backend only. Browser roles receive no table grants or policies.
ALTER TABLE "StudentWorkspace" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StudentWorkspace" FROM anon, authenticated;

ALTER TABLE "StudentWorkspace" ADD CONSTRAINT "workspace_id_format" CHECK ("workspaceId" ~ '^WS-[A-Z2-7]{16}$');
ALTER TABLE "StudentWorkspace" ADD CONSTRAINT "workspace_link_consistent" CHECK (("linkedStudentId" IS NULL) = ("linkedAt" IS NULL));
