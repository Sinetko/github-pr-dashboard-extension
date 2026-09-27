import { githubFetch, type GithubFetchInit } from './github-fetch';

import type { RateLimitSnapshot } from './rate-limit';

export const DEFAULT_PAGE_CAP = 20;

export const parseLinkHeader = (header: string | null): Partial<Record<string, string>> => {
  if (header === null) {
    return {};
  }
  const links: Partial<Record<string, string>> = {};
  for (const part of header.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="?([^";]+)"?/.exec(part.trim());
    const [, url, rels] = match ?? [];
    if (url !== undefined && rels !== undefined) {
      for (const rel of rels.split(/\s+/)) {
        links[rel] = url;
      }
    }
  }
  return links;
};

export type PagedResult<TItem> =
  | {
      notModified: false;
      items: TItem[];
      etag: string | null;
      truncated: boolean;
      rateLimit: RateLimitSnapshot | null;
    }
  | { notModified: true; etag: string | null; rateLimit: RateLimitSnapshot | null };

export const fetchAllPages = async <TItem>(
  apiBaseUrl: string,
  token: string,
  firstPath: string,
  { etag, pageCap = DEFAULT_PAGE_CAP, ...init }: GithubFetchInit & { pageCap?: number } = {},
): Promise<PagedResult<TItem>> => {
  const first = await githubFetch<TItem[]>(apiBaseUrl, token, firstPath, {
    ...init,
    etag: etag ?? null,
  });
  if (first.notModified) {
    return first;
  }
  const items: TItem[] = [...first.data];
  let next = parseLinkHeader(first.link).next;
  let rateLimit = first.rateLimit;
  let pages = 1;
  while (next !== undefined && pages < pageCap) {
    const page = await githubFetch<TItem[]>(apiBaseUrl, token, next, init);
    if (page.notModified) {
      break;
    }
    items.push(...page.data);
    rateLimit = page.rateLimit ?? rateLimit;
    next = parseLinkHeader(page.link).next;
    pages += 1;
  }
  return { notModified: false, items, etag: first.etag, truncated: next !== undefined, rateLimit };
};
