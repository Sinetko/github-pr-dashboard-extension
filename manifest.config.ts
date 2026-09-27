import { defineManifest } from '@crxjs/vite-plugin';

import packageJson from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'GitHub PR Dashboard',
  description:
    'Read-only dashboard for tracking GitHub pull requests: reviews, checks, notifications.',
  version: packageJson.version,
  minimum_chrome_version: '127',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'GitHub PR Dashboard',
    default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'alarms', 'notifications', 'offscreen'],
  host_permissions: ['https://api.github.com/*'],
  optional_host_permissions: ['https://*/*'],
});
