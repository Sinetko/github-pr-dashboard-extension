import { describe, expect, it } from 'vitest';

import { buildPullRequest } from '@test/pull-request-fixture';

import { countReviewWork, resolveBadgeState, type BadgeInputs } from '.';

const BASE: BadgeInputs = {
  isConfigured: true,
  isLocked: false,
  consecutiveFailures: 0,
  needsMyReviewCount: 0,
  needsReviewCount: 0,
};

describe('resolveBadgeState', () => {
  it('applies strict precedence: locked > error > my-review > review > none', () => {
    const all: BadgeInputs = {
      ...BASE,
      isLocked: true,
      consecutiveFailures: 5,
      needsMyReviewCount: 2,
      needsReviewCount: 4,
    };
    expect(resolveBadgeState(all).kind).toBe('locked');
    expect(resolveBadgeState({ ...all, isLocked: false }).kind).toBe('error');
    expect(resolveBadgeState({ ...all, isLocked: false, consecutiveFailures: 2 })).toMatchObject({
      kind: 'my-review',
      text: '2',
      title: '2 pull requests need your review',
    });
    expect(resolveBadgeState({ ...BASE, needsReviewCount: 1 })).toMatchObject({
      kind: 'review',
      text: '1',
      title: '1 pull request waiting for review',
    });
    expect(resolveBadgeState(BASE)).toMatchObject({ kind: 'none', text: '' });
    expect(resolveBadgeState({ ...all, isConfigured: false })).toMatchObject({
      kind: 'none',
      text: '',
    });
  });

  it('caps large counts', () => {
    expect(resolveBadgeState({ ...BASE, needsMyReviewCount: 150 }).text).toBe('99+');
  });
});

describe('countReviewWork', () => {
  it('dedupes PRs across sources and counts both categories', () => {
    const mine = buildPullRequest({
      number: 1,
      requestedReviewers: [{ kind: 'user', login: 'me' }],
    });
    const other = buildPullRequest({
      number: 2,
      requestedReviewers: [{ kind: 'user', login: 'hubot' }],
    });
    const draft = buildPullRequest({
      number: 3,
      isDraftNative: true,
      requestedReviewers: [{ kind: 'user', login: 'me' }],
    });
    expect(
      countReviewWork(
        [
          [mine, other],
          [mine, draft],
        ],
        'me',
        null,
      ),
    ).toEqual({ needsMyReviewCount: 1, needsReviewCount: 2 });
    expect(countReviewWork([[mine]], null, null)).toEqual({
      needsMyReviewCount: 0,
      needsReviewCount: 1,
    });
  });
});
