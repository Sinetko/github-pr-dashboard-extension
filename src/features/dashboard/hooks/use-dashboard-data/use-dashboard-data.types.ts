import type { TeamRef } from '@core/github';
import type {
  CacheEntry,
  PollingRecord,
  SettingsRecord,
  SourceConfig,
  SourcePollState,
} from '@core/storage';

export interface DashboardData {
  settings: SettingsRecord;
  activeSource: SourceConfig | null;
  entry: CacheEntry | undefined;
  sourceState: SourcePollState | undefined;
  polling: PollingRecord;
  isCacheLoaded: boolean;
  viewerLogin: string | null;
  viewerTeams: readonly TeamRef[] | null;
}
