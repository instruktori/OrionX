type Environment = Record<string, string | undefined>;

export function supabaseUrl(env: Environment = process.env) {
  if (!env.SUPABASE_URL) throw Error('SUPABASE_URL is required');
  let url: URL;
  try { url = new URL(env.SUPABASE_URL); } catch { throw Error('SUPABASE_URL must be an HTTP(S) origin'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('SUPABASE_URL must be an HTTPS origin (HTTP is allowed only for local development)');
  }
  return url.origin;
}

export function supabaseStorageConfig(env: Environment = process.env) {
  const url = supabaseUrl(env);
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw Error('SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required');
  if (!key.startsWith('sb_secret_')) {
    // Never accept a public/anon key as a backend storage credential.
    try {
      const parts = key.split('.');
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (parts.length !== 3 || claims.role !== 'service_role') throw Error();
    } catch { throw Error('Supabase storage requires a secret key or legacy service_role key'); }
  }
  const bucket = env.SUPABASE_STORAGE_BUCKET || 'passport-pdfs';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bucket)) throw Error('Invalid SUPABASE_STORAGE_BUCKET');
  const headers: Record<string, string> = {apikey: key};
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return {url, bucket, headers};
}

export function supabaseAuthConfig(env: Environment = process.env) {
  const base = env.SUPABASE_URL ? supabaseUrl(env) : undefined;
  const issuer = env.AUTH_JWT_ISSUER || (base ? `${base}/auth/v1` : undefined);
  const jwksUrl = env.SUPABASE_JWKS_URL || (base ? `${base}/auth/v1/.well-known/jwks.json` : undefined);
  const audience = env.AUTH_JWT_AUDIENCE || (base ? 'authenticated' : undefined);
  if (!issuer || !jwksUrl || !audience) throw Error('Authentication not configured');
  return {issuer, jwksUrl, audience};
}

export function supabaseAuthServiceConfig(env: Environment = process.env) {
  const {url, headers} = supabaseStorageConfig(env);
  const auth = supabaseAuthConfig(env);
  const cookieSecret = env.AUTH_COOKIE_SECRET || headers.apikey;
  return {url, apikey: headers.apikey, headers, cookieSecret, ...auth};
}
