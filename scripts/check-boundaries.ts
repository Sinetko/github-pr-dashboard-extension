import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { classifyLayer, findViolation } from './boundaries-rules';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = join(ROOT, 'src');
const ALIASES: Record<string, string> = {
  '@shared/': join(SOURCE_ROOT, 'shared'),
  '@core/': join(SOURCE_ROOT, 'core'),
  '@features/': join(SOURCE_ROOT, 'features'),
  '@test/': join(SOURCE_ROOT, 'test'),
};
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return listSourceFiles(fullPath);
    }
    return SOURCE_EXTENSIONS.has(extname(entry)) ? [fullPath] : [];
  });

const resolveSpecifier = (fromFile: string, specifier: string): string | null => {
  if (specifier.startsWith('.')) {
    return resolve(dirname(fromFile), specifier);
  }
  const alias = Object.keys(ALIASES).find((prefix) => specifier.startsWith(prefix));
  if (alias === undefined) {
    return null;
  }
  const aliasTarget = ALIASES[alias];
  return aliasTarget === undefined ? null : join(aliasTarget, specifier.slice(alias.length));
};

const toSourceRelative = (absolutePath: string): string =>
  relative(SOURCE_ROOT, absolutePath).split(sep).join('/');

const violations: string[] = [];

for (const file of listSourceFiles(SOURCE_ROOT)) {
  const importer = toSourceRelative(file);
  const importerLayer = classifyLayer(importer);
  const { importedFiles } = ts.preProcessFile(readFileSync(file, 'utf8'), true, true);
  for (const { fileName: specifier } of importedFiles) {
    const target = resolveSpecifier(file, specifier);
    if (target === null) {
      continue;
    }
    const targetRelative = toSourceRelative(target);
    if (targetRelative.startsWith('..')) {
      violations.push(`${importer}: import "${specifier}" escapes src/`);
      continue;
    }
    const violation = findViolation(importerLayer, classifyLayer(targetRelative), importer);
    if (violation !== null) {
      violations.push(`${importer}: import "${specifier}" — ${violation}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`Layer boundary violations (${violations.length}):`);
  for (const violation of violations) {
    console.error(`  ✗ ${violation}`);
  }
  process.exit(1);
}
console.log('Layer boundaries OK');
