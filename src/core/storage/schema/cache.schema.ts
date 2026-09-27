import type { PullRequest } from '@core/github';

import { asRecord, isRecord, readArray, readBoolean, readRecordOf } from '../validate';

export interface CacheEntry {
  fetchedAt: string;
  pullRequests: PullRequest[];
  truncated: boolean;
}

export interface CacheRecord {
  entries: Record<string, CacheEntry>;
}

export const DEFAULT_CACHE: CacheRecord = { entries: {} };

export const cacheKey = (hostKey: string, sourceId: string): string => `${hostKey}|${sourceId}`;

const parsePullRequest = (value: unknown): PullRequest | null =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.nodeId === 'string' &&
  typeof value.number === 'number' &&
  typeof value.title === 'string' &&
  typeof value.htmlUrl === 'string' &&
  isRecord(value.repository) &&
  Array.isArray(value.labels) &&
  Array.isArray(value.requestedReviewers) &&
  Array.isArray(value.latestReviews)
    ? (value as unknown as PullRequest)
    : null;

const parseEntry = (value: unknown): CacheEntry | null => {
  const record = asRecord(value);
  return typeof record.fetchedAt === 'string'
    ? {
        fetchedAt: record.fetchedAt,
        pullRequests: readArray(record.pullRequests, parsePullRequest),
        truncated: readBoolean(record.truncated, false),
      }
    : null;
};

export const parseCache = (value: unknown): CacheRecord => ({
  entries: readRecordOf(asRecord(value).entries, parseEntry),
});
