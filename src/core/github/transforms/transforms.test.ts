import { describe, expect, it } from 'vitest';

import {
  approvalProgress,
  checksStatusFromRollup,
  collectLabels,
  countApprovals,
  countUnresolvedReviewThreads,
  derivePullRequestFlags,
  hasChangesRequested,
  hasMergeConflicts,
  hasReviewedHead,
  isDraft,
  isMergeabilityPending,
  isReviewRequestedFrom,
  isStale,
  isUntouched,
  latestReviewPerReviewer,
  needsMyReview,
  needsReview,
  normalizeLabels,
  reduceRestChecks,
  toMergeability,
  toMergeState,
  toPullRequest,
  toReview,
  toReviewState,
} from '.';
import {
  buildGraphqlPullRequest,
  buildGraphqlReview,
} from '../__fixtures__/graphql-pull-request.fixture';

import type { FlagContext, PullRequest, Review } from '../domain/pull-request.types';

const HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const NOW = new Date('2026-01-20T12:00:00Z');
const pr = (
  overrides: Parameters<typeof buildGraphqlPullRequest>[0] = {},
  required: number | null = null,
): PullRequest => toPullRequest(buildGraphqlPullRequest(overrides), 'github.com', required);
const review = (overrides: Partial<Review> = {}): Review => ({
  login: 'hubot',
  state: 'approved',
  submittedAt: '2026-01-12T17:00:00Z',
  commitOid: HEAD,
  ...overrides,
});
const withPr = (base: PullRequest, overrides: Partial<PullRequest>): PullRequest => ({
  ...base,
  ...overrides,
});

describe('toPullRequest', () => {
  it('normalizes a realistic node into the domain shape', () => {
    const result = pr();
    expect(result).toMatchObject({
      id: 'github.com:octo-org/hello-world#1347',
      nodeId: 'PR_kwDOAbCdEf5xYz01',
      repository: { owner: 'octo-org', name: 'hello-world' },
      state: 'open',
      checks: 'success',
      mergeability: 'mergeable',
      mergeState: 'blocked',
      requestedReviewers: [
        { kind: 'user', login: 'hubot' },
        { kind: 'team', organization: 'octo-org', slug: 'platform' },
      ],
      lastReview: null,
      lastComment: null,
      requiredApprovals: null,
      lastActivityAt: '2026-01-12T16:00:00Z',
    });
    expect(result.labels.map((label) => label.name)).toEqual(['enhancement', 'backend']);
  });

  it('tolerates nulls GitHub may return (ghost author, null connections, bots)', () => {
    const result = toPullRequest(
      buildGraphqlPullRequest({
        author: null,
        state: 'MERGED',
        labels: null,
        reviewRequests: {
          nodes: [null, { requestedReviewer: null }, { requestedReviewer: { __typename: 'Bot' } }],
        },
        latestOpinionatedReviews: null,
        reviews: null,
        commits: { nodes: [] },
        comments: { totalCount: 2, nodes: [null] },
      }),
      'ghe.example.com',
      2,
    );
    expect(result.author).toBeNull();
    expect(result.state).toBe('merged');
    expect(result.labels).toEqual([]);
    expect(result.requestedReviewers).toEqual([]);
    expect(result.reviewCount).toBe(0);
    expect(result.checks).toBe('neutral');
    expect(result.requiredApprovals).toBe(2);
    expect(result.id.startsWith('ghe.example.com:')).toBe(true);
    expect(result.lastActivityAt).toBe('2026-01-10T09:00:00Z');
  });

  it('derives last activity, last review/comment and unresolved threads', () => {
    const result = pr({
      state: 'CLOSED',
      comments: {
        totalCount: 3,
        nodes: [{ createdAt: '2026-01-14T10:00:00Z', author: { login: 'octocat' } }],
      },
      reviews: {
        totalCount: 4,
        nodes: [buildGraphqlReview({ state: 'COMMENTED', submittedAt: '2026-01-15T10:00:00Z' })],
      },
      latestOpinionatedReviews: {
        nodes: [
          buildGraphqlReview(),
          buildGraphqlReview({ state: 'PENDING', author: { login: 'me' } }),
          null,
        ],
      },
      reviewThreads: { totalCount: 3, nodes: [{ isResolved: false }, { isResolved: true }, null] },
    });
    expect(result.state).toBe('closed');
    expect(result.lastActivityAt).toBe('2026-01-15T10:00:00Z');
    expect(result.lastComment).toEqual({ login: 'octocat', createdAt: '2026-01-14T10:00:00Z' });
    expect(result.lastReview?.state).toBe('commented');
    expect(result.latestReviews).toHaveLength(1);
    expect(result.reviewCount).toBe(4);
    expect(result.unresolvedThreadCount).toBe(1);

    const ghostComment = pr({
      comments: { totalCount: 1, nodes: [{ createdAt: 'garbage', author: null }] },
    });
    expect(ghostComment.lastComment).toEqual({ login: null, createdAt: 'garbage' });
  });
});

describe('isDraft', () => {
  it.each([
    [true, 'Anything', true],
    [false, 'WIP: refactor', true],
    [false, '  draft : new api', true],
    [false, 'Draft mode for editor', false],
    [false, 'Fix WIP: label handling', false],
  ])('native=%s title=%j → %s', (isDraftNative, title, expected) => {
    expect(isDraft({ isDraftNative, title })).toBe(expected);
  });
});

describe('checks status', () => {
  it('maps the GraphQL rollup', () => {
    expect(checksStatusFromRollup('SUCCESS')).toBe('success');
    expect(checksStatusFromRollup('FAILURE')).toBe('failure');
    expect(checksStatusFromRollup('ERROR')).toBe('failure');
    expect(checksStatusFromRollup('PENDING')).toBe('pending');
    expect(checksStatusFromRollup('EXPECTED')).toBe('pending');
    expect(checksStatusFromRollup(null)).toBe('neutral');
    expect(checksStatusFromRollup(undefined)).toBe('neutral');
  });

  it('reduces REST check runs + legacy statuses with failure > pending > success > neutral', () => {
    expect(reduceRestChecks([], [])).toBe('neutral');
    expect(reduceRestChecks([{ status: 'completed', conclusion: 'skipped' }], [])).toBe('neutral');
    expect(
      reduceRestChecks([{ status: 'completed', conclusion: 'success' }], [{ state: 'success' }]),
    ).toBe('success');
    expect(reduceRestChecks([], [{ state: 'success' }])).toBe('success');
    expect(
      reduceRestChecks(
        [
          { status: 'in_progress', conclusion: null },
          { status: 'completed', conclusion: 'success' },
        ],
        [],
      ),
    ).toBe('pending');
    expect(reduceRestChecks([], [{ state: 'pending' }])).toBe('pending');
    expect(
      reduceRestChecks(
        [
          { status: 'completed', conclusion: 'timed_out' },
          { status: 'queued', conclusion: null },
        ],
        [],
      ),
    ).toBe('failure');
    expect(reduceRestChecks([{ status: 'completed', conclusion: 'cancelled' }], [])).toBe(
      'failure',
    );
    expect(reduceRestChecks([], [{ state: 'error' }])).toBe('failure');
  });
});

describe('mergeability', () => {
  it('maps every GraphQL value', () => {
    expect(toMergeability('CONFLICTING')).toBe('conflicting');
    expect(toMergeability('UNKNOWN')).toBe('unknown');
    expect(toMergeState('HAS_HOOKS')).toBe('clean');
    expect(toMergeState('CLEAN')).toBe('clean');
    expect(toMergeState('DIRTY')).toBe('dirty');
    expect(toMergeState('DRAFT')).toBe('blocked');
    expect(toMergeState('BEHIND')).toBe('behind');
    expect(toMergeState('UNSTABLE')).toBe('unstable');
    expect(toMergeState('UNKNOWN')).toBe('unknown');
  });

  it('does not treat unknown as conflict-free', () => {
    const unknown = pr({ mergeable: 'UNKNOWN', mergeStateStatus: 'UNKNOWN' });
    expect(hasMergeConflicts(unknown)).toBe(false);
    expect(isMergeabilityPending(unknown)).toBe(true);
    expect(isMergeabilityPending(withPr(unknown, { state: 'merged' }))).toBe(false);
    expect(isMergeabilityPending(pr())).toBe(false);
    expect(hasMergeConflicts(pr({ mergeable: 'CONFLICTING' }))).toBe(true);
    expect(hasMergeConflicts(pr({ mergeStateStatus: 'DIRTY' }))).toBe(true);
  });
});

describe('labels', () => {
  it('trims, dedupes case-insensitively, validates colors and drops empties', () => {
    expect(
      normalizeLabels([
        { name: ' bug ', color: '#D73A4A', description: '  ' },
        { name: 'BUG', color: 'ffffff' },
        { name: '' },
        null,
        undefined,
        { name: 'docs', color: 'not-a-color', description: 'Documentation' },
        { name: 'x', color: null },
      ]),
    ).toEqual([
      { name: 'bug', color: 'd73a4a', description: null },
      { name: 'docs', color: 'ededed', description: 'Documentation' },
      { name: 'x', color: 'ededed', description: null },
    ]);
  });

  it('collects labels across repos, sorted', () => {
    const collected = collectLabels([
      [{ name: 'zeta', color: '000000', description: null }],
      [
        { name: 'Alpha', color: '111111', description: null },
        { name: 'zeta', color: '222222', description: null },
      ],
    ]);
    expect(collected.map((label) => label.name)).toEqual(['Alpha', 'zeta']);
  });
});

describe('reviews', () => {
  it('maps states and skips pending/incomplete reviews', () => {
    expect(toReviewState('CHANGES_REQUESTED')).toBe('changes-requested');
    expect(toReviewState('DISMISSED')).toBe('dismissed');
    expect(toReviewState('PENDING')).toBeNull();
    expect(toReview(null)).toBeNull();
    expect(toReview(buildGraphqlReview({ author: null }))).toBeNull();
    expect(toReview(buildGraphqlReview({ submittedAt: null }))).toBeNull();
    expect(toReview(buildGraphqlReview({ commit: null }))?.commitOid).toBeNull();
  });

  it('keeps the latest verdict per reviewer; comments never override a verdict', () => {
    const latest = latestReviewPerReviewer([
      review({ login: 'Hubot', state: 'changes-requested', submittedAt: '2026-01-10T00:00:00Z' }),
      review({ login: 'hubot', state: 'approved', submittedAt: '2026-01-11T00:00:00Z' }),
      review({ login: 'hubot', state: 'commented', submittedAt: '2026-01-12T00:00:00Z' }),
      review({ login: 'octocat', state: 'commented', submittedAt: '2026-01-10T00:00:00Z' }),
      review({ login: 'octocat', state: 'changes-requested', submittedAt: '2026-01-11T00:00:00Z' }),
      review({ login: 'mona', state: 'approved', submittedAt: '2026-01-11T00:00:00Z' }),
      review({ login: 'mona', state: 'dismissed', submittedAt: '2026-01-12T00:00:00Z' }),
    ]);
    expect(
      Object.fromEntries(latest.map((entry) => [entry.login.toLowerCase(), entry.state])),
    ).toEqual({
      hubot: 'approved',
      octocat: 'changes-requested',
      mona: 'dismissed',
    });
    expect(countApprovals(latest)).toBe(1);
    expect(hasChangesRequested(latest)).toBe(true);
  });

  it('reports approval progress with an optional denominator', () => {
    expect(approvalProgress({ latestReviews: [review()], requiredApprovals: 2 })).toEqual({
      approved: 1,
      required: 2,
    });
    expect(approvalProgress({ latestReviews: [], requiredApprovals: null })).toEqual({
      approved: 0,
      required: null,
    });
  });
});

describe('countUnresolvedReviewThreads', () => {
  it('counts only unresolved, non-null threads', () => {
    expect(countUnresolvedReviewThreads([])).toBe(0);
    expect(
      countUnresolvedReviewThreads([
        { isResolved: false },
        { isResolved: false },
        { isResolved: true },
        null,
      ]),
    ).toBe(2);
  });
});

describe('isStale', () => {
  const base = pr();
  it('compares last activity against the threshold', () => {
    expect(isStale(withPr(base, { lastActivityAt: '2026-01-12T12:00:00Z' }), 7, NOW)).toBe(true);
    expect(isStale(withPr(base, { lastActivityAt: '2026-01-14T12:00:00Z' }), 7, NOW)).toBe(false);
    expect(isStale(withPr(base, { lastActivityAt: '2026-01-19T11:59:00Z' }), 1, NOW)).toBe(true);
  });

  it('is never true for closed PRs, invalid dates or non-positive thresholds', () => {
    const old = withPr(base, { lastActivityAt: '2025-01-01T00:00:00Z' });
    expect(isStale(withPr(old, { state: 'closed' }), 7, NOW)).toBe(false);
    expect(isStale(withPr(old, { lastActivityAt: '' }), 7, NOW)).toBe(false);
    expect(isStale(old, 0, NOW)).toBe(false);
    expect(isStale(old, Number.NaN, NOW)).toBe(false);
  });
});

describe('isUntouched', () => {
  it('requires open, non-draft, no comments, no reviews', () => {
    const base = pr();
    expect(isUntouched(base)).toBe(true);
    expect(isUntouched(withPr(base, { commentCount: 1 }))).toBe(false);
    expect(isUntouched(withPr(base, { reviewCount: 1 }))).toBe(false);
    expect(isUntouched(withPr(base, { isDraftNative: true }))).toBe(false);
    expect(isUntouched(withPr(base, { title: 'WIP: x' }))).toBe(false);
    expect(isUntouched(withPr(base, { state: 'merged' }))).toBe(false);
  });
});

describe('needsReview', () => {
  const base = pr();
  it('is true with requested reviewers or approvals below the requirement', () => {
    expect(needsReview(base)).toBe(true);
    const noRequests = withPr(base, { requestedReviewers: [] });
    expect(needsReview(noRequests)).toBe(false);
    expect(
      needsReview(withPr(noRequests, { requiredApprovals: 2, latestReviews: [review()] })),
    ).toBe(true);
    expect(
      needsReview(withPr(noRequests, { requiredApprovals: 1, latestReviews: [review()] })),
    ).toBe(false);
  });

  it('is false for drafts, closed PRs, or with outstanding changes requested', () => {
    expect(needsReview(withPr(base, { isDraftNative: true }))).toBe(false);
    expect(needsReview(withPr(base, { title: 'Draft: x' }))).toBe(false);
    expect(needsReview(withPr(base, { state: 'closed' }))).toBe(false);
    expect(
      needsReview(withPr(base, { latestReviews: [review({ state: 'changes-requested' })] })),
    ).toBe(false);
  });
});

describe('needsMyReview', () => {
  const base = pr();
  const teams = [{ organization: 'Octo-Org', slug: 'PLATFORM' }];

  it('matches direct (case-insensitive) and team requests', () => {
    expect(needsMyReview(base, 'HUBOT', null)).toBe(true);
    expect(needsMyReview(base, 'someone', teams)).toBe(true);
    expect(needsMyReview(base, 'someone', null)).toBe(false);
    expect(needsMyReview(base, 'someone', [{ organization: 'other', slug: 'platform' }])).toBe(
      false,
    );
    expect(isReviewRequestedFrom(base, 'someone', [])).toBe(false);
  });

  it('excludes the author, drafts (like needsReview) and closed PRs', () => {
    expect(
      needsMyReview(withPr(base, { author: { login: 'hubot', avatarUrl: '' } }), 'hubot', null),
    ).toBe(false);
    expect(needsMyReview(withPr(base, { isDraftNative: true }), 'hubot', null)).toBe(false);
    expect(needsMyReview(withPr(base, { title: 'WIP: x' }), 'hubot', null)).toBe(false);
    expect(needsMyReview(withPr(base, { state: 'merged' }), 'hubot', null)).toBe(false);
  });

  it('is false once I reviewed the current head, true again after a new push', () => {
    const reviewed = withPr(base, { latestReviews: [review({ login: 'hubot' })] });
    expect(hasReviewedHead(reviewed, 'hubot')).toBe(true);
    expect(needsMyReview(reviewed, 'hubot', null)).toBe(false);
    const pushedAfter = withPr(reviewed, {
      headRefOid: 'ffffffffffffffffffffffffffffffffffffffff',
    });
    expect(needsMyReview(pushedAfter, 'hubot', null)).toBe(true);
    const onlyDismissed = withPr(base, {
      latestReviews: [review({ login: 'hubot', state: 'dismissed' })],
    });
    expect(needsMyReview(onlyDismissed, 'hubot', null)).toBe(true);
  });
});

describe('derivePullRequestFlags', () => {
  it('combines every flag for the viewer', () => {
    const context: FlagContext = {
      viewerLogin: 'mona',
      viewerTeams: null,
      staleThresholdDays: 5,
      now: NOW,
    };
    const flags = derivePullRequestFlags(
      withPr(pr({ mergeable: 'CONFLICTING' }, 2), { checks: 'failure', latestReviews: [review()] }),
      context,
    );
    expect(flags).toEqual({
      isDraft: false,
      isStale: true,
      isUntouched: true,
      hasConflicts: true,
      checksFailed: true,
      needsReview: true,
      needsMyReview: false,
      isMine: true,
      approvals: { approved: 1, required: 2 },
    });
  });
});
