import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

/** Resolve files in repository and traced serverless layouts without CommonJS globals. */
export function repositoryResource(relative: string) {
 const runtimeRelative = relative.startsWith('packages/core/assets/') ? 'core-assets/' + relative.slice('packages/core/assets/'.length) : relative;
 for (const root of ['runtime-resources', 'apps/api/runtime-resources']) {
  const path = resolve(process.cwd(), root, runtimeRelative);
  if (existsSync(path)) return path;
 }
 for (const root of [process.env.ORIONX_RESOURCE_ROOT, process.cwd(), resolve(process.cwd(), '../..')]) {
  if (!root) continue;
  const path = resolve(root, relative);
  if (existsSync(path)) return path;
 }
 throw Error('Bundled resource is missing: ' + relative);
}
