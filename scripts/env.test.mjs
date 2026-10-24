import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {environment} from './with-env.mjs';

test('workspace env loading preserves runtime secrets and local override priority', () => {
  const root = mkdtempSync(join(tmpdir(), 'orionx-env-'));
  try {
    writeFileSync(join(root, '.env'), 'KEY=base\nBASE=yes\n');
    writeFileSync(join(root, '.env.development'), 'KEY=development\n');
    writeFileSync(join(root, '.env.local'), 'KEY=pulled\nPULLED=yes\n');
    writeFileSync(join(root, '.env.development.local'), 'KEY=custom\nJSON=\'{"private_key":"line1\\nline2"}\'\n');
    assert.equal(environment(root, 'development', {}).KEY, 'custom');
    assert.equal(environment(root, 'development', {KEY: 'runtime'}).KEY, 'runtime');
    assert.equal(environment(root, 'development', {KEY: ''}).KEY, '');
    assert.equal(environment(root, 'development', {}).JSON, '{"private_key":"line1\\nline2"}');
    assert.equal(environment(root, 'test', {}).PULLED, undefined);
    assert.equal(environment(root, 'production', {}).KEY, 'pulled');
    assert.equal(environment(root, 'development', {}).BASE, 'yes');
  } finally { rmSync(root, {recursive: true, force: true}); }
});
