-- Supabase default privileges grant function execution explicitly to browser roles.
-- Trigger execution by the backend does not require these grants.
REVOKE ALL ON FUNCTION public.orionx_revocation_immutable() FROM anon, authenticated;
