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
    const env = {
      ...process.env,
      PORT: String(port),
      VERCEL: '1',
      DATABASE_URL: 'postgresql://orionx:unused@127.0.0.1:1/unused',
      SUPABASE_URL: 'https://pjddlhkgnjvsgqqedoye.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_runtime_test_key_000000000000',
    };
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
    const baseUrl = 'http://127.0.0.1:' + port + '/api/v1';
    const origin = 'https://127.0.0.1:' + port;
    const headers = {'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https'};

    // 1. Legacy password login disabled & CSRF checked
    const sameOrigin = await fetch(baseUrl + '/auth/login', {method: 'POST', headers: {...headers, Origin: origin}, body: '{}'});
    assert.equal(sameOrigin.status, 400);
    assert.equal((await sameOrigin.json()).error.code, 'INVALID_REQUEST');
    const passwordAttempt = await fetch(baseUrl + '/auth/login', {
      method: 'POST',
      headers: {...headers, Origin: origin},
      body: JSON.stringify({email: 'user@example.com', password: 'password123'}),
    });
    assert.equal(passwordAttempt.status, 403);
    assert.equal((await passwordAttempt.json()).error.code, 'AUTH_METHOD_DISABLED');
    const crossOrigin = await fetch(baseUrl + '/auth/login', {method: 'POST', headers: {...headers, Origin: 'https://attacker.invalid'}, body: '{}'});
    assert.equal(crossOrigin.status, 403);
    assert.equal((await crossOrigin.json()).error.code, 'INVALID_ORIGIN');

    // 2. Google OAuth PKCE initiation & open-redirect protection
    const googleInit = await fetch(baseUrl + '/auth/google', {
      method: 'POST',
      headers: {...headers, Origin: origin},
      body: JSON.stringify({next: '/passport'}),
    });
    assert.equal(googleInit.status, 200);
    const oauthCookies = googleInit.headers.getSetCookie();
    assert.ok(oauthCookies.some(c => c.startsWith('orionx_oauth=') && c.includes('HttpOnly') && c.includes('SameSite=Lax')));
    const initPayload = await googleInit.json();
    assert.equal(initPayload.provider, 'google');
    assert.ok(initPayload.url.includes('/auth/v1/authorize?provider=google'));
    assert.ok(initPayload.url.includes('code_challenge_method=s256'));

    const openRedirectInit = await fetch(baseUrl + '/auth/google', {
      method: 'POST',
      headers: {...headers, Origin: origin},
      body: JSON.stringify({next: 'https://evil.invalid/steal'}),
    });
    assert.equal(openRedirectInit.status, 400);
    assert.equal((await openRedirectInit.json()).error.code, 'INVALID_REDIRECT');

    // 3. Google OAuth callback validation (missing code, provider error, tampered state)
    const missingCode = await fetch(baseUrl + '/auth/callback', {
      method: 'POST',
      headers: {...headers, Origin: origin},
      body: '{}',
    });
    assert.equal(missingCode.status, 400);
    assert.equal((await missingCode.json()).error.code, 'INVALID_REQUEST');

    const providerErr = await fetch(baseUrl + '/auth/callback', {
      method: 'POST',
      headers: {...headers, Origin: origin},
      body: JSON.stringify({error: 'access_denied', errorDescription: 'User cancelled sign-in'}),
    });
    assert.equal(providerErr.status, 401);
    assert.equal((await providerErr.json()).error.code, 'OAUTH_PROVIDER_ERROR');

    const missingCookieCallback = await fetch(baseUrl + '/auth/callback', {
      method: 'POST',
      headers: {...headers, Origin: origin},
      body: JSON.stringify({code: 'auth_code_123', state: initPayload.state}),
    });
    assert.equal(missingCookieCallback.status, 400);
    assert.equal((await missingCookieCallback.json()).error.code, 'OAUTH_STATE_INVALID');

    // 4. Logout clears HTTP-only cookies
    const logoutRes = await fetch(baseUrl + '/auth/logout', {
      method: 'POST',
      headers: {...headers, Origin: origin},
    });
    assert.equal(logoutRes.status, 200);
    const logoutCookies = logoutRes.headers.getSetCookie();
    assert.ok(logoutCookies.some(c => c.startsWith('orionx_access=;') && c.includes('Max-Age=0')));
    assert.ok(logoutCookies.some(c => c.startsWith('orionx_refresh=;') && c.includes('Max-Age=0')));
  } finally {
    if (child && !exited) { const closed = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await closed; }
    rmSync(folder, {recursive: true, force: true});
  }
});
