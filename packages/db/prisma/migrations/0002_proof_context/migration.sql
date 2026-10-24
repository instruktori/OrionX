ALTER TABLE "Version" ADD COLUMN "chainCluster" TEXT, ADD COLUMN "chainProgramId" TEXT, ADD COLUMN "chainGenesisHash" TEXT;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
