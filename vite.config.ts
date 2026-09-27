import { fileURLToPath, URL } from 'node:url';

import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import manifest from './manifest.config.ts';

const resolvePath = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      '@shared': resolvePath('./src/shared'),
      '@core': resolvePath('./src/core'),
      '@features': resolvePath('./src/features'),
      '@test': resolvePath('./src/test'),
    },
  },
  build: {
    target: 'chrome127',
    sourcemap: false,
    rollupOptions: {
      input: { offscreen: resolvePath('./src/offscreen/index.html') },
    },
  },
});
