import type { ExtensionMessage } from '@core/chrome/messaging';
import type {
  CacheRecord,
  PersistedStore,
  PollingRecord,
  Repository,
  SettingsRecord,
  UiRecord,
} from '@core/storage';

export interface DashboardServices {
  settings: PersistedStore<SettingsRecord>;
  ui: PersistedStore<UiRecord>;
  cache: Pick<Repository<CacheRecord>, 'read' | 'subscribe'>;
  polling: Pick<Repository<PollingRecord>, 'read' | 'subscribe'>;
  openTab: (url: string) => Promise<void>;
  sendMessage: (message: ExtensionMessage) => Promise<boolean>;
}
