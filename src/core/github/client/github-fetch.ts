import {
  GithubApiError,
  GithubNetworkError,
  GithubRateLimitError,
  GithubSecondaryRateLimitError,
  GithubTimeoutError,
  GithubUnauthorizedError,
} from './errors';
import {
  DEFAULT_SECONDARY_RETRY_SECONDS,
  readRateLimit,
  readRetryAfterSeconds,
  type RateLimitSnapshot,
} from './rate-limit';

export const DEFAULT_TIMEOUT_MILLISECONDS = 30_000;
const BODY_SNIPPET_LENGTH = 200;

export interface GithubFetchInit {
  method?: 'GET' | 'POST';
  body?: unknown;
  etag?: string | null;
  timeoutMilliseconds?: number;
  accept?: string;
}

export type GithubResponse<TData> =
  | {
      notModified: false;
      data: TData;
      etag: string | null;
      link: string | null;
      scopes: string | null;
      rateLimit: RateLimitSnapshot | null;
    }
  | { notModified: true; etag: string | null; rateLimit: RateLimitSnapshot | null };

export const resolveApiUrl = (apiBaseUrl: string, pathOrUrl: string): URL => {
  const base = new URL(apiBaseUrl);
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const absolute = new URL(pathOrUrl);
    if (absolute.origin !== base.origin) {
      throw new Error('Refusing to send the token to a different origin');
    }
    return absolute;
  }
  const basePath = base.pathname.replace(/\/$/, '');
  return new URL(`${basePath}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`, base.origin);
};

const readBodySnippet = async (response: Response): Promise<string> => {
  try {
    return (await response.text()).slice(0, BODY_SNIPPET_LENGTH);
  } catch {
    return '';
  }
};

export const githubFetch = async <TData>(
  apiBaseUrl: string,
  token: string,
  pathOrUrl: string,
  init: GithubFetchInit = {},
): Promise<GithubResponse<TData>> => {
  const url = resolveApiUrl(apiBaseUrl, pathOrUrl);
  const method = init.method ?? 'GET';
  const requestLabel = `${method} ${url.pathname}`;
  const timeoutMilliseconds = init.timeoutMilliseconds ?? DEFAULT_TIMEOUT_MILLISECONDS;

  const headers = new Headers({
    Accept: init.accept ?? 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  });
  if (init.etag !== undefined && init.etag !== null) {
    headers.set('If-None-Match', init.etag);
  }
  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMilliseconds);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  } catch {
    throw controller.signal.aborted
      ? new GithubTimeoutError(timeoutMilliseconds, requestLabel)
      : new GithubNetworkError(requestLabel);
  } finally {
    clearTimeout(timer);
  }

  const rateLimit = readRateLimit(response.headers);
  const etag = response.headers.get('etag');

  if (response.status === 304) {
    return { notModified: true, etag: etag ?? init.etag ?? null, rateLimit };
  }
  if (response.ok) {
    let data: TData;
    try {
      data = (await response.json()) as TData;
    } catch {
      throw new GithubApiError(response.status, 'Invalid JSON body', requestLabel);
    }
    return {
      notModified: false,
      data,
      etag,
      link: response.headers.get('link'),
      scopes: response.headers.get('x-oauth-scopes'),
      rateLimit,
    };
  }

  const bodySnippet = await readBodySnippet(response);
  if (response.status === 401) {
    throw new GithubUnauthorizedError(401, bodySnippet, requestLabel);
  }
  if (response.status === 403 || response.status === 429) {
    const retryAfter = readRetryAfterSeconds(response.headers, new Date());
    if (retryAfter !== null) {
      throw new GithubSecondaryRateLimitError(retryAfter);
    }
    if (rateLimit?.remaining === 0) {
      throw new GithubRateLimitError(rateLimit.resetAt);
    }
    if (/secondary rate limit|abuse/i.test(bodySnippet)) {
      throw new GithubSecondaryRateLimitError(DEFAULT_SECONDARY_RETRY_SECONDS);
    }
  }
  throw new GithubApiError(response.status, bodySnippet, requestLabel);
};
