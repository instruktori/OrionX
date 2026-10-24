import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// First value wins: deployed/shell values always take precedence over local files.
export function environment(root = repositoryRoot, mode = process.env.NODE_ENV || 'development', inherited = process.env) {
  if (!['development', 'production', 'test'].includes(mode)) throw Error('Invalid environment mode');
  const result = {...inherited};
  const files = [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
  for (const file of files) {
    let content;
    try { content = readFileSync(resolve(root, file), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const [key, value] of Object.entries(parseEnv(content))) {
      if (result[key] === undefined) result[key] = value;
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const mode = args[0] === '--mode' ? (args.shift(), args.shift()) : process.env.NODE_ENV || 'development';
  const command = args.shift();
  if (!command) throw Error('Usage: with-env.mjs [--mode development|production|test] command [args...]');
  const child = spawn(command, args, {env: environment(repositoryRoot, mode), stdio: 'inherit', shell: process.platform === 'win32'});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('Unable to start environment command'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
}
