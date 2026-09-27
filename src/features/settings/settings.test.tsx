import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GithubUnauthorizedError, type Viewer } from '@core/github';
import { createVaultStateStore } from '@core/security';
import {
  createLocalRepositories,
  createPersistedStore,
  DEFAULT_SETTINGS,
  type SettingsRecord,
} from '@core/storage';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';
import { renderWithTheme } from '@test/render';
import { createTokenVaultFake, type TokenVaultFake } from '@test/token-vault-fake';

import { AboutPanel, SettingsScreen } from '.';
import { GeneralSettingsForm } from './components/general-settings-form';
import { scopeWarnings } from './hooks/use-configuration-form';
import { saveConfiguration } from './model/save-configuration';

import type { SettingsServices } from './model/settings-services.types';

const STRONG = 'Correct-Horse-Battery-9';
const TOKEN = 'github_pat_11AAAAAAAAAAAAAAAAAAAAAAAA';
const VIEWER: Viewer = { login: 'mona', name: null, avatarUrl: '', scopes: ['repo', 'read:org'] };

let chromeFake: ChromeFake;
let vaultFake: TokenVaultFake;

const buildServices = async (
  settings: SettingsRecord = DEFAULT_SETTINGS,
): Promise<SettingsServices> => {
  const repositories = createLocalRepositories();
  await repositories.settings.write(settings);
  const settingsStore = createPersistedStore(repositories.settings);
  const uiStore = createPersistedStore(repositories.ui);
  const vaultState = createVaultStateStore(vaultFake.vault, [vaultFake.subscribe]);
  await Promise.all([settingsStore.hydrate(), uiStore.hydrate(), vaultState.refresh()]);
  return {
    settings: settingsStore,
    ui: uiStore,
    cache: repositories.cache,
    polling: repositories.polling,
    vault: vaultFake.vault,
    vaultState,
    testConnection: vi.fn<SettingsServices['testConnection']>(() => Promise.resolve(VIEWER)),
    requestOriginPermission: vi.fn(() => Promise.resolve(true)),
    releaseOriginPermission: vi.fn(() => Promise.resolve(true)),
    openTab: vi.fn(() => Promise.resolve()),
    sendMessage: vi.fn(() => Promise.resolve(true)),
    extensionVersion: '9.9.9',
  };
};

beforeEach(async () => {
  chromeFake = installChromeFake();
  vaultFake = createTokenVaultFake();
  await vaultFake.vault.setupPassword(STRONG);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const fillMinimal = async (): Promise<void> => {
  await userEvent.type(screen.getByLabelText('Token'), TOKEN);
  await userEvent.type(screen.getByLabelText('Repository 1'), 'octo-org/hello-world');
};

describe('GeneralSettingsForm', () => {
  it('shows validation errors only after a save attempt', async () => {
    const services = await buildServices();
    renderWithTheme(<GeneralSettingsForm services={services} mode="onboarding" />);
    expect(screen.queryByText('Paste a personal access token')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save and open dashboard' }));
    expect(screen.getByText('Paste a personal access token')).toBeInTheDocument();
    expect(screen.getByText('Add at least one repository or a saved search')).toBeInTheDocument();
    expect(vaultFake.vault.saveToken).not.toHaveBeenCalled();
  });

  it('saves token (encrypted via the vault), sources and triggers a poll', async () => {
    const onSaved = vi.fn();
    const services = await buildServices();
    renderWithTheme(
      <GeneralSettingsForm services={services} mode="onboarding" onSaved={onSaved} />,
    );
    await fillMinimal();
    await userEvent.type(screen.getByLabelText('Saved search (optional)'), 'review-requested:@me');
    await userEvent.click(screen.getByRole('button', { name: 'Save and open dashboard' }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(vaultFake.state.token).toBe(TOKEN);
    const stored = chromeFake.chrome.storage.local.data.get('settings') as SettingsRecord;
    expect(stored.sources.map((source) => source.id)).toEqual([
      'repo:octo-org/hello-world',
      'search:review-requested:@me',
    ]);
    expect(JSON.stringify([...chromeFake.chrome.storage.local.data.values()])).not.toContain(TOKEN);
    expect(services.sendMessage).toHaveBeenCalledWith({ type: 'poll-now' });
    expect(services.requestOriginPermission).not.toHaveBeenCalled();
  });

  it('requests the GHES origin permission and reports a denial', async () => {
    const services = await buildServices();
    vi.mocked(services.requestOriginPermission).mockResolvedValueOnce(false);
    renderWithTheme(<GeneralSettingsForm services={services} mode="settings" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Use GitHub Enterprise Server' }));
    await userEvent.type(screen.getByLabelText('Enterprise host'), 'ghe.example.com');
    await fillMinimal();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(/Permission to access https:\/\/ghe\.example\.com is required/),
    ).toBeInTheDocument();
    expect(services.requestOriginPermission).toHaveBeenCalledWith('https://ghe.example.com/*');
    expect(vaultFake.vault.saveToken).not.toHaveBeenCalled();
    const ui = chromeFake.chrome.storage.local.data.get('ui') as {
      configurationDraft: { hostInput: string };
    };
    expect(ui.configurationDraft.hostInput).toBe('ghe.example.com');
    expect(JSON.stringify(ui)).not.toContain(TOKEN);
  });

  it('wipes cross-host cache/polling state when the host changes, and releases the old origin', async () => {
    const services = await buildServices({
      ...DEFAULT_SETTINGS,
      host: { kind: 'enterprise', origin: 'https://ghe.example.com' },
      sources: [{ id: 'repo:o/r', kind: 'repository', owner: 'o', name: 'r' }],
      activeSourceId: 'repo:o/r',
    });
    await vaultFake.vault.saveToken(TOKEN);
    await services.vaultState.refresh();
    await services.cache.write({
      entries: {
        'ghe.example.com|repo:o/r': { fetchedAt: 't', pullRequests: [], truncated: false },
      },
    });
    renderWithTheme(<GeneralSettingsForm services={services} mode="settings" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Use GitHub Enterprise Server' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(chromeFake.chrome.storage.local.data.has('cache')).toBe(false);
    expect(services.releaseOriginPermission).toHaveBeenCalledWith('https://ghe.example.com/*');
    expect((chromeFake.chrome.storage.local.data.get('settings') as SettingsRecord).host).toEqual({
      kind: 'github',
    });
  });

  it('tests the connection with the typed token and explains missing scopes', async () => {
    const services = await buildServices();
    vi.mocked(services.testConnection)
      .mockResolvedValueOnce({ ...VIEWER, scopes: ['public_repo'] })
      .mockRejectedValueOnce(new GithubUnauthorizedError(401, '', 'GET /user'));
    renderWithTheme(<GeneralSettingsForm services={services} mode="settings" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Classic' }));
    await userEvent.type(screen.getByLabelText('Token'), TOKEN);
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(await screen.findByText('Connected as @mona')).toBeInTheDocument();
    expect(screen.getByText(/Only public repositories/)).toBeInTheDocument();
    expect(services.testConnection).toHaveBeenCalledWith({ kind: 'github' }, TOKEN);
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(await screen.findByText(/rejected the token/)).toBeInTheDocument();
  });

  it('asks for a token before testing, and uses the saved one when present', async () => {
    const services = await buildServices();
    renderWithTheme(<GeneralSettingsForm services={services} mode="settings" />);
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(await screen.findByText('Paste a token first.')).toBeInTheDocument();
    await act(async () => {
      await vaultFake.vault.saveToken(TOKEN);
      await services.vaultState.refresh();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));
    await screen.findByText('Connected as @mona');
    expect(services.testConnection).toHaveBeenLastCalledWith({ kind: 'github' }, TOKEN);
    expect(screen.getByLabelText('Replace token')).toHaveValue('');
  });

  it('restores an unsaved draft (and encrypted token draft) after the popup reopens', async () => {
    const services = await buildServices();
    const first = renderWithTheme(<GeneralSettingsForm services={services} mode="onboarding" />);
    await fillMinimal();
    await waitFor(() => {
      expect(vaultFake.state.tokenDraft).toBe(TOKEN);
    });
    first.unmount();
    renderWithTheme(<GeneralSettingsForm services={await buildServices()} mode="onboarding" />);
    expect(screen.getByLabelText('Repository 1')).toHaveValue('octo-org/hello-world');
    await waitFor(() => {
      expect(screen.getByLabelText('Token')).toHaveValue(TOKEN);
    });
  });

  it('opens the right token-creation page for the selected kind', async () => {
    const services = await buildServices();
    renderWithTheme(<GeneralSettingsForm services={services} mode="settings" />);
    await userEvent.click(screen.getByRole('button', { name: 'Create token on GitHub ↗' }));
    expect(services.openTab).toHaveBeenLastCalledWith(
      'https://github.com/settings/personal-access-tokens/new',
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Classic' }));
    expect(screen.getByRole('list', { name: 'Required token permissions' })).toHaveTextContent(
      'read:org',
    );
    await userEvent.click(screen.getByRole('switch', { name: 'Use GitHub Enterprise Server' }));
    await userEvent.type(screen.getByLabelText('Enterprise host'), 'ghe.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Create token on GitHub ↗' }));
    expect(vi.mocked(services.openTab).mock.lastCall?.[0]).toMatch(
      /^https:\/\/ghe\.example\.com\/settings\/tokens\/new\?scopes=repo%2Cread%3Aorg/,
    );
  });

  it('manages the repository list', async () => {
    const services = await buildServices();
    renderWithTheme(<GeneralSettingsForm services={services} mode="settings" />);
    await userEvent.type(screen.getByLabelText('Repository 1'), 'not a repo');
    await userEvent.click(screen.getByRole('button', { name: '+ Add repository' }));
    await userEvent.type(screen.getByLabelText('Repository 2'), 'o/r');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Use the owner/repository format')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove repository 1' }));
    expect(screen.getByLabelText('Repository 1')).toHaveValue('o/r');
  });
});

describe('saveConfiguration', () => {
  it('requests permission before touching the vault', async () => {
    const services = await buildServices();
    const order: string[] = [];
    vi.mocked(services.requestOriginPermission).mockImplementation(() => {
      order.push('permission');
      return Promise.resolve(true);
    });
    vi.mocked(vaultFake.vault.saveToken).mockImplementationOnce(() => {
      order.push('token');
      return Promise.resolve();
    });
    const outcome = await saveConfiguration(
      services,
      {
        useEnterprise: true,
        hostInput: 'ghe.example.com',
        tokenKind: 'classic',
        token: TOKEN,
        repositoryInputs: ['o/r'],
        searchQuery: '',
        pollIntervalMinutes: 5,
        staleThresholdDays: 5,
      },
      {
        host: { kind: 'enterprise', origin: 'https://ghe.example.com' },
        sources: [{ id: 'repo:o/r', kind: 'repository', owner: 'o', name: 'r' }],
      },
    );
    expect(outcome).toEqual({ kind: 'saved' });
    expect(order).toEqual(['permission', 'token']);
  });
});

describe('scopeWarnings', () => {
  it('only applies to classic tokens with known scopes', () => {
    expect(scopeWarnings(VIEWER, 'classic')).toEqual([]);
    expect(scopeWarnings({ ...VIEWER, scopes: [] }, 'classic')).toHaveLength(2);
    expect(scopeWarnings({ ...VIEWER, scopes: [] }, 'fine-grained')).toEqual([]);
    expect(scopeWarnings({ ...VIEWER, scopes: null }, 'classic')).toEqual([]);
  });
});

describe('SettingsScreen', () => {
  it('switches tabs, updates notification/appearance settings and renders the security slot', async () => {
    const services = await buildServices();
    const onSelectTab = vi.fn();
    const { rerender } = renderWithTheme(
      <SettingsScreen
        services={services}
        tab="notifications"
        onSelectTab={onSelectTab}
        onClose={vi.fn()}
        onOpenAbout={vi.fn()}
        securityPanel={<div>security-slot</div>}
      />,
    );
    await userEvent.click(screen.getByRole('switch', { name: 'New comment on my PR' }));
    await waitFor(() => {
      expect(
        (chromeFake.chrome.storage.local.data.get('settings') as SettingsRecord).notifications
          .types['new-comment'],
      ).toBe(true);
    });
    await userEvent.selectOptions(screen.getByLabelText('Sound'), 'Ping');
    expect(services.sendMessage).toHaveBeenCalledWith({ type: 'test-sound', sound: 'ping' });
    await userEvent.click(screen.getByRole('button', { name: 'Send test notification' }));
    expect(services.sendMessage).toHaveBeenCalledWith({ type: 'test-notification' });
    await userEvent.selectOptions(screen.getByLabelText('Sound'), 'No sound');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    });
    await userEvent.click(screen.getByRole('switch', { name: 'Desktop notifications' }));
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Checks failed' })).toBeDisabled();
    });

    await userEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
    expect(onSelectTab).toHaveBeenCalledWith('appearance');
    rerender(
      <SettingsScreen
        services={services}
        tab="appearance"
        onSelectTab={onSelectTab}
        onClose={vi.fn()}
        onOpenAbout={vi.fn()}
        securityPanel={<div>security-slot</div>}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Theme'), 'Dark dimmed');
    await waitFor(() => {
      expect((chromeFake.chrome.storage.local.data.get('settings') as SettingsRecord).theme).toBe(
        'dimmed',
      );
    });
    rerender(
      <SettingsScreen
        services={services}
        tab="security"
        onSelectTab={onSelectTab}
        onClose={vi.fn()}
        onOpenAbout={vi.fn()}
        securityPanel={<div>security-slot</div>}
      />,
    );
    expect(screen.getByText('security-slot')).toBeInTheDocument();
  });
});

describe('AboutPanel', () => {
  it('shows version, security model and read-only disclaimer', async () => {
    const onClose = vi.fn();
    renderWithTheme(<AboutPanel version="1.2.3" onClose={onClose} />);
    expect(screen.getByText('PR Dashboard 1.2.3')).toBeInTheDocument();
    expect(screen.getByText(/It is read-only/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close about' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
