import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalRepositories, DEFAULT_SETTINGS, type LocalRepositories } from '@core/storage';
import { installChromeFake } from '@test/chrome-fake';
import { buildPullRequest } from '@test/pull-request-fixture';

import {
  MAX_NOTIFICATIONS_PER_CYCLE,
  notifyEvents,
  pullRequestNotificationId,
  urlFromNotificationId,
  type NotifierDependencies,
  type PullRequestEvent,
} from '.';

const event = (
  number: number,
  type: PullRequestEvent['type'] = 'review-requested',
): PullRequestEvent => ({
  type,
  key: `${type}|github.com:octo-org/hello-world#${number}|head1`,
  pullRequest: buildPullRequest({ number }),
  title: 'Review requested',
  message: `octo-org/hello-world #${number}`,
});

let repositories: LocalRepositories;
let deps: NotifierDependencies & {
  showNotification: ReturnType<typeof vi.fn>;
  playSound: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  installChromeFake();
  repositories = createLocalRepositories();
  deps = {
    settings: repositories.settings,
    polling: repositories.polling,
    showNotification: vi.fn(() => Promise.resolve('id')),
    playSound: vi.fn(() => Promise.resolve()),
    now: () => new Date('2026-01-20T12:00:00Z'),
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notifyEvents', () => {
  it('shows each new event once, plays one sound, and records the ledger', async () => {
    expect(await notifyEvents(deps, [event(1), event(2)])).toBe(2);
    expect(deps.showNotification).toHaveBeenCalledTimes(2);
    expect(deps.showNotification.mock.calls[0]?.[1]).toMatchObject({
      title: 'Review requested',
      contextMessage: 'octo-org/hello-world',
      iconPath: 'icons/icon-128.png',
    });
    expect(deps.playSound).toHaveBeenCalledExactlyOnceWith('chime');
    expect(Object.keys((await repositories.polling.read()).notified)).toHaveLength(2);
    expect(await notifyEvents(deps, [event(1), event(2)])).toBe(0);
    expect(deps.showNotification).toHaveBeenCalledTimes(2);
  });

  it('caps bursts with a summary and respects silent + disabled types', async () => {
    await repositories.settings.write({
      ...DEFAULT_SETTINGS,
      notifications: { ...DEFAULT_SETTINGS.notifications, sound: null },
    });
    const burst = Array.from({ length: MAX_NOTIFICATIONS_PER_CYCLE + 2 }, (_, index) =>
      event(index + 10),
    );
    await notifyEvents(deps, [...burst, event(99, 'new-comment')]);
    expect(deps.showNotification).toHaveBeenCalledTimes(MAX_NOTIFICATIONS_PER_CYCLE + 1);
    expect(deps.showNotification.mock.lastCall?.[1]).toMatchObject({
      title: '2 more pull request updates',
    });
    expect(deps.playSound).not.toHaveBeenCalled();
    expect(Object.keys((await repositories.polling.read()).notified)).toContain(
      event(99, 'new-comment').key,
    );
  });

  it('does nothing for an empty batch and survives sound failures', async () => {
    expect(await notifyEvents(deps, [])).toBe(0);
    deps.playSound.mockRejectedValueOnce(new Error('no audio'));
    await expect(notifyEvents(deps, [event(1)])).resolves.toBe(1);
    const summary = { ...deps };
    await notifyEvents(
      summary,
      Array.from({ length: MAX_NOTIFICATIONS_PER_CYCLE + 1 }, (_, index) => event(index + 50)),
    );
    expect(deps.showNotification.mock.lastCall?.[1]).toMatchObject({
      title: '1 more pull request update',
    });
  });

  it('encodes the PR URL in the notification id', () => {
    const id = pullRequestNotificationId(event(7));
    expect(urlFromNotificationId(id)).toBe('https://github.com/octo-org/hello-world/pull/7');
    expect(urlFromNotificationId('unlock')).toBeNull();
    expect(urlFromNotificationId('pr|x|javascript:alert(1)')).toBeNull();
  });
});
