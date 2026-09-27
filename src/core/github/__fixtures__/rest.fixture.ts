import type { RestPullRequestListItem } from '../rest/rest.types';

export const buildRestPullRequest = (
  number: number,
  updatedAt = '2026-01-12T16:30:00Z',
): RestPullRequestListItem => ({
  number,
  node_id: `PR_node_${number}`,
  state: 'open',
  draft: false,
  title: `PR ${number}`,
  updated_at: updatedAt,
});

export const RATE_LIMIT_HEADERS = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4987',
  'x-ratelimit-reset': '1768240000',
};

export const linkHeader = (base: string, page: number, last: number): string =>
  [
    page < last ? `<${base}&page=${page + 1}>; rel="next"` : null,
    `<${base}&page=${last}>; rel="last"`,
  ]
    .filter((part) => part !== null)
    .join(', ');
