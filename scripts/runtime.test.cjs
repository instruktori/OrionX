const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {resolve} = require('node:path');
const {spawn} = require('node:child_process');
const {mkdtempSync, symlinkSync, readFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {createServer} = require('node:net');
const {setTimeout: delay} = require('node:timers/promises');
const {build} = require('esbuild');

test('Solana client loads in the Vercel CommonJS runtime without require(ESM)', () => {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', `
    const assert = require('node:assert/strict');
    const {PublicKey} = require('@solana/web3.js');
    const key = '11111111111111111111111111111111';
    assert.equal(new PublicKey(key).toBase58(), key);
  `], {cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 30000});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('bundled API starts without require(ESM) and serves HTTP liveness', {timeout: 30000}, async () => {
  const root = resolve(__dirname, '..');
  const folder = mkdtempSync(resolve(tmpdir(), 'orionx-api-runtime-'));
  const pkg = JSON.parse(readFileSync(resolve(root, 'apps/api/package.json'), 'utf8'));
  const format = pkg.type === 'module' ? 'esm' : 'cjs';
  const output = resolve(folder, 'server.' + (format === 'esm' ? 'mjs' : 'cjs'));
  let child, exited = false, diagnostics = '';
  try {
    symlinkSync(resolve(root, 'node_modules'), resolve(folder, 'node_modules'), 'dir');
    await build({
      absWorkingDir: root, entryPoints: ['apps/api/src/server.ts'], outfile: output,
      bundle: true, platform: 'node', target: 'node22', format, logLevel: 'silent',
      tsconfig: resolve(root, 'apps/api/tsconfig.json'),
      plugins: [{name: 'external-runtime-packages', setup(builder) {
        builder.onResolve({filter: /^[^./]/}, args => args.path.startsWith('@orionx/') ? undefined : {path: args.path, external: true});
      }}],
    });
    const socket = createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const env = {...process.env, PORT: String(port), VERCEL: '1', DATABASE_URL: 'postgresql://orionx:unused@127.0.0.1:1/unused'};
    delete env.WEB_ORIGIN;
    delete env.VERIFICATION_PUBLIC_ORIGIN;
    child = spawn(process.execPath, ['--no-experimental-require-module', output], {
      cwd: root, env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.once('exit', () => { exited = true; });
    child.stdout.on('data', value => { diagnostics += value; });
    child.stderr.on('data', value => { diagnostics += value; });
    let response;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && !exited) {
      try { response = await fetch('http://127.0.0.1:' + port + '/api/v1/health/live', {signal: AbortSignal.timeout(1000)}); break; }
      catch { await delay(100); }
    }
    assert.ok(response, diagnostics || 'API did not start');
    assert.equal(response.status, 200, diagnostics);
    assert.deepEqual(await response.json(), {status: 'ok', service: 'orionx-api'});
    const endpoint = 'http://127.0.0.1:' + port + '/api/v1/auth/login';
    const headers = {'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https'};
    const sameOrigin = await fetch(endpoint, {method: 'POST', headers: {...headers, Origin: 'https://127.0.0.1:' + port}, body: '{}'});
    assert.equal(sameOrigin.status, 400);
    assert.equal((await sameOrigin.json()).error.code, 'INVALID_REQUEST');
    const crossOrigin = await fetch(endpoint, {method: 'POST', headers: {...headers, Origin: 'https://attacker.invalid'}, body: '{}'});
    assert.equal(crossOrigin.status, 403);
    assert.equal((await crossOrigin.json()).error.code, 'INVALID_ORIGIN');
  } finally {
    if (child && !exited) { const closed = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await closed; }
    rmSync(folder, {recursive: true, force: true});
  }
});
