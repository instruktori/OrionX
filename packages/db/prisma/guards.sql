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

-- Self-service workspaces (migration 0003): private backend table, never browser-accessible.
ALTER TABLE "StudentWorkspace" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StudentWorkspace" FROM anon, authenticated;
