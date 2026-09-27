import { describe, expect, it } from 'vitest';

import type { PullRequest } from '@core/github';
import { DEFAULT_SETTINGS } from '@core/storage';
import { buildPullRequest } from '@test/pull-request-fixture';

import { diffPullRequests, recordEvents, selectNotifiableEvents, type PullRequestEvent } from '.';

const CONTEXT = { viewerLogin: 'me', viewerTeams: [{ organization: 'octo-org', slug: 'core' }] };
const mine = (overrides: Partial<PullRequest> = {}): PullRequest =>
  buildPullRequest({ number: 1, author: { login: 'me', avatarUrl: '' }, ...overrides });
const types = (events: PullRequestEvent[]): string[] => events.map((event) => event.type);

describe('diffPullRequests', () => {
  it('emits nothing on the first snapshot or without a viewer', () => {
    expect(diffPullRequests(undefined, [mine()], CONTEXT)).toEqual([]);
    expect(
      diffPullRequests([mine()], [mine({ checks: 'failure' })], {
        viewerLogin: '',
        viewerTeams: null,
      }),
    ).toEqual([]);
  });

  it('detects new review requests (direct and team), re-firing after a new push', () => {
    const before = buildPullRequest({ number: 2 });
    const requested = {
      ...before,
      requestedReviewers: [{ kind: 'team' as const, organization: 'Octo-Org', slug: 'CORE' }],
    };
    const [event] = diffPullRequests([before], [requested], CONTEXT);
    expect(event).toMatchObject({
      type: 'review-requested',
      key: 'review-requested|github.com:octo-org/hello-world#2|head1',
      title: 'Review requested',
      message: 'octo-org/hello-world #2: Change number 2',
    });
    expect(diffPullRequests([requested], [requested], CONTEXT)).toEqual([]);
    const newPR = buildPullRequest({
      number: 3,
      requestedReviewers: [{ kind: 'user', login: 'me' }],
    });
    expect(types(diffPullRequests([], [newPR], CONTEXT))).toEqual(['review-requested']);
  });

  it("reports reviews received on my PRs, but not my own reviews or other people's PRs", () => {
    const review = {
      login: 'hubot',
      state: 'changes-requested' as const,
      submittedAt: '2026-01-19T10:00:00Z',
      commitOid: 'head1',
    };
    const events = diffPullRequests(
      [mine()],
      [mine({ lastReview: review, reviewCount: 1 })],
      CONTEXT,
    );
    expect(events).toMatchObject([
      {
        type: 'review-received',
        title: 'Changes requested on your PR',
        key: 'review-received|github.com:octo-org/hello-world#1|hubot|2026-01-19T10:00:00Z',
      },
    ]);
    expect(
      diffPullRequests([mine()], [mine({ lastReview: { ...review, login: 'me' } })], CONTEXT),
    ).toEqual([]);
    const theirs = buildPullRequest({ number: 9 });
    expect(diffPullRequests([theirs], [{ ...theirs, lastReview: review }], CONTEXT)).toEqual([]);
    const older = mine({ lastReview: review });
    expect(
      diffPullRequests(
        [older],
        [mine({ lastReview: { ...review, submittedAt: '2026-01-18T00:00:00Z' } })],
        CONTEXT,
      ),
    ).toEqual([]);
  });

  it('reports checks flipping to failing and conflicts appearing on my PRs', () => {
    expect(
      types(
        diffPullRequests([mine({ checks: 'pending' })], [mine({ checks: 'failure' })], CONTEXT),
      ),
    ).toEqual(['checks-failed']);
    expect(
      diffPullRequests([mine({ checks: 'failure' })], [mine({ checks: 'failure' })], CONTEXT),
    ).toEqual([]);
    expect(
      types(diffPullRequests([mine()], [mine({ mergeability: 'conflicting' })], CONTEXT)),
    ).toEqual(['merge-conflict']);
    expect(
      diffPullRequests(
        [mine({ mergeState: 'dirty' })],
        [mine({ mergeability: 'conflicting' })],
        CONTEXT,
      ),
    ).toEqual([]);
  });

  it('reports new comments by others on my PRs', () => {
    const comment = { login: 'octocat', createdAt: '2026-01-19T12:00:00Z' };
    expect(
      diffPullRequests([mine()], [mine({ commentCount: 1, lastComment: comment })], CONTEXT),
    ).toMatchObject([
      { type: 'new-comment', message: 'octocat on octo-org/hello-world #1: Change number 1' },
    ]);
    expect(
      diffPullRequests(
        [mine()],
        [mine({ commentCount: 1, lastComment: { ...comment, login: 'ME' } })],
        CONTEXT,
      ),
    ).toEqual([]);
    expect(
      diffPullRequests(
        [mine()],
        [mine({ commentCount: 1, lastComment: { login: null, createdAt: comment.createdAt } })],
        CONTEXT,
      )[0]?.message,
    ).toMatch(/^Someone on/);
    expect(
      diffPullRequests(
        [mine({ commentCount: 2 })],
        [mine({ commentCount: 1, lastComment: comment })],
        CONTEXT,
      ),
    ).toEqual([]);
  });

  it('reports merges/closes of any tracked PR and nothing else for closed ones', () => {
    const open = buildPullRequest({ number: 5 });
    expect(diffPullRequests([open], [{ ...open, state: 'merged' }], CONTEXT)).toMatchObject([
      { type: 'pr-closed', title: 'Pull request merged' },
    ]);
    expect(diffPullRequests([open], [{ ...open, state: 'closed' }], CONTEXT)[0]?.title).toBe(
      'Pull request closed',
    );
    expect(
      diffPullRequests([{ ...open, state: 'closed' }], [{ ...open, state: 'closed' }], CONTEXT),
    ).toEqual([]);
  });
});

describe('notification ledger', () => {
  const now = new Date('2026-02-01T00:00:00Z');
  const events = diffPullRequests(
    [mine({ checks: 'pending' })],
    [mine({ checks: 'failure', mergeability: 'conflicting' })],
    CONTEXT,
  );

  it('filters by settings and dedupes against the ledger and within a batch', () => {
    const settings = DEFAULT_SETTINGS.notifications;
    expect(types(selectNotifiableEvents([...events, ...events], {}, settings))).toEqual([
      'checks-failed',
      'merge-conflict',
    ]);
    const firstKey = events[0]?.key ?? '';
    expect(types(selectNotifiableEvents(events, { [firstKey]: 't' }, settings))).toEqual([
      'merge-conflict',
    ]);
    expect(selectNotifiableEvents(events, {}, { ...settings, enabled: false })).toEqual([]);
    expect(
      types(
        selectNotifiableEvents(
          events,
          {},
          { ...settings, types: { ...settings.types, 'checks-failed': false } },
        ),
      ),
    ).toEqual(['merge-conflict']);
  });

  it('records every event once and prunes old entries', () => {
    const ledger = recordEvents(
      { old: '2025-12-01T00:00:00Z', recent: '2026-01-25T00:00:00Z' },
      [...events, ...events],
      now,
    );
    expect(Object.keys(ledger).sort()).toEqual(
      ['recent', ...events.map((event) => event.key)].sort(),
    );
    const again = recordEvents(ledger, events, new Date('2026-02-02T00:00:00Z'));
    expect(again[events[0]?.key ?? '']).toBe(now.toISOString());
  });
});
