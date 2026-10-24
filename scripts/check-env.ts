import {supabaseAuthConfig, supabaseStorageConfig, supabaseUrl} from '../packages/core/src/config';

let failed = false;
function check(name: string, verify: () => void) {
  try { verify(); console.log(`${name}: configured`); }
  catch (error) { failed = true; console.error(`${name}: ${error instanceof Error ? error.message : 'configuration invalid'}`); }
}

function database(name: string) {
  const value = process.env[name];
  if (!value) throw Error(`${name} is missing`);
  let url: URL;
  try { url = new URL(value); } catch { throw Error(`${name} must be a PostgreSQL URL`); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error(`${name} must be a PostgreSQL URL`);
  if (process.argv.includes('--cloud') && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error(`${name} must use a cloud database`);
  if (url.hostname.endsWith('supabase.com') || url.hostname.endsWith('supabase.co')) {
    if (url.searchParams.get('sslmode') !== 'require' && url.searchParams.get('sslmode') !== 'verify-full') throw Error(`${name} must require TLS`);
    if (name === 'DIRECT_URL' && url.port === '6543') throw Error('DIRECT_URL must use the session pooler (5432) or a direct connection');
    if (name === 'DATABASE_URL' && url.port === '6543' && url.searchParams.get('pgbouncer') !== 'true') throw Error('DATABASE_URL requires pgbouncer=true for transaction pooling');
  }
}

if (process.argv.includes('--cloud') || process.env.SUPABASE_URL) {
  check('Supabase URL', () => { supabaseUrl(); });
  check('Supabase Auth', () => { supabaseAuthConfig(); });
}
if (process.env.STORAGE_MODE === 'supabase' || process.argv.includes('--cloud')) {
  check('Private PDF storage', () => {
    if (process.env.STORAGE_MODE !== 'supabase') throw Error('STORAGE_MODE must be supabase');
    supabaseStorageConfig();
  });
}
for (const name of ['DATABASE_URL', 'DIRECT_URL']) check(name, () => database(name));
if (failed) process.exitCode = 1;
