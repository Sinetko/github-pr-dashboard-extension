import type { CacheEntry, PollError, PollingRecord, SourcePollState } from '@core/storage';
import { formatClockTime, formatRelativeTime } from '@shared/utils';

export const ERROR_BADGE_THRESHOLD = 3;

export type DashboardStatus =
  | { kind: 'ok' }
  | { kind: 'loading' }
  | { kind: 'rate-limited'; resumeAt: string }
  | { kind: 'token-invalid' }
  | { kind: 'error'; message: string; hasCache: boolean; cachedAt: string | null }
  | { kind: 'truncated' };

const latestError = (
  sourceState: SourcePollState | undefined,
  polling: PollingRecord,
): PollError | null => sourceState?.lastError ?? polling.lastError;

export const resolveDashboardStatus = ({
  entry,
  sourceState,
  polling,
  now,
}: {
  entry: CacheEntry | undefined;
  sourceState: SourcePollState | undefined;
  polling: PollingRecord;
  now: Date;
}): DashboardStatus => {
  const rateLimitedUntil =
    polling.rateLimitedUntil === null ? Number.NaN : Date.parse(polling.rateLimitedUntil);
  if (!Number.isNaN(rateLimitedUntil) && rateLimitedUntil > now.getTime()) {
    return { kind: 'rate-limited', resumeAt: formatClockTime(new Date(rateLimitedUntil)) };
  }
  const error = latestError(sourceState, polling);
  if (error?.kind === 'unauthorized') {
    return { kind: 'token-invalid' };
  }
  if (
    error !== null &&
    (sourceState?.lastError != null || polling.consecutiveFailures >= ERROR_BADGE_THRESHOLD)
  ) {
    return {
      kind: 'error',
      message: error.message,
      hasCache: entry !== undefined,
      cachedAt: entry === undefined ? null : formatRelativeTime(entry.fetchedAt, now),
    };
  }
  if (entry === undefined) {
    return { kind: 'loading' };
  }
  return entry.truncated ? { kind: 'truncated' } : { kind: 'ok' };
};
