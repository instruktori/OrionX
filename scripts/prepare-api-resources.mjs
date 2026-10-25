import {cpSync, mkdirSync, rmSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'apps/api/runtime-resources');
rmSync(destination, {recursive: true, force: true});
mkdirSync(destination, {recursive: true});
cpSync(resolve(root, 'packages/core/assets'), resolve(destination, 'core-assets'), {recursive: true, filter: path => !path.endsWith('.zip') && !path.endsWith('/btu/reference.png')});
cpSync(resolve(root, 'fixtures'), resolve(destination, 'fixtures'), {recursive: true});
console.log('Prepared API runtime fonts, artwork and canonical skill catalog');
