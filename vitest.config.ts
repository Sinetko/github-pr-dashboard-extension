import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolvePath = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolvePath('./src/shared'),
      '@core': resolvePath('./src/core'),
      '@features': resolvePath('./src/features'),
      '@test': resolvePath('./src/test'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/__fixtures__/**',
        'src/**/index.ts',
      ],
      thresholds: {
        'src/shared/utils/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        'src/core/github/transforms/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        'src/core/storage/**': { lines: 90, branches: 85, functions: 90, statements: 90 },
      },
    },
  },
});
