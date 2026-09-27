import { describe, expect, it } from 'vitest';

import { findManifestProblems } from './manifest-rules';

describe('findManifestProblems', () => {
  it('accepts a concrete host and used permissions', () => {
    expect(
      findManifestProblems(
        { permissions: ['storage'], host_permissions: ['https://api.github.com/*'] },
        'chrome.storage.local.get()',
      ),
    ).toEqual([]);
  });

  it('rejects wildcard required host permissions', () => {
    for (const origin of [
      'https://*/*',
      '<all_urls>',
      'https://*.github.com/*',
      'http://example.com/*',
    ]) {
      expect(findManifestProblems({ host_permissions: [origin] }, '')).toHaveLength(1);
    }
  });

  it('allows only the https wildcard or concrete hosts as optional host permissions', () => {
    expect(findManifestProblems({ optional_host_permissions: ['https://*/*'] }, '')).toEqual([]);
    expect(findManifestProblems({ optional_host_permissions: ['<all_urls>'] }, '')).toHaveLength(1);
  });

  it('flags unused, unknown and undeclared permissions', () => {
    expect(findManifestProblems({ permissions: ['alarms'] }, '')).toEqual([
      'permission "alarms" is declared but never used',
    ]);
    expect(findManifestProblems({ permissions: ['tabs'] }, '')).toEqual([
      'permission "tabs" is not on the allow-list',
    ]);
    expect(findManifestProblems({ permissions: [] }, 'chrome.offscreen.createDocument')).toEqual([
      'source uses chrome.offscreen but the "offscreen" permission is not declared',
    ]);
  });
});
