import type { ExtensionMessage } from '@core/chrome/messaging';
import type { GithubHost, Viewer } from '@core/github';
import type { TokenVault, VaultStateStore } from '@core/security';
import type {
  CacheRecord,
  PersistedStore,
  PollingRecord,
  Repository,
  SettingsRecord,
  UiRecord,
} from '@core/storage';

export interface SettingsServices {
  settings: PersistedStore<SettingsRecord>;
  ui: PersistedStore<UiRecord>;
  cache: Repository<CacheRecord>;
  polling: Repository<PollingRecord>;
  vault: Pick<
    TokenVault,
    'saveToken' | 'readToken' | 'saveTokenDraft' | 'readTokenDraft' | 'clearTokenDraft'
  >;
  vaultState: VaultStateStore;
  testConnection: (host: GithubHost, token: string) => Promise<Viewer>;
  requestOriginPermission: (originPattern: string) => Promise<boolean>;
  releaseOriginPermission: (originPattern: string) => Promise<boolean>;
  openTab: (url: string) => Promise<void>;
  sendMessage: (message: ExtensionMessage) => Promise<boolean>;
  extensionVersion: string;
}
