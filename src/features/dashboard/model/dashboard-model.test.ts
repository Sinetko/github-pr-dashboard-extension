import { describe, expect, it } from 'vitest';

import type { FlagContext, PullRequest } from '@core/github';
import { DEFAULT_POLLING, type CacheEntry } from '@core/storage';

import { resolveDashboardStatus } from './dashboard-status.model';
import { authorTab, buildDashboardView, type DashboardQuery } from './dashboard-view.model';

const NOW = new Date('2026-01-20T12:00:00Z');
const CONTEXT: FlagContext = {
  viewerLogin: 'me',
  viewerTeams: null,
  staleThresholdDays: 5,
  now: NOW,
};
const QUERY: DashboardQuery = {
  tab: 'all',
  draftFilter: 'all',
  staleFilter: 'all',
  labelFilter: null,
  search: '',
  sortField: 'updated',
  sortDirection: 'desc',
};

let counter = 0;
const pr = (overrides: Partial<PullRequest> = {}): PullRequest => {
  counter += 1;
  return {
    id: `github.com:o/r#${counter}`,
    nodeId: `PR_${counter}`,
    repository: { owner: 'octo-org', name: 'hello-world' },
    number: counter,
    title: `Change ${counter}`,
    htmlUrl: `https://github.com/octo-org/hello-world/pull/${counter}`,
    author: { login: 'mona', avatarUrl: '' },
    state: 'open',
    isDraftNative: false,
    createdAt: '2026-01-18T00:00:00Z',
    updatedAt: '2026-01-19T00:00:00Z',
    lastActivityAt: '2026-01-19T00:00:00Z',
    headRefOid: 'abc',
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
    commentCount: 1,
    reviewCount: 1,
    unresolvedThreadCount: 0,
    ...overrides,
  };
};

describe('buildDashboardView', () => {
  const needsMine = pr({
    title: 'Fix login',
    requestedReviewers: [{ kind: 'user', login: 'me' }],
    updatedAt: '2026-01-19T10:00:00Z',
  });
  const needsOther = pr({
    requestedReviewers: [{ kind: 'user', login: 'hubot' }],
    author: { login: 'hubot', avatarUrl: '' },
    labels: [{ name: 'Bug', color: 'ff0000', description: null }],
    createdAt: '2026-01-01T00:00:00Z',
  });
  const draft = pr({ isDraftNative: true, author: null, updatedAt: '2026-01-10T00:00:00Z' });
  const stale = pr({
    lastActivityAt: '2026-01-01T00:00:00Z',
    author: { login: 'me', avatarUrl: '' },
    updatedAt: '2026-01-02T00:00:00Z',
  });
  const merged = pr({ state: 'merged' });
  const all = [needsMine, needsOther, draft, stale, merged];

  it('counts per tab and author, ignoring closed/merged PRs', () => {
    const view = buildDashboardView(all, CONTEXT, QUERY);
    expect(view.counts).toEqual({ all: 4, needsReview: 2, needsMyReview: 1 });
    expect(view.authors).toEqual([
      { login: 'ghost', count: 1 },
      { login: 'hubot', count: 1 },
      { login: 'me', count: 1 },
      { login: 'mona', count: 1 },
    ]);
    expect(view.stats).toMatchObject({ total: 4, drafts: 1, stale: 1, mine: 1 });
    expect(view.labels.map((label) => label.name)).toEqual(['Bug']);
  });

  it('filters by tab, falling back to all for an unknown author', () => {
    expect(
      buildDashboardView(all, CONTEXT, { ...QUERY, tab: 'needs-my-review' }).items.map(
        (item) => item.pullRequest,
      ),
    ).toEqual([needsMine]);
    expect(buildDashboardView(all, CONTEXT, { ...QUERY, tab: 'needs-review' }).items).toHaveLength(
      2,
    );
    expect(
      buildDashboardView(all, CONTEXT, { ...QUERY, tab: authorTab('HUBOT') }).items.map(
        (item) => item.pullRequest,
      ),
    ).toEqual([needsOther]);
    const fallback = buildDashboardView(all, CONTEXT, { ...QUERY, tab: authorTab('nobody') });
    expect(fallback.effectiveTab).toBe('all');
    expect(fallback.items).toHaveLength(4);
  });

  it('applies tri-state draft/stale filters and label filter', () => {
    expect(
      buildDashboardView(all, CONTEXT, { ...QUERY, draftFilter: 'only' }).items.map(
        (item) => item.pullRequest,
      ),
    ).toEqual([draft]);
    expect(buildDashboardView(all, CONTEXT, { ...QUERY, draftFilter: 'hide' }).items).toHaveLength(
      3,
    );
    expect(
      buildDashboardView(all, CONTEXT, { ...QUERY, staleFilter: 'only' }).items.map(
        (item) => item.pullRequest,
      ),
    ).toEqual([stale]);
    expect(buildDashboardView(all, CONTEXT, { ...QUERY, staleFilter: 'hide' }).items).toHaveLength(
      3,
    );
    expect(
      buildDashboardView(all, CONTEXT, { ...QUERY, labelFilter: 'bug' }).items.map(
        (item) => item.pullRequest,
      ),
    ).toEqual([needsOther]);
  });

  it('searches title, repo, number, author and labels case-insensitively', () => {
    const search = (text: string): number =>
      buildDashboardView(all, CONTEXT, { ...QUERY, search: text }).items.length;
    expect(search('LOGIN')).toBe(1);
    expect(search('hello-world')).toBe(4);
    expect(search(`#${needsOther.number}`)).toBe(1);
    expect(search('hubot')).toBe(1);
    expect(search('bug')).toBe(1);
    expect(search('ghost')).toBe(1);
    expect(search('zzz')).toBe(0);
  });

  it('sorts by created/updated in both directions', () => {
    const order = (
      sortField: 'created' | 'updated',
      sortDirection: 'asc' | 'desc',
    ): PullRequest[] =>
      buildDashboardView([needsMine, draft, stale], CONTEXT, {
        ...QUERY,
        sortField,
        sortDirection,
      }).items.map((item) => item.pullRequest);
    expect(order('updated', 'desc')).toEqual([needsMine, draft, stale]);
    expect(order('updated', 'asc')).toEqual([stale, draft, needsMine]);
    expect(
      buildDashboardView([needsMine, needsOther], CONTEXT, {
        ...QUERY,
        sortField: 'created',
        sortDirection: 'asc',
      }).items[0]?.pullRequest,
    ).toBe(needsOther);
  });
});

describe('resolveDashboardStatus', () => {
  const entry: CacheEntry = {
    fetchedAt: '2026-01-20T11:00:00Z',
    pullRequests: [],
    truncated: false,
  };
  const error = { kind: 'network' as const, message: 'offline', at: 't' };

  it('prefers rate-limit, then invalid token, then errors, then loading/ok', () => {
    expect(
      resolveDashboardStatus({
        entry,
        sourceState: undefined,
        polling: {
          ...DEFAULT_POLLING,
          rateLimitedUntil: '2026-01-20T12:30:00Z',
          lastError: { ...error, kind: 'unauthorized' },
        },
        now: NOW,
      }).kind,
    ).toBe('rate-limited');
    expect(
      resolveDashboardStatus({
        entry,
        sourceState: undefined,
        polling: { ...DEFAULT_POLLING, rateLimitedUntil: '2026-01-20T11:30:00Z' },
        now: NOW,
      }).kind,
    ).toBe('ok');
    expect(
      resolveDashboardStatus({
        entry,
        sourceState: undefined,
        polling: { ...DEFAULT_POLLING, lastError: { ...error, kind: 'unauthorized' } },
        now: NOW,
      }).kind,
    ).toBe('token-invalid');
    expect(
      resolveDashboardStatus({
        entry: undefined,
        sourceState: undefined,
        polling: DEFAULT_POLLING,
        now: NOW,
      }).kind,
    ).toBe('loading');
    expect(
      resolveDashboardStatus({
        entry: { ...entry, truncated: true },
        sourceState: undefined,
        polling: DEFAULT_POLLING,
        now: NOW,
      }).kind,
    ).toBe('truncated');
  });

  it('shows source errors immediately but global ones only after repeated failures', () => {
    const sourceState = {
      etag: null,
      lastFullFetchAt: null,
      lastFetchAt: null,
      cyclesSinceFull: 0,
      lastError: error,
    };
    expect(
      resolveDashboardStatus({ entry, sourceState, polling: DEFAULT_POLLING, now: NOW }),
    ).toEqual({ kind: 'error', message: 'offline', hasCache: true, cachedAt: '1 hour ago' });
    expect(
      resolveDashboardStatus({
        entry,
        sourceState: undefined,
        polling: { ...DEFAULT_POLLING, lastError: error, consecutiveFailures: 1 },
        now: NOW,
      }).kind,
    ).toBe('ok');
    expect(
      resolveDashboardStatus({
        entry: undefined,
        sourceState: undefined,
        polling: { ...DEFAULT_POLLING, lastError: error, consecutiveFailures: 3 },
        now: NOW,
      }),
    ).toMatchObject({ kind: 'error', hasCache: false, cachedAt: null });
  });
});
