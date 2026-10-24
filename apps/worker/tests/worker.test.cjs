const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const path = require('node:path');

function start(overrides = {}) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/worker/src/worker.ts'], {
    cwd: path.resolve(__dirname, '../../..'),
    env: {...process.env, DATABASE_URL: '', VERCEL_REGION: '', ...overrides},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {output += data});
  return {child, output: () => output, done: once(child, 'close')};
}

test('worker explains missing database configuration', {timeout: 10000}, async () => {
  const run = start();
  const [code] = await run.done;
  assert.equal(code, 1);
  assert.match(run.output(), /DATABASE_URL is required/);
});

test('cloud worker rejects ephemeral artifact storage', {timeout: 10000}, async () => {
  const run = start({DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:1/demo', VERCEL_REGION: 'iad1', STORAGE_MODE: 'local'});
  const [code] = await run.done;
  assert.equal(code, 1);
  assert.match(run.output(), /require durable storage/);
});

test('worker checks cloud storage credentials before polling jobs', {timeout: 10000}, async () => {
  const run = start({DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:1/demo', STORAGE_MODE: 'supabase', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: ''});
  const [code] = await run.done;
  assert.equal(code, 1);
  assert.match(run.output(), /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(run.output(), /OrionX PDF worker started|Worker polling failed/);
});

test('worker retries a database outage and exits cleanly on SIGTERM', {timeout: 15000}, async () => {
  const run = start({DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:1/demo?connect_timeout=1', WORKER_POLL_MS: '50', STORAGE_MODE: 'local'});
  try {
    for (let i = 0; i < 100 && !/Worker polling failed; retrying/.test(run.output()); i++) {
      if (run.child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.match(run.output(), /Worker polling failed; retrying/);
    run.child.kill('SIGTERM');
    const [code] = await run.done;
    assert.equal(code, 0);
    assert.match(run.output(), /Draining OrionX PDF worker/);
  } finally {
    if (run.child.exitCode === null) run.child.kill('SIGKILL');
  }
});
