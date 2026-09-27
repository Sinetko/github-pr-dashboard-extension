import type { TeamRef } from '@core/github';

import {
  asRecord,
  isRecord,
  readArray,
  readInteger,
  readNullableString,
  readRecordOf,
  readString,
} from '../validate';

export const POLL_ERROR_KINDS = [
  'unauthorized',
  'rate-limited',
  'network',
  'timeout',
  'api',
  'locked',
  'unknown',
] as const;
export type PollErrorKind = (typeof POLL_ERROR_KINDS)[number];

export interface PollError {
  kind: PollErrorKind;
  message: string;
  at: string;
}

export interface SourcePollState {
  etag: string | null;
  lastFullFetchAt: string | null;
  lastFetchAt: string | null;
  cyclesSinceFull: number;
  lastError: PollError | null;
}

export interface CachedValue<TValue> {
  value: TValue;
  fetchedAt: string;
}

export interface PollingRecord {
  hostKey: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastError: PollError | null;
  rateLimitedUntil: string | null;
  sources: Record<string, SourcePollState>;
  viewer: CachedValue<{ login: string; avatarUrl: string }> | null;
  viewerTeams: CachedValue<TeamRef[] | null> | null;
  requiredApprovals: Record<string, CachedValue<number | null>>;
  notified: Record<string, string>;
}

export const DEFAULT_POLLING: PollingRecord = {
  hostKey: null,
  lastRunAt: null,
  lastSuccessAt: null,
  consecutiveFailures: 0,
  lastError: null,
  rateLimitedUntil: null,
  sources: {},
  viewer: null,
  viewerTeams: null,
  requiredApprovals: {},
  notified: {},
};

export const parsePollError = (value: unknown): PollError | null => {
  const record = asRecord(value);
  const kind = POLL_ERROR_KINDS.find((candidate) => candidate === record.kind);
  return kind === undefined || typeof record.message !== 'string'
    ? null
    : { kind, message: record.message.slice(0, 300), at: readString(record.at, '') };
};

const parseSourceState = (value: unknown): SourcePollState | null => {
  if (!isRecord(value)) {
    return null;
  }
  return {
    etag: readNullableString(value.etag),
    lastFullFetchAt: readNullableString(value.lastFullFetchAt),
    lastFetchAt: readNullableString(value.lastFetchAt),
    cyclesSinceFull: readInteger(value.cyclesSinceFull, 0, { min: 0, max: 1_000_000 }),
    lastError: parsePollError(value.lastError),
  };
};

const parseCached = <TValue>(
  value: unknown,
  parseValue: (raw: unknown) => TValue | undefined,
): CachedValue<TValue> | null => {
  const record = asRecord(value);
  const parsed = parseValue(record.value);
  return parsed === undefined || typeof record.fetchedAt !== 'string'
    ? null
    : { value: parsed, fetchedAt: record.fetchedAt };
};

const parseTeam = (value: unknown): TeamRef | null => {
  const record = asRecord(value);
  return typeof record.organization === 'string' && typeof record.slug === 'string'
    ? { organization: record.organization, slug: record.slug }
    : null;
};

export const parsePolling = (value: unknown): PollingRecord => {
  const record = asRecord(value);
  return {
    hostKey: readNullableString(record.hostKey),
    lastRunAt: readNullableString(record.lastRunAt),
    lastSuccessAt: readNullableString(record.lastSuccessAt),
    consecutiveFailures: readInteger(record.consecutiveFailures, 0, { min: 0, max: 1_000_000 }),
    lastError: parsePollError(record.lastError),
    rateLimitedUntil: readNullableString(record.rateLimitedUntil),
    sources: readRecordOf(record.sources, parseSourceState),
    viewer: parseCached(record.viewer, (raw) => {
      const viewer = asRecord(raw);
      return typeof viewer.login === 'string'
        ? { login: viewer.login, avatarUrl: readString(viewer.avatarUrl, '') }
        : undefined;
    }),
    viewerTeams: parseCached(record.viewerTeams, (raw) =>
      raw === null ? null : Array.isArray(raw) ? readArray(raw, parseTeam) : undefined,
    ),
    requiredApprovals: readRecordOf(record.requiredApprovals, (item) =>
      parseCached(item, (raw) =>
        raw === null
          ? null
          : typeof raw === 'number' && Number.isInteger(raw) && raw >= 0
            ? raw
            : undefined,
      ),
    ),
    notified: readRecordOf(record.notified, (item) => (typeof item === 'string' ? item : null)),
  };
};
