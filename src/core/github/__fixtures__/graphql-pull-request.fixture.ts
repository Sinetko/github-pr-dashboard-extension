import type { GraphqlPullRequest, GraphqlReview } from '../graphql/graphql.types';

export const buildGraphqlPullRequest = (
  overrides: Partial<GraphqlPullRequest> = {},
): GraphqlPullRequest => ({
  __typename: 'PullRequest',
  id: 'PR_kwDOAbCdEf5xYz01',
  number: 1347,
  title: 'Add retry-free pagination to the sync worker',
  url: 'https://github.com/octo-org/hello-world/pull/1347',
  isDraft: false,
  state: 'OPEN',
  createdAt: '2026-01-10T09:00:00Z',
  updatedAt: '2026-01-12T16:30:00Z',
  baseRefName: 'main',
  headRefOid: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'BLOCKED',
  author: { login: 'mona', avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4' },
  repository: { name: 'hello-world', owner: { login: 'octo-org' } },
  labels: {
    nodes: [
      { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
      { name: 'backend', color: '0e8a16', description: null },
    ],
  },
  reviewRequests: {
    nodes: [
      { requestedReviewer: { __typename: 'User', login: 'hubot' } },
      {
        requestedReviewer: {
          __typename: 'Team',
          slug: 'platform',
          organization: { login: 'octo-org' },
        },
      },
    ],
  },
  latestOpinionatedReviews: { nodes: [] },
  reviews: { totalCount: 0, nodes: [] },
  comments: { totalCount: 0, nodes: [] },
  commits: {
    nodes: [
      {
        commit: { committedDate: '2026-01-12T16:00:00Z', statusCheckRollup: { state: 'SUCCESS' } },
      },
    ],
  },
  reviewThreads: { totalCount: 0, nodes: [] },
  ...overrides,
});

export const buildGraphqlReview = (overrides: Partial<GraphqlReview> = {}): GraphqlReview => ({
  state: 'APPROVED',
  submittedAt: '2026-01-12T17:00:00Z',
  author: { login: 'hubot' },
  commit: { oid: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' },
  ...overrides,
});
