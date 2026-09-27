import type { PullRequest } from '@core/github';

let sequence = 0;

export const buildPullRequest = (overrides: Partial<PullRequest> = {}): PullRequest => {
  sequence += 1;
  const number = overrides.number ?? sequence;
  return {
    id: `github.com:octo-org/hello-world#${number}`,
    nodeId: `PR_${number}`,
    repository: { owner: 'octo-org', name: 'hello-world' },
    number,
    title: `Change number ${number}`,
    htmlUrl: `https://github.com/octo-org/hello-world/pull/${number}`,
    author: { login: 'mona', avatarUrl: '' },
    state: 'open',
    isDraftNative: false,
    createdAt: '2026-01-18T00:00:00Z',
    updatedAt: '2026-01-19T00:00:00Z',
    lastActivityAt: '2026-01-19T00:00:00Z',
    headRefOid: 'head1',
    baseRefName: 'main',
    labels: [],
    requestedReviewers: [],
    latestReviews: [],
    lastReview: null,
    lastComment: null,
    requiredApprovals: null,
    checks: 'success',
    mergeability: 'mergeable',
    mergeState: 'clean',
    commentCount: 0,
    reviewCount: 0,
    unresolvedThreadCount: 0,
    ...overrides,
  };
};
