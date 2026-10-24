const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {resolve} = require('node:path');

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
