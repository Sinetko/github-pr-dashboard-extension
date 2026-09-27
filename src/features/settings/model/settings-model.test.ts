import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, type SettingsRecord } from '@core/storage';

import {
  applyConfigurationToSettings,
  draftFromForm,
  formFromSettings,
  validateConfiguration,
  type ConfigurationForm,
} from './configuration-form.model';
import { planHostChange } from './host-change.model';
import { INITIAL_PANEL_STATE, panelReducer } from './panel-state.model';

const TOKEN = 'github_pat_11AAAAAAAAAAAAAAAAAAAAAAAA';
const SETTINGS: SettingsRecord = {
  ...DEFAULT_SETTINGS,
  host: { kind: 'enterprise', origin: 'https://ghe.example.com' },
  sources: [
    { id: 'repo:o/a', kind: 'repository', owner: 'o', name: 'a' },
    { id: 'search:is:open', kind: 'search', label: 'Saved search', query: 'is:open' },
  ],
  activeSourceId: 'search:is:open',
};
const form = (overrides: Partial<ConfigurationForm> = {}): ConfigurationForm => ({
  ...formFromSettings(DEFAULT_SETTINGS, null),
  token: TOKEN,
  repositoryInputs: ['octo-org/hello-world'],
  ...overrides,
});

describe('panelReducer', () => {
  it('keeps Settings and About mutually exclusive', () => {
    const settings = panelReducer(INITIAL_PANEL_STATE, { type: 'open-settings' });
    expect(settings).toEqual({ panel: 'settings', tab: 'general' });
    const security = panelReducer(settings, { type: 'select-tab', tab: 'security' });
    expect(panelReducer(security, { type: 'open-settings' })).toEqual({
      panel: 'settings',
      tab: 'security',
    });
    expect(panelReducer(security, { type: 'open-about' })).toEqual({ panel: 'about' });
    expect(panelReducer({ panel: 'about' }, { type: 'select-tab', tab: 'general' })).toEqual({
      panel: 'about',
    });
    expect(panelReducer({ panel: 'about' }, { type: 'open-settings', tab: 'appearance' })).toEqual({
      panel: 'settings',
      tab: 'appearance',
    });
    expect(panelReducer(security, { type: 'close' })).toEqual(INITIAL_PANEL_STATE);
  });
});

describe('configuration form', () => {
  it('round-trips settings and prefers a saved draft (without token)', () => {
    const fromSettings = formFromSettings(SETTINGS, null);
    expect(fromSettings).toMatchObject({
      useEnterprise: true,
      hostInput: 'https://ghe.example.com',
      repositoryInputs: ['o/a'],
      searchQuery: 'is:open',
      token: '',
    });
    const draft = draftFromForm(
      { ...fromSettings, token: TOKEN, hostInput: 'ghe2.example.com' },
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(JSON.stringify(draft)).not.toContain(TOKEN);
    expect(formFromSettings(SETTINGS, draft).hostInput).toBe('ghe2.example.com');
  });

  it('validates host, token, sources and ranges', () => {
    expect(validateConfiguration(form(), { hasSavedToken: false }).isValid).toBe(true);
    const invalid = validateConfiguration(
      form({
        useEnterprise: true,
        hostInput: 'http://x',
        token: 'nope!',
        repositoryInputs: ['bad', ''],
        pollIntervalMinutes: 0,
        staleThresholdDays: 400,
      }),
      { hasSavedToken: false },
    );
    expect(invalid.isValid).toBe(false);
    expect(Object.keys(invalid.errors).sort()).toEqual([
      'host',
      'pollIntervalMinutes',
      'repositories',
      'staleThresholdDays',
      'token',
    ]);
    expect(invalid.errors.repositories).toEqual({ 0: 'Use the owner/repository format' });
    expect(validateConfiguration(form({ token: '' }), { hasSavedToken: false }).errors.token).toBe(
      'Paste a personal access token',
    );
    expect(validateConfiguration(form({ token: '' }), { hasSavedToken: true }).isValid).toBe(true);
    expect(
      validateConfiguration(form({ repositoryInputs: [] }), { hasSavedToken: true }).errors.sources,
    ).toBeDefined();
  });

  it('dedupes repositories and adds the saved search', () => {
    const validated = validateConfiguration(
      form({ repositoryInputs: ['o/a', 'O/A', 'o/b'], searchQuery: ' review-requested:@me ' }),
      { hasSavedToken: true },
    );
    expect(validated.isValid && validated.sources.map((source) => source.id)).toEqual([
      'repo:o/a',
      'repo:o/b',
      'search:review-requested:@me',
    ]);
  });

  it('applies to settings, keeping the active source when still present', () => {
    const validated = validateConfiguration(
      form({ repositoryInputs: ['o/a'], searchQuery: 'is:open' }),
      { hasSavedToken: true },
    );
    if (!validated.isValid) {
      throw new Error('expected valid');
    }
    const applied = applyConfigurationToSettings(
      SETTINGS,
      form({ tokenKind: 'classic', pollIntervalMinutes: 10 }),
      validated,
    );
    expect(applied).toMatchObject({
      host: { kind: 'github' },
      tokenKind: 'classic',
      pollIntervalMinutes: 10,
      activeSourceId: 'search:is:open',
    });
    const onlyRepo = validateConfiguration(form({ repositoryInputs: ['o/z'] }), {
      hasSavedToken: true,
    });
    if (!onlyRepo.isValid) {
      throw new Error('expected valid');
    }
    expect(applyConfigurationToSettings(SETTINGS, form(), onlyRepo).activeSourceId).toBe(
      'repo:o/z',
    );
  });
});

describe('planHostChange', () => {
  const github = { kind: 'github' } as const;
  const ghe = { kind: 'enterprise', origin: 'https://ghe.example.com' } as const;
  const other = { kind: 'enterprise', origin: 'https://other.example.com' } as const;

  it('requests the new GHES origin and releases the old one only when the host changes', () => {
    expect(planHostChange(github, github)).toEqual({
      hostChanged: false,
      requestOrigin: null,
      releaseOrigin: null,
    });
    expect(planHostChange(github, ghe)).toEqual({
      hostChanged: true,
      requestOrigin: 'https://ghe.example.com/*',
      releaseOrigin: null,
    });
    expect(planHostChange(ghe, ghe)).toEqual({
      hostChanged: false,
      requestOrigin: 'https://ghe.example.com/*',
      releaseOrigin: null,
    });
    expect(planHostChange(ghe, other)).toEqual({
      hostChanged: true,
      requestOrigin: 'https://other.example.com/*',
      releaseOrigin: 'https://ghe.example.com/*',
    });
    expect(planHostChange(ghe, github)).toEqual({
      hostChanged: true,
      requestOrigin: null,
      releaseOrigin: 'https://ghe.example.com/*',
    });
  });
});
