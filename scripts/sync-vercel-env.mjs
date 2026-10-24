import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {environment, repositoryRoot} from './with-env.mjs';

const args = process.argv.slice(2);
const target = args[args.indexOf('--environment') + 1];
if (!args.includes('--environment') || !['development', 'preview', 'production'].includes(target)) {
  throw Error('Specify --environment development|preview|production; add --write to save changes');
}
const write = args.includes('--write');
const replace = args.includes('--replace');
const cli = resolve(repositoryRoot, 'node_modules/vercel/dist/index.js');
const link = JSON.parse(readFileSync(resolve(repositoryRoot, '.vercel/project.json'), 'utf8'));
const env = environment(repositoryRoot, target === 'development' ? 'development' : 'production');
const values = args.includes('--file') ? parseEnv(readFileSync(resolve(repositoryRoot, args[args.indexOf('--file') + 1]), 'utf8')) : env;
function vercel(command, input) {
  const result = spawnSync(process.execPath, [cli, ...command, '--non-interactive'], {
    cwd: repositoryRoot, env, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  });
  // CLI diagnostics may include supplied values. Only emit our value-free errors.
  if (result.status !== 0) throw Error(`Vercel ${command[0]} failed; check authentication and project access`);
  return result.stdout;
}
const project = JSON.parse(vercel(['project', 'inspect', '--json']));
if (project.id !== link.projectId) throw Error('Linked Vercel project does not match inspected project');
console.log(`Project: ${project.owner.slug}/${project.name}; environment: ${target}; ${write ? 'WRITE' : 'dry run'}`);
const current = JSON.parse(vercel(['env', 'ls', '--format', 'json'])).envs;
const secrets = new Set(['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON']);
const config = ['APP_ENV', 'NEXT_PUBLIC_APP_MODE', 'NEXT_PUBLIC_API_ORIGIN', 'WEB_ORIGIN', 'WORKER_POLL_MS', 'WORKER_LEASE_MS', 'WORKER_MAX_ATTEMPTS', 'SOURCE_MODE', 'GOOGLE_SHEET_ID', 'GOOGLE_SHEET_TAB', 'CHAIN_MODE', 'SOLANA_RPC_URL', 'SOLANA_PROGRAM_ID', 'SOLANA_EXPECTED_GENESIS_HASH', 'STORAGE_MODE', 'SUPABASE_URL', 'SUPABASE_STORAGE_BUCKET', 'SUPABASE_JWKS_URL', 'AUTH_JWT_ISSUER', 'AUTH_JWT_AUDIENCE'];
const changes = [];
for (const key of [...config, ...secrets]) {
  const value = values[key];
  if (!value) continue;
  if (target !== 'development' && (key === 'DATABASE_URL' || key === 'DIRECT_URL')) {
    let url;
    try { url = new URL(value); } catch { throw Error(`${key} is not a valid URL`); }
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error(`Refusing to save local ${key} in ${target}`);
  }
  const existing = current.some(item => item.key === key && item.target?.includes(target) && !item.gitBranch);
  if (existing && !replace) { console.log(`${key}: exists (kept)`); continue; }
  const type = secrets.has(key) && target !== 'development' ? 'secret' : 'config';
  changes.push({key, value, type, existing});
}
// Validate the complete plan before making the first change. Secret values only use stdin.
for (const {key, value, type, existing} of changes) {
  console.log(`${key}: ${existing ? 'replace' : 'add'} (${type})`);
  if (write) vercel(['env', 'add', key, '--environment', target, '--type', type, '--yes', ...(existing ? ['--force'] : [])], value);
}
if (!write) console.log('Dry run complete. Add --write to save; --replace explicitly replaces existing values.');
