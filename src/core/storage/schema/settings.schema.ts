import { isSoundId, type SoundId } from '@core/audio';
import {
  GITHUB_DOT_COM,
  parseEnterpriseHost,
  parseRepositorySource,
  type GithubHost,
  type TokenKind,
} from '@core/github';
import type { ThemePreference } from '@shared/theme';

import { asRecord, readArray, readBoolean, readEnum, readInteger, readString } from '../validate';

export const NOTIFICATION_TYPES = [
  'review-requested',
  'review-received',
  'checks-failed',
  'merge-conflict',
  'new-comment',
  'pr-closed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface RepositorySourceConfig {
  id: string;
  kind: 'repository';
  owner: string;
  name: string;
}
export interface SearchSourceConfig {
  id: string;
  kind: 'search';
  label: string;
  query: string;
}
export type SourceConfig = RepositorySourceConfig | SearchSourceConfig;

export const repositorySourceId = (owner: string, name: string): string =>
  `repo:${owner.toLowerCase()}/${name.toLowerCase()}`;
export const searchSourceId = (query: string): string =>
  `search:${query.trim().replace(/\s+/g, ' ')}`;

export interface NotificationSettings {
  enabled: boolean;
  types: Record<NotificationType, boolean>;
  sound: SoundId | null;
}

export interface SettingsRecord {
  host: GithubHost;
  tokenKind: TokenKind;
  sources: SourceConfig[];
  activeSourceId: string | null;
  pollIntervalMinutes: number;
  staleThresholdDays: number;
  theme: ThemePreference;
  notifications: NotificationSettings;
}

export const POLL_INTERVAL_LIMITS = { min: 1, max: 60 } as const;
export const STALE_THRESHOLD_LIMITS = { min: 1, max: 90 } as const;
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
  'dimmed',
  'high-contrast-dark',
];
const TOKEN_KINDS: readonly TokenKind[] = ['classic', 'fine-grained'];

export const DEFAULT_SETTINGS: SettingsRecord = {
  host: GITHUB_DOT_COM,
  tokenKind: 'fine-grained',
  sources: [],
  activeSourceId: null,
  pollIntervalMinutes: 5,
  staleThresholdDays: 5,
  theme: 'system',
  notifications: {
    enabled: true,
    types: {
      'review-requested': true,
      'review-received': true,
      'checks-failed': true,
      'merge-conflict': true,
      'new-comment': false,
      'pr-closed': false,
    },
    sound: 'chime',
  },
};

const parseHost = (value: unknown): GithubHost => {
  const record = asRecord(value);
  if (record.kind === 'enterprise' && typeof record.origin === 'string') {
    return parseEnterpriseHost(record.origin) ?? GITHUB_DOT_COM;
  }
  return GITHUB_DOT_COM;
};

const parseSource = (value: unknown): SourceConfig | null => {
  const record = asRecord(value);
  if (
    record.kind === 'repository' &&
    typeof record.owner === 'string' &&
    typeof record.name === 'string'
  ) {
    const repository = parseRepositorySource(`${record.owner}/${record.name}`);
    return repository === null
      ? null
      : {
          id: repositorySourceId(repository.owner, repository.name),
          kind: 'repository',
          ...repository,
        };
  }
  if (record.kind === 'search' && typeof record.query === 'string' && record.query.trim() !== '') {
    const query = record.query.trim();
    return {
      id: searchSourceId(query),
      kind: 'search',
      label: readString(record.label, query),
      query,
    };
  }
  return null;
};

const parseNotifications = (value: unknown): NotificationSettings => {
  const record = asRecord(value);
  const types = asRecord(record.types);
  const defaults = DEFAULT_SETTINGS.notifications;
  return {
    enabled: readBoolean(record.enabled, defaults.enabled),
    types: Object.fromEntries(
      NOTIFICATION_TYPES.map((type) => [type, readBoolean(types[type], defaults.types[type])]),
    ) as Record<NotificationType, boolean>,
    sound: record.sound === null ? null : isSoundId(record.sound) ? record.sound : defaults.sound,
  };
};

export const parseSettings = (value: unknown): SettingsRecord => {
  const record = asRecord(value);
  const unique = new Map<string, SourceConfig>();
  for (const source of readArray(record.sources, parseSource)) {
    if (!unique.has(source.id)) {
      unique.set(source.id, source);
    }
  }
  const sources = [...unique.values()];
  const activeSourceId =
    typeof record.activeSourceId === 'string' && unique.has(record.activeSourceId)
      ? record.activeSourceId
      : (sources[0]?.id ?? null);
  return {
    host: parseHost(record.host),
    tokenKind: readEnum(record.tokenKind, TOKEN_KINDS, DEFAULT_SETTINGS.tokenKind),
    sources,
    activeSourceId,
    pollIntervalMinutes: readInteger(
      record.pollIntervalMinutes,
      DEFAULT_SETTINGS.pollIntervalMinutes,
      POLL_INTERVAL_LIMITS,
    ),
    staleThresholdDays: readInteger(
      record.staleThresholdDays,
      DEFAULT_SETTINGS.staleThresholdDays,
      STALE_THRESHOLD_LIMITS,
    ),
    theme: readEnum(record.theme, THEME_PREFERENCES, DEFAULT_SETTINGS.theme),
    notifications: parseNotifications(record.notifications),
  };
};
