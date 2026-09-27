import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStorageArea } from '@core/chrome/storage';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';

import {
  cacheKey,
  createLocalRepositories,
  createPersistedStore,
  createSessionRepositories,
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CACHE,
  DEFAULT_POLLING,
  DEFAULT_SETTINGS,
  DEFAULT_UI,
  parseCache,
  parseMeta,
  parsePolling,
  parseSecurity,
  parseSettings,
  parseUi,
  repositorySourceId,
  runMigrations,
  searchSourceId,
  type LocalKey,
  type VaultRecord,
} from '.';

let fake: ChromeFake;
beforeEach(() => {
  fake = installChromeFake();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const VALID_VAULT: VaultRecord = {
  version: 1,
  fingerprintVersion: 1,
  kdf: { algorithm: 'PBKDF2-SHA256', iterations: 600_000, salt: 'c2FsdA==' },
  passwordWrappedKey: { iv: 'aXY=', data: 'ZGF0YQ==' },
  biometric: null,
  encryptedToken: null,
  createdAt: '2026-01-01T00:00:00Z',
  passwordChangedAt: '2026-01-01T00:00:00Z',
};

describe('schema parsers', () => {
  it('fall back to defaults for garbage input', () => {
    for (const garbage of [undefined, null, 42, 'x', [], { unexpected: true }]) {
      expect(parseSettings(garbage)).toEqual(DEFAULT_SETTINGS);
      expect(parseUi(garbage)).toEqual(DEFAULT_UI);
      expect(parsePolling(garbage)).toEqual(DEFAULT_POLLING);
      expect(parseCache(garbage)).toEqual(DEFAULT_CACHE);
      expect(parseSecurity(garbage)).toEqual({ vault: null });
      expect(parseMeta(garbage).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    }
  });

  it('parse settings field-by-field, keeping valid values and repairing invalid ones', () => {
    const parsed = parseSettings({
      host: { kind: 'enterprise', origin: 'https://GHE.example.com' },
      tokenKind: 'classic',
      sources: [
        { kind: 'repository', owner: 'Octo-Org', name: 'Hello-World' },
        { kind: 'repository', owner: 'octo-org', name: 'hello-world' },
        { kind: 'repository', owner: 'bad owner', name: 'x' },
        { kind: 'search', query: '  is:open   review-requested:@me ' },
        { kind: 'search', query: '   ' },
        'nonsense',
      ],
      activeSourceId: 'repo:missing/repo',
      pollIntervalMinutes: 0,
      staleThresholdDays: 14,
      theme: 'neon',
      notifications: {
        enabled: false,
        types: { 'new-comment': true, 'checks-failed': 'yes' },
        sound: null,
      },
    });
    expect(parsed.host).toEqual({ kind: 'enterprise', origin: 'https://ghe.example.com' });
    expect(parsed.tokenKind).toBe('classic');
    expect(parsed.sources).toEqual([
      {
        id: 'repo:octo-org/hello-world',
        kind: 'repository',
        owner: 'Octo-Org',
        name: 'Hello-World',
      },
      {
        id: 'search:is:open review-requested:@me',
        kind: 'search',
        label: 'is:open   review-requested:@me',
        query: 'is:open   review-requested:@me',
      },
    ]);
    expect(parsed.activeSourceId).toBe('repo:octo-org/hello-world');
    expect(parsed.pollIntervalMinutes).toBe(DEFAULT_SETTINGS.pollIntervalMinutes);
    expect(parsed.staleThresholdDays).toBe(14);
    expect(parsed.theme).toBe('system');
    expect(parsed.notifications.enabled).toBe(false);
    expect(parsed.notifications.types['new-comment']).toBe(true);
    expect(parsed.notifications.types['checks-failed']).toBe(true);
    expect(parsed.notifications.sound).toBeNull();
    expect(parseSettings({ host: { kind: 'enterprise', origin: 'http://insecure' } }).host).toEqual(
      { kind: 'github' },
    );
    expect(parseSettings({ notifications: { sound: 'airhorn' } }).notifications.sound).toBe(
      'chime',
    );
    expect(
      parseSettings({
        sources: [{ kind: 'search', query: 'q', label: 'Mine' }],
        activeSourceId: 'search:q',
      }).activeSourceId,
    ).toBe('search:q');
  });

  it('builds stable source and cache ids', () => {
    expect(repositorySourceId('Octo', 'Repo')).toBe('repo:octo/repo');
    expect(searchSourceId('  a   b ')).toBe('search:a b');
    expect(cacheKey('github.com', 'repo:o/r')).toBe('github.com|repo:o/r');
  });

  it('accepts only complete vault records', () => {
    expect(parseSecurity({ vault: VALID_VAULT }).vault).toEqual(VALID_VAULT);
    expect(parseSecurity({ vault: { ...VALID_VAULT, version: 2 } }).vault).toBeNull();
    expect(
      parseSecurity({ vault: { ...VALID_VAULT, kdf: { ...VALID_VAULT.kdf, iterations: -1 } } })
        .vault,
    ).toBeNull();
    expect(
      parseSecurity({ vault: { ...VALID_VAULT, passwordWrappedKey: { iv: '', data: 'x' } } }).vault,
    ).toBeNull();
    const withExtras = parseSecurity({
      vault: {
        ...VALID_VAULT,
        passwordChangedAt: undefined,
        encryptedToken: { iv: 'aQ==', data: 'ZA==' },
        biometric: {
          credentialId: 'abc',
          prfSalt: 'c2FsdA==',
          wrappedKey: { iv: 'aQ==', data: 'ZA==' },
        },
      },
    }).vault;
    expect(withExtras?.encryptedToken).toEqual({ iv: 'aQ==', data: 'ZA==' });
    expect(withExtras?.biometric?.enrolledAt).toBe('');
    expect(withExtras?.passwordChangedAt).toBe(VALID_VAULT.createdAt);
    expect(
      parseSecurity({ vault: { ...VALID_VAULT, biometric: { credentialId: 1 } } }).vault?.biometric,
    ).toBeNull();
  });

  it('parses polling state, dropping malformed entries', () => {
    const parsed = parsePolling({
      consecutiveFailures: 3,
      lastError: { kind: 'rate-limited', message: 'x'.repeat(500), at: '2026-01-01T00:00:00Z' },
      sources: { 'github.com|repo:o/r': { etag: 'W/"1"', cyclesSinceFull: 2 }, broken: 7 },
      viewer: { value: { login: 'mona' }, fetchedAt: '2026-01-01T00:00:00Z' },
      viewerTeams: { value: null, fetchedAt: '2026-01-01T00:00:00Z' },
      requiredApprovals: {
        ok: { value: 2, fetchedAt: 't' },
        unknown: { value: null, fetchedAt: 't' },
        bad: { value: -1, fetchedAt: 't' },
      },
      notified: { 'a|b': 't', bad: 3 },
    });
    expect(parsed.consecutiveFailures).toBe(3);
    expect(parsed.lastError?.message).toHaveLength(300);
    expect(Object.keys(parsed.sources)).toEqual(['github.com|repo:o/r']);
    expect(parsed.viewer?.value).toEqual({ login: 'mona', avatarUrl: '' });
    expect(parsed.viewerTeams?.value).toBeNull();
    expect(Object.keys(parsed.requiredApprovals)).toEqual(['ok', 'unknown']);
    expect(parsed.notified).toEqual({ 'a|b': 't' });
    expect(parsePolling({ lastError: { kind: 'bogus', message: 'x' } }).lastError).toBeNull();
    expect(
      parsePolling({
        viewerTeams: { value: [{ organization: 'o', slug: 's' }, { slug: 1 }], fetchedAt: 't' },
      }).viewerTeams?.value,
    ).toEqual([{ organization: 'o', slug: 's' }]);
    expect(parsePolling({ viewer: { value: {}, fetchedAt: 't' } }).viewer).toBeNull();
  });

  it('parses cache entries, dropping malformed PRs', () => {
    const goodPr = {
      id: 'g:o/r#1',
      nodeId: 'PR_1',
      number: 1,
      title: 't',
      htmlUrl: 'https://x',
      repository: {},
      labels: [],
      requestedReviewers: [],
      latestReviews: [],
    };
    const parsed = parseCache({
      entries: {
        a: { fetchedAt: 't', pullRequests: [goodPr, { id: 'bad' }], truncated: true },
        b: { pullRequests: [] },
      },
    });
    expect(Object.keys(parsed.entries)).toEqual(['a']);
    expect(parsed.entries.a?.pullRequests).toHaveLength(1);
    expect(parsed.entries.a?.truncated).toBe(true);
  });

  it('parses ui state including author tabs and drafts', () => {
    expect(parseUi({ activeTab: 'author:mona' }).activeTab).toBe('author:mona');
    expect(parseUi({ activeTab: 'needs-my-review' }).activeTab).toBe('needs-my-review');
    expect(parseUi({ activeTab: 'author:<script>' }).activeTab).toBe('all');
    const parsed = parseUi({
      draftFilter: 'only',
      sortDirection: 'asc',
      configurationDraft: {
        savedAt: 't',
        hostInput: 'ghe.example.com',
        useEnterprise: true,
        sourceInputs: ['o/r', 3],
      },
    });
    expect(parsed.draftFilter).toBe('only');
    expect(parsed.sortDirection).toBe('asc');
    expect(parsed.configurationDraft).toEqual({
      hostInput: 'ghe.example.com',
      useEnterprise: true,
      tokenKind: 'fine-grained',
      sourceInputs: ['o/r'],
      searchQuery: '',
      savedAt: 't',
    });
    expect(parseUi({ configurationDraft: { hostInput: 'x' } }).configurationDraft).toBeNull();
  });
});

describe('local repositories', () => {
  it('read defaults when empty, then round-trip validated values', async () => {
    const repositories = createLocalRepositories();
    expect(await repositories.settings.read()).toEqual(DEFAULT_SETTINGS);
    const next = { ...DEFAULT_SETTINGS, pollIntervalMinutes: 10 };
    await repositories.settings.write(next);
    expect(await repositories.settings.read()).toEqual(next);
    fake.chrome.storage.local.data.set('settings', { pollIntervalMinutes: 'ten' });
    expect((await repositories.settings.read()).pollIntervalMinutes).toBe(5);
    await repositories.settings.clear();
    expect(fake.chrome.storage.local.data.has('settings')).toBe(false);
  });

  it('serializes concurrent updates within a context (no lost writes)', async () => {
    const { polling } = createLocalRepositories();
    await Promise.all(
      Array.from({ length: 10 }, () =>
        polling.update((current) => ({
          ...current,
          consecutiveFailures: current.consecutiveFailures + 1,
        })),
      ),
    );
    expect((await polling.read()).consecutiveFailures).toBe(10);
  });

  it('keeps the queue alive after a failed write', async () => {
    const { ui } = createLocalRepositories();
    fake.chrome.storage.local.set.mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'));
    await expect(ui.write(DEFAULT_UI)).rejects.toThrow('QUOTA');
    await ui.update((current) => ({ ...current, statsCollapsed: true }));
    expect((await ui.read()).statsCollapsed).toBe(true);
  });

  it('notifies subscribers with parsed values (defaults on removal)', async () => {
    const { ui } = createLocalRepositories();
    const listener = vi.fn();
    const unsubscribe = ui.subscribe(listener);
    await ui.update((current) => ({ ...current, labelFilter: 'bug' }));
    await ui.clear();
    expect(listener.mock.calls.map(([value]) => (value as typeof DEFAULT_UI).labelFilter)).toEqual([
      'bug',
      null,
    ]);
    unsubscribe();
  });
});

describe('session repositories', () => {
  it('live in chrome.storage.session only and parse defensively', async () => {
    const session = createSessionRepositories();
    expect(await session.vaultKey.read()).toBeNull();
    expect(await session.lockedPromptShown.read()).toBe(false);
    await session.vaultKey.write('a2V5');
    await session.tokenDraft.write({ iv: 'aQ==', data: 'ZA==' });
    expect(fake.chrome.storage.session.data.get('vaultKey')).toBe('a2V5');
    expect(fake.chrome.storage.local.data.size).toBe(0);
    const listener = vi.fn();
    session.unlockedAt.subscribe(listener);
    await session.unlockedAt.write('2026-01-01T00:00:00Z');
    expect(listener).toHaveBeenCalledWith('2026-01-01T00:00:00Z');
    await session.vaultKey.clear();
    expect(await session.vaultKey.read()).toBeNull();
    fake.chrome.storage.session.data.set('tokenDraft', { iv: 1 });
    expect(await session.tokenDraft.read()).toBeNull();
  });
});

describe('runMigrations', () => {
  const area = () => createStorageArea<LocalKey>('local');
  const now = new Date('2026-02-01T00:00:00Z');

  it('initializes meta on first run', async () => {
    expect(await runMigrations(area(), { now })).toEqual({ kind: 'initialized' });
    expect(fake.chrome.storage.local.data.get('meta')).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      installedAt: now.toISOString(),
      welcomeSeenAt: null,
      biometricOfferedAt: null,
    });
    expect(await runMigrations(area(), { now })).toEqual({ kind: 'up-to-date' });
  });

  it('applies migrations sequentially and records each step', async () => {
    fake.chrome.storage.local.data.set('meta', {
      schemaVersion: 1,
      installedAt: 'x',
      welcomeSeenAt: null,
    });
    const steps: number[] = [];
    const migrations = {
      1: () => {
        steps.push(1);
        return Promise.resolve();
      },
      2: () => {
        steps.push(2);
        return Promise.resolve();
      },
    };
    expect(await runMigrations(area(), { migrations, targetVersion: 3 })).toEqual({
      kind: 'migrated',
      from: 1,
      to: 3,
    });
    expect(steps).toEqual([1, 2]);
    expect(fake.chrome.storage.local.data.get('meta')).toMatchObject({
      schemaVersion: 3,
      installedAt: 'x',
    });
  });

  it('refuses gaps and leaves newer data untouched', async () => {
    fake.chrome.storage.local.data.set('meta', { schemaVersion: 1 });
    await expect(runMigrations(area(), { migrations: {}, targetVersion: 2 })).rejects.toThrow(
      'Missing storage migration',
    );
    fake.chrome.storage.local.data.set('meta', { schemaVersion: 9 });
    expect(await runMigrations(area())).toEqual({ kind: 'newer-than-supported', version: 9 });
  });
});

describe('createPersistedStore', () => {
  it('hydrates, follows other contexts, and persists updates', async () => {
    const repositories = createLocalRepositories();
    const persisted = createPersistedStore(repositories.ui);
    expect(persisted.store.getState()).toEqual({ value: DEFAULT_UI, isHydrated: false });
    await repositories.ui.write({ ...DEFAULT_UI, statsCollapsed: true });
    await persisted.hydrate();
    expect(persisted.store.getState()).toMatchObject({
      isHydrated: true,
      value: { statsCollapsed: true },
    });

    await createLocalRepositories().ui.update((current) => ({ ...current, labelFilter: 'bug' }));
    expect(persisted.store.getState().value.labelFilter).toBe('bug');

    await persisted.update((current) => ({ ...current, sortField: 'created' }));
    expect((await repositories.ui.read()).sortField).toBe('created');
    persisted.dispose();
    await repositories.ui.update((current) => ({ ...current, labelFilter: null }));
    expect(persisted.store.getState().value.labelFilter).toBe('bug');
  });

  it('rolls back the optimistic value when persisting fails', async () => {
    const persisted = createPersistedStore(createLocalRepositories().ui);
    await persisted.hydrate();
    fake.chrome.storage.local.set.mockRejectedValueOnce(new Error('write failed'));
    await expect(
      persisted.update((current) => ({ ...current, statsCollapsed: true })),
    ).rejects.toThrow('write failed');
    expect(persisted.store.getState().value.statsCollapsed).toBe(false);
  });
});
