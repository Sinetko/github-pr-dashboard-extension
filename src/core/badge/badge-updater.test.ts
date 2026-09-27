import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setBadge } from '@core/chrome/action-badge';
import {
  createLocalRepositories,
  DEFAULT_POLLING,
  DEFAULT_SETTINGS,
  type LocalRepositories,
} from '@core/storage';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';
import { buildPullRequest } from '@test/pull-request-fixture';
import { createTokenVaultFake, type TokenVaultFake } from '@test/token-vault-fake';

import { refreshBadge } from '.';

let chromeFake: ChromeFake;
let repositories: LocalRepositories;
let vaultFake: TokenVaultFake;

beforeEach(async () => {
  chromeFake = installChromeFake();
  repositories = createLocalRepositories();
  vaultFake = createTokenVaultFake();
  await vaultFake.vault.setupPassword('Correct-Horse-Battery-9');
  await vaultFake.vault.saveToken('github_pat_x');
  await repositories.settings.write({
    ...DEFAULT_SETTINGS,
    sources: [{ id: 'repo:o/r', kind: 'repository', owner: 'o', name: 'r' }],
  });
  await repositories.polling.write({
    ...DEFAULT_POLLING,
    viewer: { value: { login: 'me', avatarUrl: '' }, fetchedAt: 't' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const refresh = () => refreshBadge({ ...repositories, vault: vaultFake.vault, setBadge });

describe('refreshBadge', () => {
  it('counts needs-my-review for the current host only and applies it to the toolbar', async () => {
    const mine = buildPullRequest({ requestedReviewers: [{ kind: 'user', login: 'me' }] });
    await repositories.cache.write({
      entries: {
        'github.com|repo:o/r': { fetchedAt: 't', pullRequests: [mine], truncated: false },
        'ghe.example.com|repo:o/r': {
          fetchedAt: 't',
          pullRequests: [buildPullRequest({ requestedReviewers: [{ kind: 'user', login: 'me' }] })],
          truncated: false,
        },
      },
    });
    expect((await refresh()).kind).toBe('my-review');
    expect(chromeFake.badge).toMatchObject({ text: '1', title: '1 pull request need your review' });
  });

  it('shows locked, error and unconfigured states', async () => {
    await vaultFake.vault.lock();
    expect((await refresh()).kind).toBe('locked');
    expect(chromeFake.badge.text).toBe('•');
    await vaultFake.vault.unlockWithPassword('Correct-Horse-Battery-9');
    await repositories.polling.update((current) => ({ ...current, consecutiveFailures: 3 }));
    expect((await refresh()).kind).toBe('error');
    await repositories.settings.write(DEFAULT_SETTINGS);
    expect((await refresh()).kind).toBe('none');
  });
});
