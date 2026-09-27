import { sendMessage } from '@core/chrome/messaging';
import { releaseOriginPermission, requestOriginPermission } from '@core/chrome/permissions';
import { getExtensionId, getExtensionVersion } from '@core/chrome/runtime';
import { createStorageArea } from '@core/chrome/storage';
import { openTab } from '@core/chrome/tabs';
import { fetchViewer } from '@core/github';
import {
  collectFingerprintSources,
  computeFingerprint,
  createTokenVault,
  createVaultStateStore,
  isPlatformAuthenticatorAvailable,
  type CredentialsLike,
  type TokenVault,
  type VaultStateStore,
} from '@core/security';
import {
  createLocalRepositories,
  createPersistedStore,
  createSessionRepositories,
  runMigrations,
  type LocalKey,
  type LocalRepositories,
  type MetaRecord,
  type PersistedStore,
  type SessionRepositories,
  type SettingsRecord,
  type UiRecord,
} from '@core/storage';
import type { DashboardServices } from '@features/dashboard';
import type { SettingsServices } from '@features/settings';

export interface PopupServices {
  repositories: LocalRepositories;
  session: SessionRepositories;
  vault: TokenVault;
  vaultState: VaultStateStore;
  meta: PersistedStore<MetaRecord>;
  settings: PersistedStore<SettingsRecord>;
  ui: PersistedStore<UiRecord>;
  credentials: CredentialsLike;
  isBiometricAvailable: () => Promise<boolean>;
  notifyUnlockChanged: () => void;
  initialize: () => Promise<void>;
  settingsServices: SettingsServices;
  dashboardServices: DashboardServices;
}

export const createPopupServices = (): PopupServices => {
  const repositories = createLocalRepositories();
  const session = createSessionRepositories();
  const vault = createTokenVault({
    security: repositories.security,
    session,
    getFingerprint: async () =>
      computeFingerprint(await collectFingerprintSources(navigator, getExtensionId())),
  });
  const vaultState = createVaultStateStore(vault, [
    repositories.security.subscribe,
    session.vaultKey.subscribe,
  ]);
  const meta = createPersistedStore(repositories.meta);
  const settings = createPersistedStore(repositories.settings);
  const ui = createPersistedStore(repositories.ui);

  const settingsServices: SettingsServices = {
    settings,
    ui,
    cache: repositories.cache,
    polling: repositories.polling,
    vault,
    vaultState,
    testConnection: (host, token) => fetchViewer({ host, getToken: () => Promise.resolve(token) }),
    requestOriginPermission,
    releaseOriginPermission,
    openTab,
    sendMessage,
    extensionVersion: getExtensionVersion(),
  };

  const dashboardServices: DashboardServices = {
    settings,
    ui,
    cache: repositories.cache,
    polling: repositories.polling,
    openTab,
    sendMessage,
  };

  return {
    settingsServices,
    dashboardServices,
    repositories,
    session,
    vault,
    vaultState,
    meta,
    settings,
    ui,
    credentials: navigator.credentials,
    isBiometricAvailable: isPlatformAuthenticatorAvailable,
    notifyUnlockChanged: () => {
      void sendMessage({ type: 'unlock-changed' });
    },
    initialize: async () => {
      await runMigrations(createStorageArea<LocalKey>('local'));
      await Promise.all([meta.hydrate(), settings.hydrate(), ui.hydrate(), vaultState.refresh()]);
    },
  };
};
