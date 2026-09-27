import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFetchFake, type FetchFake } from '@test/fetch-fake';

import {
  fetchAllPages,
  GithubApiError,
  githubFetch,
  GithubGraphqlError,
  githubGraphql,
  GithubNetworkError,
  GithubRateLimitError,
  GithubSecondaryRateLimitError,
  GithubTimeoutError,
  GithubUnauthorizedError,
  parseLinkHeader,
  readRateLimit,
  readRetryAfterSeconds,
  resolveApiUrl,
} from '.';
import { linkHeader, RATE_LIMIT_HEADERS } from '../__fixtures__/rest.fixture';

const API = 'https://api.github.com';
const TOKEN = 'ghp_SECRETsecretSECRETsecret0123456789';
let http: FetchFake;

beforeEach(() => {
  http = installFetchFake();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const expectTokenAbsent = (error: unknown): void => {
  expect(error).toBeInstanceOf(Error);
  const serialized = `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ''}`;
  expect(serialized).not.toContain(TOKEN);
};

describe('resolveApiUrl', () => {
  it('joins paths onto github.com and GHES base paths', () => {
    expect(resolveApiUrl(API, '/user').href).toBe('https://api.github.com/user');
    expect(resolveApiUrl('https://ghe.example.com/api/v3', '/user').href).toBe(
      'https://ghe.example.com/api/v3/user',
    );
    expect(resolveApiUrl('https://ghe.example.com/api/v3/', 'user').href).toBe(
      'https://ghe.example.com/api/v3/user',
    );
  });

  it('accepts same-origin absolute URLs and refuses others (token must not leak)', () => {
    expect(resolveApiUrl(API, 'https://api.github.com/x?page=2').search).toBe('?page=2');
    expect(() => resolveApiUrl(API, 'https://evil.example.com/steal')).toThrow('different origin');
  });
});

describe('githubFetch', () => {
  it('sends auth, API version and conditional headers, returns metadata', async () => {
    http.get('/user', {
      body: { login: 'mona' },
      headers: {
        etag: 'W/"abc"',
        'x-oauth-scopes': 'repo, read:org',
        link: '<x>; rel="next"',
        ...RATE_LIMIT_HEADERS,
      },
    });
    const response = await githubFetch<{ login: string }>(API, TOKEN, '/user', { etag: 'W/"old"' });
    const [request] = http.requests;
    expect(request?.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(request?.headers.get('x-github-api-version')).toBe('2022-11-28');
    expect(request?.headers.get('if-none-match')).toBe('W/"old"');
    expect(response).toMatchObject({
      notModified: false,
      data: { login: 'mona' },
      etag: 'W/"abc"',
      scopes: 'repo, read:org',
      link: '<x>; rel="next"',
      rateLimit: { limit: 5000, remaining: 4987 },
    });
  });

  it('returns notModified for 304, keeping the previous etag when none is echoed', async () => {
    http.get(
      '/repos/o/r/pulls',
      { status: 304, headers: RATE_LIMIT_HEADERS },
      { status: 304, headers: { etag: 'W/"new"' } },
    );
    expect(await githubFetch(API, TOKEN, '/repos/o/r/pulls', { etag: 'W/"old"' })).toMatchObject({
      notModified: true,
      etag: 'W/"old"',
    });
    expect(await githubFetch(API, TOKEN, '/repos/o/r/pulls')).toMatchObject({
      notModified: true,
      etag: 'W/"new"',
    });
  });

  it('POSTs JSON bodies', async () => {
    http.post('/graphql', { body: { data: {} } });
    await githubFetch(API, TOKEN, '/graphql', { method: 'POST', body: { query: '{x}' } });
    expect(http.requests[0]?.body).toEqual({ query: '{x}' });
    expect(http.requests[0]?.headers.get('content-type')).toBe('application/json');
  });

  it('maps 401 to GithubUnauthorizedError without leaking the token', async () => {
    http.get('/user', { status: 401, body: { message: 'Bad credentials' } });
    const error = await githubFetch(API, TOKEN, '/user').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GithubUnauthorizedError);
    expect(error).toBeInstanceOf(GithubApiError);
    expectTokenAbsent(error);
  });

  it('maps exhausted primary rate limit to GithubRateLimitError with reset time', async () => {
    http.get('/user', {
      status: 403,
      body: { message: 'API rate limit exceeded' },
      headers: { ...RATE_LIMIT_HEADERS, 'x-ratelimit-remaining': '0' },
    });
    const error = await githubFetch(API, TOKEN, '/user').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GithubRateLimitError);
    expect((error as GithubRateLimitError).resetAt.getTime()).toBe(1768240000 * 1000);
  });

  it('maps Retry-After (403 or 429) and body-only secondary limits', async () => {
    http.get('/a', { status: 403, headers: { 'retry-after': '90' } });
    http.get('/b', { status: 429, headers: { 'retry-after': '5' } });
    http.get('/c', { status: 403, body: { message: 'You have exceeded a secondary rate limit.' } });
    const errors = await Promise.all(
      ['/a', '/b', '/c'].map((path) =>
        githubFetch(API, TOKEN, path).catch((caught: unknown) => caught),
      ),
    );
    expect(
      errors.map((error) => (error as GithubSecondaryRateLimitError).retryAfterSeconds),
    ).toEqual([90, 5, 60]);
    for (const error of errors) {
      expect(error).toBeInstanceOf(GithubSecondaryRateLimitError);
    }
  });

  it('maps other failures to GithubApiError with a truncated body', async () => {
    http.get('/repos/o/r', { status: 404, text: 'x'.repeat(5000) });
    http.get('/plain-403', {
      status: 403,
      body: { message: 'Resource not accessible by personal access token' },
    });
    const notFound = (await githubFetch(API, TOKEN, '/repos/o/r').catch(
      (caught: unknown) => caught,
    )) as GithubApiError;
    expect(notFound).toBeInstanceOf(GithubApiError);
    expect(notFound.status).toBe(404);
    expect(notFound.bodySnippet).toHaveLength(200);
    expect(notFound.message).toBe('GitHub API 404 for GET /repos/o/r');
    const forbidden = (await githubFetch(API, TOKEN, '/plain-403').catch(
      (caught: unknown) => caught,
    )) as GithubApiError;
    expect(forbidden.status).toBe(403);
  });

  it('rejects invalid JSON bodies as GithubApiError', async () => {
    http.get('/user', { text: '<html>proxy error</html>' });
    await expect(githubFetch(API, TOKEN, '/user')).rejects.toBeInstanceOf(GithubApiError);
  });

  it('maps fetch rejections to GithubNetworkError, dropping the underlying message', async () => {
    http.fetch.mockRejectedValueOnce(new TypeError(`Failed to fetch with ${TOKEN}`));
    const error = await githubFetch(API, TOKEN, '/user').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GithubNetworkError);
    expectTokenAbsent(error);
  });

  it('times out via AbortController', async () => {
    vi.useFakeTimers();
    http.fetch.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const pending = githubFetch(API, TOKEN, '/user', { timeoutMilliseconds: 1000 }).catch(
      (caught: unknown) => caught,
    );
    await vi.advanceTimersByTimeAsync(1000);
    const error = await pending;
    expect(error).toBeInstanceOf(GithubTimeoutError);
    expect((error as GithubTimeoutError).timeoutMilliseconds).toBe(1000);
  });
});

describe('rate limit headers', () => {
  it('parses complete headers only', () => {
    expect(readRateLimit(new Headers(RATE_LIMIT_HEADERS))?.remaining).toBe(4987);
    expect(readRateLimit(new Headers({ 'x-ratelimit-remaining': '1' }))).toBeNull();
    expect(
      readRateLimit(new Headers({ ...RATE_LIMIT_HEADERS, 'x-ratelimit-limit': 'abc' })),
    ).toBeNull();
  });

  it('parses Retry-After seconds or HTTP dates', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(readRetryAfterSeconds(new Headers({ 'retry-after': '30' }), now)).toBe(30);
    expect(
      readRetryAfterSeconds(new Headers({ 'retry-after': 'Thu, 01 Jan 2026 00:01:00 GMT' }), now),
    ).toBe(60);
    expect(readRetryAfterSeconds(new Headers({ 'retry-after': 'soon' }), now)).toBeNull();
    expect(readRetryAfterSeconds(new Headers(), now)).toBeNull();
  });
});

describe('pagination', () => {
  const base = `${API}/repos/o/r/pulls?per_page=100`;

  it('parses Link headers', () => {
    expect(parseLinkHeader(linkHeader(base, 1, 3))).toEqual({
      next: `${base}&page=2`,
      last: `${base}&page=3`,
    });
    expect(parseLinkHeader('<a>; rel="prev first"')).toEqual({ prev: 'a', first: 'a' });
    expect(parseLinkHeader('garbage')).toEqual({});
    expect(parseLinkHeader(null)).toEqual({});
  });

  it('follows next links and returns the first-page etag', async () => {
    http.always('GET', '/repos/o/r/pulls', (request) => {
      const page = Number(request.url.searchParams.get('page') ?? '1');
      return {
        body: [page * 10, page * 10 + 1],
        headers: { link: linkHeader(base, page, 3), etag: `W/"p${page}"` },
      };
    });
    const result = await fetchAllPages<number>(API, TOKEN, '/repos/o/r/pulls?per_page=100');
    expect(result).toMatchObject({
      notModified: false,
      items: [10, 11, 20, 21, 30, 31],
      etag: 'W/"p1"',
      truncated: false,
    });
    expect(http.requests).toHaveLength(3);
  });

  it('stops at the page cap and flags truncation', async () => {
    http.always('GET', '/repos/o/r/pulls', (request) => {
      const page = Number(request.url.searchParams.get('page') ?? '1');
      return { body: [page], headers: { link: linkHeader(base, page, 999) } };
    });
    const result = await fetchAllPages<number>(API, TOKEN, '/repos/o/r/pulls?per_page=100', {
      pageCap: 4,
    });
    expect(result).toMatchObject({ items: [1, 2, 3, 4], truncated: true });
  });

  it('short-circuits on a first-page 304', async () => {
    http.get('/repos/o/r/pulls', { status: 304 });
    expect(await fetchAllPages(API, TOKEN, '/repos/o/r/pulls', { etag: 'W/"x"' })).toMatchObject({
      notModified: true,
      etag: 'W/"x"',
    });
  });

  it('stops quietly if a later page answers 304', async () => {
    http.get(
      '/repos/o/r/pulls',
      { body: [1], headers: { link: linkHeader(base, 1, 2) } },
      { status: 304 },
    );
    expect(await fetchAllPages<number>(API, TOKEN, '/repos/o/r/pulls')).toMatchObject({
      items: [1],
    });
  });
});

describe('githubGraphql', () => {
  const URL_GRAPHQL = `${API}/graphql`;

  it('returns data with partial errors', async () => {
    http.post('/graphql', {
      body: {
        data: { nodes: [null] },
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve to a node' }],
      },
    });
    const result = await githubGraphql<{ nodes: null[] }>(URL_GRAPHQL, TOKEN, 'query', {
      ids: ['x'],
    });
    expect(result).toEqual({
      data: { nodes: [null] },
      partialErrors: ['Could not resolve to a node'],
    });
    expect(http.requests[0]?.body).toEqual({ query: 'query', variables: { ids: ['x'] } });
  });

  it('throws GithubGraphqlError without data, and GithubRateLimitError when rate limited', async () => {
    http.post(
      '/graphql',
      { body: { errors: [{ message: 'Parse error' }] } },
      {
        body: {
          data: null,
          errors: [{ type: 'RATE_LIMITED', message: 'API rate limit exceeded' }],
        },
        headers: RATE_LIMIT_HEADERS,
      },
      { body: { data: null, errors: [{ type: 'RATE_LIMITED', message: 'x' }] } },
      { status: 304 },
    );
    await expect(githubGraphql(URL_GRAPHQL, TOKEN, 'q', {})).rejects.toBeInstanceOf(
      GithubGraphqlError,
    );
    const limited = (await githubGraphql(URL_GRAPHQL, TOKEN, 'q', {}).catch(
      (caught: unknown) => caught,
    )) as GithubRateLimitError;
    expect(limited.resetAt.getTime()).toBe(1768240000 * 1000);
    await expect(githubGraphql(URL_GRAPHQL, TOKEN, 'q', {})).rejects.toBeInstanceOf(
      GithubRateLimitError,
    );
    await expect(githubGraphql(URL_GRAPHQL, TOKEN, 'q', {})).rejects.toBeInstanceOf(
      GithubGraphqlError,
    );
  });
});
