-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('DISCOVERED', 'VALIDATED', 'QUEUED', 'RENDERED', 'STORED', 'CHAIN_PENDING', 'FINALIZED', 'SYNC_WRITEBACK_PENDING', 'COMPLETED', 'RETRY_WAIT', 'BLOCKED_CONFLICT', 'FAILED_PERMANENT');

-- CreateEnum
CREATE TYPE "TrustMode" AS ENUM ('DEMO', 'BTU_CONFIRMED');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passport" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "nextVersion" INTEGER NOT NULL DEFAULT 1,
    "initialIssueDate" DATE NOT NULL,
    "opaqueChainRef" TEXT NOT NULL,
    "latestFinalizedVersion" INTEGER NOT NULL DEFAULT 0,
    "activeVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "firstIncludedVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Version" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intentDigest" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "pdfSha256" TEXT,
    "storageKey" TEXT,
    "stagingKey" TEXT NOT NULL,
    "pageCount" INTEGER,
    "byteLength" INTEGER,
    "trustMode" "TrustMode" NOT NULL DEFAULT 'DEMO',
    "state" "JobState" NOT NULL DEFAULT 'DISCOVERED',
    "txSignature" TEXT,
    "versionPda" TEXT,
    "finalizedSlot" BIGINT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "versionId" TEXT,
    "type" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'PDF',
    "state" "JobState" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSync" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastError" TEXT,
    "syncedVersion" INTEGER,
    "syncedAt" TIMESTAMP(3),
    "sourceId" TEXT NOT NULL DEFAULT 'fixture',
    "sourceStudentId" TEXT,
    "originalState" JSONB,
    "metadataId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "studentId" TEXT,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionAward" (
    "versionId" TEXT NOT NULL,
    "awardId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "VersionAward_pkey" PRIMARY KEY ("versionId","awardId")
);

-- CreateTable
CREATE TABLE "ChainAttempt" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "transactionBytes" TEXT NOT NULL,
    "blockhash" TEXT NOT NULL,
    "lastValidBlockHeight" BIGINT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SIGNED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RUNNING',
    "totals" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObservation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "SourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportConflict" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "studentId" TEXT,
    "recordId" TEXT,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetWriteback" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "expectedFingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SheetWriteback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_externalId_key" ON "Student"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Passport_publicId_key" ON "Passport"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Passport_studentId_key" ON "Passport"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Passport_opaqueChainRef_key" ON "Passport"("opaqueChainRef");

-- CreateIndex
CREATE UNIQUE INDEX "Award_sourceRecordId_key" ON "Award"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Version_codeHash_key" ON "Version"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Version_code_key" ON "Version"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Version_stagingKey_key" ON "Version"("stagingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Version_passportId_number_key" ON "Version"("passportId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Version_passportId_intentDigest_key" ON "Version"("passportId", "intentDigest");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_state_availableAt_idx" ON "Job"("state", "availableAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSync_sourceRecordId_key" ON "SourceSync"("sourceRecordId");

-- CreateIndex
CREATE INDEX "StudentIdentity_studentId_idx" ON "StudentIdentity"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentIdentity_provider_subject_key" ON "StudentIdentity"("provider", "subject");

-- CreateIndex
CREATE INDEX "VersionAward_awardId_idx" ON "VersionAward"("awardId");

-- CreateIndex
CREATE UNIQUE INDEX "ChainAttempt_signature_key" ON "ChainAttempt"("signature");

-- CreateIndex
CREATE INDEX "ChainAttempt_versionId_createdAt_idx" ON "ChainAttempt"("versionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportRun_idempotencyKey_key" ON "ImportRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ImportRun_createdAt_idx" ON "ImportRun"("createdAt");

-- CreateIndex
CREATE INDEX "SourceObservation_recordId_idx" ON "SourceObservation"("recordId");

-- CreateIndex
CREATE INDEX "SourceObservation_runId_idx" ON "SourceObservation"("runId");

-- CreateIndex
CREATE INDEX "ImportConflict_runId_idx" ON "ImportConflict"("runId");

-- CreateIndex
CREATE INDEX "ImportConflict_studentId_resolvedAt_idx" ON "ImportConflict"("studentId", "resolvedAt");

-- CreateIndex
CREATE INDEX "SheetWriteback_state_idx" ON "SheetWriteback"("state");

-- CreateIndex
CREATE UNIQUE INDEX "SheetWriteback_recordId_versionId_key" ON "SheetWriteback"("recordId", "versionId");

-- AddForeignKey
ALTER TABLE "Passport" ADD CONSTRAINT "Passport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "Passport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentIdentity" ADD CONSTRAINT "StudentIdentity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionAward" ADD CONSTRAINT "VersionAward_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionAward" ADD CONSTRAINT "VersionAward_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainAttempt" ADD CONSTRAINT "ChainAttempt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObservation" ADD CONSTRAINT "SourceObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportConflict" ADD CONSTRAINT "ImportConflict_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ImportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetWriteback" ADD CONSTRAINT "SheetWriteback_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Direct Prisma backend only. Browser roles receive no table grants or policies.
ALTER TABLE "StudentIdentity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VersionAward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChainAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceObservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportConflict" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SheetWriteback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Passport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Award" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceSync" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StudentIdentity", "VersionAward", "ChainAttempt", "ImportRun", "SourceObservation", "ImportConflict", "SheetWriteback", "Student", "Passport", "Award", "Version", "Job", "AuditEvent", "SourceSync" FROM anon, authenticated;

ALTER TABLE "Passport" ADD CONSTRAINT "opaque_reference_hex" CHECK ("opaqueChainRef" ~ '^[0-9a-f]{64}$');
ALTER TABLE "Version" ADD CONSTRAINT "version_positive" CHECK (number > 0);
ALTER TABLE "Version" ADD CONSTRAINT "pdf_hash_hex" CHECK ("pdfSha256" IS NULL OR "pdfSha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "StudentIdentity" ADD CONSTRAINT "identity_role_binding" CHECK ((role = 'student' AND "studentId" IS NOT NULL) OR role = 'admin');

CREATE FUNCTION public.orionx_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_TABLE_NAME = 'Student' THEN
   IF (OLD."firstName", OLD."lastName") IS DISTINCT FROM (NEW."firstName", NEW."lastName") AND EXISTS (SELECT 1 FROM public."Passport" p WHERE p."studentId" = OLD.id) THEN RAISE EXCEPTION 'Immutable student identity'; END IF;
 ELSIF TG_TABLE_NAME = 'Passport' THEN
   IF (OLD."publicId", OLD."studentId", OLD."initialIssueDate", OLD."opaqueChainRef") IS DISTINCT FROM (NEW."publicId", NEW."studentId", NEW."initialIssueDate", NEW."opaqueChainRef") THEN RAISE EXCEPTION 'Immutable passport identity'; END IF;
 ELSIF TG_TABLE_NAME = 'Award' THEN
   IF (to_jsonb(OLD) - 'firstIncludedVersion') IS DISTINCT FROM (to_jsonb(NEW) - 'firstIncludedVersion') OR (OLD."firstIncludedVersion" IS NOT NULL AND OLD."firstIncludedVersion" IS DISTINCT FROM NEW."firstIncludedVersion") THEN RAISE EXCEPTION 'Immutable award'; END IF;
 ELSIF TG_TABLE_NAME = 'Version' THEN
   IF (OLD."passportId", OLD.number, OLD.code, OLD."codeHash", OLD."intentDigest", OLD.snapshot, OLD."stagingKey") IS DISTINCT FROM (NEW."passportId", NEW.number, NEW.code, NEW."codeHash", NEW."intentDigest", NEW.snapshot, NEW."stagingKey") THEN RAISE EXCEPTION 'Immutable version snapshot'; END IF;
   IF OLD."pdfSha256" IS NOT NULL AND (OLD."pdfSha256", OLD."storageKey", OLD."byteLength", OLD."pageCount") IS DISTINCT FROM (NEW."pdfSha256", NEW."storageKey", NEW."byteLength", NEW."pageCount") THEN RAISE EXCEPTION 'Immutable artifact'; END IF;
   IF OLD."finalizedSlot" IS NOT NULL AND (OLD."finalizedSlot", OLD."txSignature", OLD."versionPda", OLD."finalizedAt") IS DISTINCT FROM (NEW."finalizedSlot", NEW."txSignature", NEW."versionPda", NEW."finalizedAt") THEN RAISE EXCEPTION 'Immutable finalized proof'; END IF;
 ELSIF TG_TABLE_NAME = 'ChainAttempt' THEN
   IF (OLD."versionId", OLD.signature, OLD."transactionBytes", OLD.blockhash, OLD."lastValidBlockHeight") IS DISTINCT FROM (NEW."versionId", NEW.signature, NEW."transactionBytes", NEW.blockhash, NEW."lastValidBlockHeight") THEN RAISE EXCEPTION 'Immutable signed attempt'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.orionx_immutable() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER immutable_student BEFORE UPDATE ON "Student" FOR EACH ROW EXECUTE FUNCTION public.orionx_immutable();
CREATE TRIGGER immutable_passport BEFORE UPDATE ON "Passport" FOR EACH ROW EXECUTE FUNCTION public.orionx_immutable();
CREATE TRIGGER immutable_award BEFORE UPDATE ON "Award" FOR EACH ROW EXECUTE FUNCTION public.orionx_immutable();
CREATE TRIGGER immutable_version BEFORE UPDATE ON "Version" FOR EACH ROW EXECUTE FUNCTION public.orionx_immutable();
CREATE TRIGGER immutable_attempt BEFORE UPDATE ON "ChainAttempt" FOR EACH ROW EXECUTE FUNCTION public.orionx_immutable();
CREATE FUNCTION public.orionx_membership() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public."Version" v JOIN public."Passport" p ON p.id = v."passportId" JOIN public."Award" a ON a."studentId" = p."studentId" WHERE v.id = NEW."versionId" AND a.id = NEW."awardId" AND v.state = 'QUEUED') THEN RAISE EXCEPTION 'Invalid or frozen version membership'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.orionx_membership() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER valid_membership BEFORE INSERT OR UPDATE ON "VersionAward" FOR EACH ROW EXECUTE FUNCTION public.orionx_membership();
