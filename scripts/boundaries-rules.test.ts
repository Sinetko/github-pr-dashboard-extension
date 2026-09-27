import { describe, expect, it } from 'vitest';

import { classifyLayer, findViolation } from './boundaries-rules';

const check = (from: string, to: string): string | null =>
  findViolation(classifyLayer(from), classifyLayer(to), from);

describe('boundaries rules', () => {
  it('classifies layers', () => {
    expect(classifyLayer('shared/ui/button/index.ts')).toEqual({ kind: 'shared' });
    expect(classifyLayer('core/github/client.ts')).toEqual({ kind: 'core' });
    expect(classifyLayer('features/dashboard/x.ts')).toEqual({
      kind: 'feature',
      name: 'dashboard',
    });
    expect(classifyLayer('popup/main.tsx')).toEqual({ kind: 'entrypoint', name: 'popup' });
    expect(classifyLayer('test/chrome-fake.ts')).toEqual({ kind: 'test' });
  });

  it('allows the one-way flow', () => {
    expect(check('popup/main.tsx', 'features/dashboard/index.ts')).toBeNull();
    expect(check('features/dashboard/a.ts', 'core/github/index.ts')).toBeNull();
    expect(check('features/dashboard/a.ts', 'features/dashboard/b.ts')).toBeNull();
    expect(check('core/github/a.ts', 'shared/utils/b.ts')).toBeNull();
    expect(check('shared/ui/a.ts', 'shared/theme/b.ts')).toBeNull();
  });

  it('rejects upward and sideways imports', () => {
    expect(check('shared/ui/a.ts', 'core/github/b.ts')).not.toBeNull();
    expect(check('core/github/a.ts', 'features/dashboard/b.ts')).not.toBeNull();
    expect(check('features/settings/a.ts', 'features/dashboard/b.ts')).not.toBeNull();
    expect(check('features/settings/a.ts', 'popup/app/index.ts')).not.toBeNull();
    expect(check('background/index.ts', 'popup/app/index.ts')).not.toBeNull();
  });

  it('restricts test utilities to test files', () => {
    expect(check('core/github/a.ts', 'test/chrome-fake.ts')).not.toBeNull();
    expect(check('core/github/a.test.ts', 'test/chrome-fake.ts')).toBeNull();
    expect(check('test/chrome-fake.ts', 'core/chrome/storage.ts')).toBeNull();
    expect(check('test/chrome-fake.ts', 'features/dashboard/a.ts')).not.toBeNull();
  });
});
