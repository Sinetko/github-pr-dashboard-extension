import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createVaultStateStore } from '@core/security';
import {
  createLocalRepositories,
  createPersistedStore,
  createSessionRepositories,
  DEFAULT_SETTINGS,
} from '@core/storage';
import type { SettingsServices } from '@features/settings';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';
import { renderWithTheme } from '@test/render';
import { createTokenVaultFake, type TokenVaultFake } from '@test/token-vault-fake';

import { App } from './app.component';

import type { PopupServices } from './popup-services';

const STRONG = 'Correct-Horse-Battery-9';

let chromeFake: ChromeFake;
let vaultFake: TokenVaultFake;

const buildServices = (biometricAvailable = true): PopupServices => {
  const repositories = createLocalRepositories();
  const session = createSessionRepositories();
  const vaultState = createVaultStateStore(vaultFake.vault, [vaultFake.subscribe]);
  const meta = createPersistedStore(repositories.meta);
  const settings = createPersistedStore(repositories.settings);
  const ui = createPersistedStore(repositories.ui);
  const settingsServices: SettingsServices = {
    settings,
    ui,
    cache: repositories.cache,
    polling: repositories.polling,
    vault: vaultFake.vault,
    vaultState,
    testConnection: vi.fn(() =>
      Promise.resolve({ login: 'mona', name: null, avatarUrl: '', scopes: null }),
    ),
    requestOriginPermission: vi.fn(() => Promise.resolve(true)),
    releaseOriginPermission: vi.fn(() => Promise.resolve(true)),
    openTab: vi.fn(() => Promise.resolve()),
    sendMessage: vi.fn(() => Promise.resolve(true)),
    extensionVersion: '1.0.0',
  };
  return {
    settingsServices,
    dashboardServices: {
      settings,
      ui,
      cache: repositories.cache,
      polling: repositories.polling,
      openTab: vi.fn(() => Promise.resolve()),
      sendMessage: vi.fn(() => Promise.resolve(true)),
    },
    repositories,
    session,
    vault: vaultFake.vault,
    vaultState,
    meta,
    settings,
    ui,
    credentials: { create: vi.fn(), get: vi.fn() },
    isBiometricAvailable: () => Promise.resolve(biometricAvailable),
    notifyUnlockChanged: vi.fn(),
    initialize: async () => {
      await Promise.all([meta.hydrate(), settings.hydrate(), ui.hydrate(), vaultState.refresh()]);
    },
  };
};

beforeEach(() => {
  chromeFake = installChromeFake();
  vaultFake = createTokenVaultFake();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('popup onboarding flow', () => {
  it('walks welcome → password → biometric offer → configure on a fresh install', async () => {
    const services = buildServices();
    renderWithTheme(<App services={services} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Get started' }));
    expect(chromeFake.chrome.storage.local.data.get('meta')).toMatchObject({
      welcomeSeenAt: expect.any(String) as string,
    });

    await userEvent.type(await screen.findByLabelText('Password'), STRONG);
    await userEvent.type(screen.getByLabelText('Confirm password'), STRONG);
    await userEvent.click(screen.getByRole('button', { name: 'Create vault' }));
    expect(vaultFake.vault.setupPassword).toHaveBeenCalledWith(STRONG);
    expect(services.notifyUnlockChanged).toHaveBeenCalled();

    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(await screen.findByRole('heading', { name: 'Connect GitHub' })).toBeInTheDocument();
  });

  it('skips the biometric offer when no platform authenticator exists', async () => {
    await vaultFake.vault.setupPassword(STRONG);
    await createLocalRepositories().meta.write({
      schemaVersion: 1,
      installedAt: null,
      welcomeSeenAt: 't',
      biometricOfferedAt: null,
    });
    renderWithTheme(<App services={buildServices(false)} />);
    expect(await screen.findByRole('heading', { name: 'Connect GitHub' })).toBeInTheDocument();
  });

  it('enrolls biometrics from the offer screen', async () => {
    await vaultFake.vault.setupPassword(STRONG);
    await createLocalRepositories().meta.write({
      schemaVersion: 1,
      installedAt: null,
      welcomeSeenAt: 't',
      biometricOfferedAt: null,
    });
    renderWithTheme(<App services={buildServices()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Enable biometric unlock' }));
    expect(await screen.findByRole('heading', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(vaultFake.state.hasBiometric).toBe(true);
  });

  it('asks to unlock a locked vault, then lands on the dashboard when fully configured', async () => {
    await vaultFake.vault.setupPassword(STRONG);
    await vaultFake.vault.saveToken('github_pat_x');
    await vaultFake.vault.lock();
    const repositories = createLocalRepositories();
    await repositories.meta.write({
      schemaVersion: 1,
      installedAt: null,
      welcomeSeenAt: 't',
      biometricOfferedAt: 't',
    });
    await repositories.settings.write({
      ...DEFAULT_SETTINGS,
      sources: [{ id: 'repo:o/r', kind: 'repository', owner: 'o', name: 'r' }],
    });
    const services = buildServices();
    renderWithTheme(<App services={services} />);
    await userEvent.type(await screen.findByLabelText('Vault password'), `${STRONG}{Enter}`);
    expect(await screen.findByRole('region', { name: 'Dashboard' })).toBeInTheDocument();
    expect(services.notifyUnlockChanged).toHaveBeenCalled();
  });

  it('completes configuration, then navigates Settings ↔ About and locks from Security', async () => {
    await vaultFake.vault.setupPassword(STRONG);
    await createLocalRepositories().meta.write({
      schemaVersion: 1,
      installedAt: null,
      welcomeSeenAt: 't',
      biometricOfferedAt: 't',
    });
    renderWithTheme(<App services={buildServices()} />);
    await userEvent.type(
      await screen.findByLabelText('Token'),
      'github_pat_11AAAAAAAAAAAAAAAAAAAAAAAA',
    );
    await userEvent.type(screen.getByLabelText('Repository 1'), 'octo-org/hello-world');
    await userEvent.click(screen.getByRole('button', { name: 'Save and open dashboard' }));
    expect(await screen.findByRole('region', { name: 'Dashboard' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close about' }));
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Security' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lock now' }));
    expect(await screen.findByRole('heading', { name: 'Unlock PR Dashboard' })).toBeInTheDocument();
  });

  it('resets a forgotten vault back to password setup and re-offers biometrics later', async () => {
    await vaultFake.vault.setupPassword(STRONG);
    await vaultFake.vault.lock();
    await createLocalRepositories().meta.write({
      schemaVersion: 1,
      installedAt: null,
      welcomeSeenAt: 't',
      biometricOfferedAt: 't',
    });
    renderWithTheme(<App services={buildServices()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset vault' }));
    expect(
      await screen.findByRole('heading', { name: 'Create a vault password' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(chromeFake.chrome.storage.local.data.get('meta')).toMatchObject({
        biometricOfferedAt: null,
      });
    });
  });

  it('shows an error when storage cannot be read', async () => {
    const services = {
      ...buildServices(),
      initialize: () => Promise.reject(new Error('storage down')),
    };
    renderWithTheme(<App services={services} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read extension storage');
  });
});
