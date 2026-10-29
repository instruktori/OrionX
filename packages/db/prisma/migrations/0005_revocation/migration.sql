-- CreateTable
CREATE TABLE "Revocation" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "withdrawnRecords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nonce" TEXT NOT NULL,
    "reasonDigest" TEXT NOT NULL,
    "actorDigest" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "finalizedSlot" BIGINT,
    "revocationPda" TEXT,
    "lastError" TEXT,

    CONSTRAINT "Revocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevocationAttempt" (
    "id" TEXT NOT NULL,
    "revocationId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "transactionBytes" TEXT NOT NULL,
    "blockhash" TEXT NOT NULL,
    "lastValidBlockHeight" BIGINT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'SIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevocationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardWithdrawal" (
    "awardId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardWithdrawal_pkey" PRIMARY KEY ("awardId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Revocation_versionId_key" ON "Revocation"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "RevocationAttempt_signature_key" ON "RevocationAttempt"("signature");

-- CreateIndex
CREATE INDEX "RevocationAttempt_revocationId_createdAt_idx" ON "RevocationAttempt"("revocationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Revocation" ADD CONSTRAINT "Revocation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevocationAttempt" ADD CONSTRAINT "RevocationAttempt_revocationId_fkey" FOREIGN KEY ("revocationId") REFERENCES "Revocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardWithdrawal" ADD CONSTRAINT "AwardWithdrawal_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backend-only tables. Never expose reasons, actors or signed transaction bytes to browsers.
ALTER TABLE "Revocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RevocationAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AwardWithdrawal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Revocation", "RevocationAttempt", "AwardWithdrawal" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON "Revocation", "RevocationAttempt", "AwardWithdrawal" FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE ALL ON "Revocation", "RevocationAttempt", "AwardWithdrawal" FROM authenticated;
 END IF;
END $$;
ALTER TABLE "Revocation" ADD CONSTRAINT "revocation_state" CHECK (state IN ('PENDING', 'REVOKED', 'FAILED'));
ALTER TABLE "Revocation" ADD CONSTRAINT "revocation_reason" CHECK (length(trim(reason)) BETWEEN 1 AND 1000);
ALTER TABLE "Revocation" ADD CONSTRAINT "revocation_finality" CHECK ((state = 'REVOKED') = ("finalizedSlot" IS NOT NULL AND "finalizedAt" IS NOT NULL AND "revocationPda" IS NOT NULL));
CREATE FUNCTION orionx_revocation_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Historical revocation evidence cannot be deleted'; END IF;
 IF TG_TABLE_NAME = 'Revocation' THEN
  IF (OLD."versionId", OLD.reason, OLD."actorId", OLD."withdrawnRecords", OLD.nonce, OLD."reasonDigest", OLD."actorDigest", OLD."requestedAt") IS DISTINCT FROM
     (NEW."versionId", NEW.reason, NEW."actorId", NEW."withdrawnRecords", NEW.nonce, NEW."reasonDigest", NEW."actorDigest", NEW."requestedAt") THEN RAISE EXCEPTION 'Immutable revocation intent'; END IF;
  IF OLD.state = 'REVOKED' AND to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN RAISE EXCEPTION 'Immutable finalized revocation'; END IF;
 ELSIF TG_TABLE_NAME = 'RevocationAttempt' THEN
  IF (to_jsonb(OLD) - 'state') IS DISTINCT FROM (to_jsonb(NEW) - 'state') THEN RAISE EXCEPTION 'Immutable revocation attempt'; END IF;
 ELSE
  RAISE EXCEPTION 'Immutable award withdrawal';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION orionx_revocation_immutable() FROM PUBLIC;
CREATE TRIGGER immutable_revocation BEFORE UPDATE OR DELETE ON "Revocation" FOR EACH ROW EXECUTE FUNCTION orionx_revocation_immutable();
CREATE TRIGGER immutable_revocation_attempt BEFORE UPDATE OR DELETE ON "RevocationAttempt" FOR EACH ROW EXECUTE FUNCTION orionx_revocation_immutable();
CREATE TRIGGER immutable_withdrawal BEFORE UPDATE OR DELETE ON "AwardWithdrawal" FOR EACH ROW EXECUTE FUNCTION orionx_revocation_immutable();
