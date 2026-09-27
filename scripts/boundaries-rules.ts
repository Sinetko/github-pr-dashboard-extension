export type Layer =
  | { kind: 'shared' }
  | { kind: 'core' }
  | { kind: 'feature'; name: string }
  | { kind: 'entrypoint'; name: string }
  | { kind: 'test' }
  | { kind: 'other' };

const ENTRYPOINTS = new Set(['background', 'popup', 'offscreen']);

export const classifyLayer = (sourceRelativePath: string): Layer => {
  const [top, second] = sourceRelativePath.split('/');
  if (top === 'shared') {
    return { kind: 'shared' };
  }
  if (top === 'core') {
    return { kind: 'core' };
  }
  if (top === 'test') {
    return { kind: 'test' };
  }
  if (top === 'features' && second !== undefined) {
    return { kind: 'feature', name: second };
  }
  if (top !== undefined && ENTRYPOINTS.has(top)) {
    return { kind: 'entrypoint', name: top };
  }
  return { kind: 'other' };
};

const isTestFile = (path: string): boolean => /\.test\.tsx?$/.test(path);

export const findViolation = (from: Layer, to: Layer, importerPath: string): string | null => {
  if (to.kind === 'test') {
    return isTestFile(importerPath) || from.kind === 'test'
      ? null
      : 'test utilities may only be imported from test files';
  }
  if (from.kind === 'test') {
    return to.kind === 'entrypoint' || to.kind === 'feature'
      ? 'test utilities may only depend on core/ and shared/'
      : null;
  }
  if (to.kind === 'entrypoint') {
    return from.kind === 'entrypoint' && from.name === to.name
      ? null
      : 'entrypoints are composition roots; nothing may import from them';
  }
  switch (from.kind) {
    case 'shared':
      return to.kind === 'shared' ? null : 'shared/ may not depend on anything else in src/';
    case 'core':
      return to.kind === 'core' || to.kind === 'shared' ? null : 'core/ may depend on shared/ only';
    case 'feature':
      if (to.kind === 'feature') {
        return to.name === from.name
          ? null
          : `feature "${from.name}" may not import feature "${to.name}"`;
      }
      return null;
    case 'entrypoint':
    case 'other':
      return null;
  }
};
