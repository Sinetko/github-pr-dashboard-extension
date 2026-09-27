import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findManifestProblems, type ManifestShape } from './manifest-rules';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(ROOT, 'dist', 'manifest.json');

const readSources = (directory: string): string =>
  readdirSync(directory)
    .map((entry) => {
      const fullPath = join(directory, entry);
      if (statSync(fullPath).isDirectory()) {
        return readSources(fullPath);
      }
      const isSource = ['.ts', '.tsx'].includes(extname(entry)) && !/\.test\.tsx?$/.test(entry);
      const isTestSupport = fullPath.includes(join('src', 'test'));
      return isSource && !isTestSupport ? readFileSync(fullPath, 'utf8') : '';
    })
    .join('\n');

if (!existsSync(MANIFEST_PATH)) {
  console.error('dist/manifest.json not found — run `pnpm build` first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestShape;
const problems = findManifestProblems(manifest, readSources(join(ROOT, 'src')));

if (problems.length > 0) {
  console.error(`Manifest problems (${problems.length}):`);
  for (const problem of problems) {
    console.error(`  ✗ ${problem}`);
  }
  process.exit(1);
}
console.log('Manifest OK');
