import { formatClockTime } from '@shared/utils';

import {
  GithubApiError,
  GithubGraphqlError,
  GithubNetworkError,
  GithubRateLimitError,
  GithubSecondaryRateLimitError,
  GithubTimeoutError,
  GithubUnauthorizedError,
} from './errors';

export type GithubErrorKind =
  'unauthorized' | 'rate-limited' | 'network' | 'timeout' | 'api' | 'unknown';

export interface GithubErrorSummary {
  kind: GithubErrorKind;
  message: string;
  retryAt: Date | null;
}

export const describeGithubError = (error: unknown, now: Date = new Date()): GithubErrorSummary => {
  if (error instanceof GithubUnauthorizedError) {
    return {
      kind: 'unauthorized',
      message: 'GitHub rejected the token (expired, revoked or mistyped).',
      retryAt: null,
    };
  }
  if (error instanceof GithubRateLimitError) {
    return {
      kind: 'rate-limited',
      message: `Rate limited by GitHub, resuming at ${formatClockTime(error.resetAt)}.`,
      retryAt: error.resetAt,
    };
  }
  if (error instanceof GithubSecondaryRateLimitError) {
    const retryAt = new Date(now.getTime() + error.retryAfterSeconds * 1000);
    return {
      kind: 'rate-limited',
      message: `GitHub asked us to slow down, resuming at ${formatClockTime(retryAt)}.`,
      retryAt,
    };
  }
  if (error instanceof GithubTimeoutError) {
    return { kind: 'timeout', message: 'GitHub took too long to respond.', retryAt: null };
  }
  if (error instanceof GithubNetworkError) {
    return {
      kind: 'network',
      message:
        'Could not reach GitHub. Check your connection (and host permission for Enterprise).',
      retryAt: null,
    };
  }
  if (error instanceof GithubApiError) {
    const hint =
      error.status === 404
        ? ' (not found, or the token has no access)'
        : error.status === 403
          ? ' (the token lacks a required permission)'
          : '';
    return { kind: 'api', message: `GitHub returned HTTP ${error.status}${hint}.`, retryAt: null };
  }
  if (error instanceof GithubGraphqlError) {
    return { kind: 'api', message: 'GitHub could not answer the query.', retryAt: null };
  }
  return { kind: 'unknown', message: 'Unexpected error while talking to GitHub.', retryAt: null };
};
