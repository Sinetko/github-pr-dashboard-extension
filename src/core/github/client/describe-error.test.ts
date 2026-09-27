import { describe, expect, it } from 'vitest';

import { describeGithubError } from './describe-error';
import {
  GithubApiError,
  GithubGraphqlError,
  GithubNetworkError,
  GithubRateLimitError,
  GithubSecondaryRateLimitError,
  GithubTimeoutError,
  GithubUnauthorizedError,
} from './errors';

describe('describeGithubError', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0);

  it('classifies every error type with safe copy', () => {
    expect(
      describeGithubError(new GithubUnauthorizedError(401, 'body-secret', 'GET /user')),
    ).toMatchObject({ kind: 'unauthorized' });
    expect(
      describeGithubError(new GithubRateLimitError(new Date(2026, 0, 1, 14, 5))),
    ).toMatchObject({ kind: 'rate-limited', message: expect.stringContaining('14:05') as string });
    const secondary = describeGithubError(new GithubSecondaryRateLimitError(120), now);
    expect(secondary.retryAt?.getTime()).toBe(now.getTime() + 120_000);
    expect(secondary.message).toContain('12:02');
    expect(describeGithubError(new GithubTimeoutError(30_000, 'x')).kind).toBe('timeout');
    expect(describeGithubError(new GithubNetworkError('x')).kind).toBe('network');
    expect(describeGithubError(new GithubGraphqlError(['x'])).kind).toBe('api');
    expect(describeGithubError('weird').kind).toBe('unknown');
  });

  it('adds hints for 403/404 and never echoes bodies', () => {
    expect(describeGithubError(new GithubApiError(404, 'SECRET', 'GET /x')).message).toBe(
      'GitHub returned HTTP 404 (not found, or the token has no access).',
    );
    expect(describeGithubError(new GithubApiError(403, 'SECRET', 'GET /x')).message).toContain(
      'permission',
    );
    expect(describeGithubError(new GithubApiError(500, 'SECRET', 'GET /x')).message).toBe(
      'GitHub returned HTTP 500.',
    );
  });
});
