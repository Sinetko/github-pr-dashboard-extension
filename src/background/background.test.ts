import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setBadge } from '@core/chrome/action-badge';
import type { PollOutcome } from '@core/polling';
import {
  createLocalRepositories,
  createSessionRepositories,
  DEFAULT_SETTINGS,
} from '@core/storage';
import { installChromeFake, type ChromeFake } from '@test/chrome-fake';
import { buildPullRequest } from '@test/pull-request-fixture';
import { createTokenVaultFake, type TokenVaultFake } from '@test/token-vault-fake';

import { createBackgroundController, type BackgroundDependencies } from './background.controller';

let chromeFake: ChromeFake;
let vaultFake: TokenVaultFake;
let deps: BackgroundDependencies & {
  poll: ReturnType<typeof vi.fn<(options: { force: boolean }) => Promise<PollOutcome>>>;
  scheduleAlarm: ReturnType<typeof vi.fn>;
  showNotification: ReturnType<typeof vi.fn>;
  playSound: ReturnType<typeof vi.fn>;
  tryOpenPopup: ReturnType<typeof vi.fn>;
  openTab: ReturnType<typeof vi.fn>;
  migrate: ReturnType<typeof vi.fn>;
  clearNotification: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  chromeFake = installChromeFake();
  vaultFake = createTokenVaultFake();
  await vaultFake.vault.setupPassword('Correct-Horse-Battery-9');
  await vaultFake.vault.saveToken('github_pat_x');
  const repositories = createLocalRepositories();
  await repositories.settings.write({
    ...DEFAULT_SETTINGS,
    pollIntervalMinutes: 10,
    sources: [{ id: 'repo:o/r', kind: 'repository', owner: 'o', name: 'r' }],
  });
  deps = {
    repositories,
    session: createSessionRepositories(),
    vault: vaultFake.vault,
    poll: vi.fn(() =>
      Promise.resolve<PollOutcome>({ kind: 'completed', events: [], succeeded: 1, failed: 0 }),
    ),
    migrate: vi.fn(() => Promise.resolve()),
    scheduleAlarm: vi.fn(() => Promise.resolve()),
    setBadge,
    showNotification: vi.fn(() => Promise.resolve()),
    clearNotification: vi.fn(() => Promise.resolve()),
    playSound: vi.fn(() => Promise.resolve()),
    tryOpenPopup: vi.fn(() => Promise.resolve(false)),
    openTab: vi.fn(() => Promise.resolve()),
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('background controller', () => {
  it('migrates, schedules from settings and polls on install/startup', async () => {
    const controller = createBackgroundController(deps);
    await controller.onInstalled();
    expect(deps.migrate).toHaveBeenCalledOnce();
    expect(deps.scheduleAlarm).toHaveBeenCalledWith(10, 10);
    expect(deps.poll).toHaveBeenCalledWith({ force: true });
    await controller.onStartup();
    expect(deps.poll).toHaveBeenLastCalledWith({ force: false });
  });

  it('re-reads the interval and polls on poll-now; alarms poll too', async () => {
    const controller = createBackgroundController(deps);
    await deps.repositories.settings.update((settings) => ({
      ...settings,
      pollIntervalMinutes: 2,
    }));
    await controller.onMessage({ type: 'poll-now' });
    expect(deps.scheduleAlarm).toHaveBeenCalledWith(2, 2);
    await controller.onAlarm();
    expect(deps.poll).toHaveBeenCalledTimes(2);
  });

  it('notifies events from a completed poll and updates the badge', async () => {
    const pullRequest = buildPullRequest({ requestedReviewers: [{ kind: 'user', login: 'me' }] });
    deps.poll.mockResolvedValueOnce({
      kind: 'completed',
      events: [
        {
          type: 'review-requested',
          key: 'k1',
          pullRequest,
          title: 'Review requested',
          message: 'm',
        },
      ],
      succeeded: 1,
      failed: 0,
    });
    await createBackgroundController(deps).runPoll(false);
    expect(deps.showNotification).toHaveBeenCalledWith(
      expect.stringMatching(/^pr\|k1\|https:/),
      expect.objectContaining({ title: 'Review requested' }),
    );
    expect(deps.playSound).toHaveBeenCalledWith('chime');
    expect(chromeFake.chrome.action.setBadgeText).toHaveBeenCalled();
  });

  it('prompts to unlock (once) when a poll finds the vault locked', async () => {
    await vaultFake.vault.lock();
    deps.poll.mockResolvedValue({ kind: 'locked' });
    const controller = createBackgroundController(deps);
    await controller.runPoll(false);
    await controller.runPoll(false);
    expect(deps.tryOpenPopup).toHaveBeenCalledOnce();
    expect(deps.showNotification).toHaveBeenCalledOnce();
    expect(chromeFake.badge.text).toBe('•');
  });

  it('handles unlock-changed, sound and notification tests', async () => {
    const controller = createBackgroundController(deps);
    await controller.onMessage({ type: 'unlock-changed' });
    expect(deps.clearNotification).toHaveBeenCalledWith('unlock');
    expect(deps.poll).toHaveBeenCalledOnce();
    await vaultFake.vault.lock();
    await controller.onMessage({ type: 'unlock-changed' });
    expect(deps.poll).toHaveBeenCalledOnce();

    await controller.onMessage({ type: 'test-sound', sound: 'bell' });
    await controller.onMessage({ type: 'test-sound', sound: 'airhorn' });
    expect(deps.playSound).toHaveBeenCalledExactlyOnceWith('bell');
    await controller.onMessage({ type: 'test-notification' });
    expect(deps.showNotification).toHaveBeenCalledWith(
      expect.stringMatching(/^test-/),
      expect.objectContaining({ title: 'PR Dashboard test notification' }),
    );
    await controller.onMessage({ type: 'play-sound', sound: 'bell' });
    expect(deps.playSound).toHaveBeenCalledTimes(2);
  });

  it('routes notification clicks to the PR, or to the popup', async () => {
    const controller = createBackgroundController(deps);
    await controller.onNotificationClicked('pr|key|https://github.com/o/r/pull/1');
    expect(deps.openTab).toHaveBeenCalledWith('https://github.com/o/r/pull/1');
    await controller.onNotificationClicked('unlock');
    expect(deps.tryOpenPopup).toHaveBeenCalledOnce();
    expect(deps.clearNotification).toHaveBeenCalledTimes(2);
  });
});

describe('service worker entry', () => {
  it('registers every listener synchronously at start-up and ensures the alarm', async () => {
    vi.resetModules();
    await import('./index');
    expect(chromeFake.chrome.runtime.onInstalled.hasListeners()).toBe(true);
    expect(chromeFake.chrome.runtime.onStartup.hasListeners()).toBe(true);
    expect(chromeFake.chrome.alarms.onAlarm.hasListeners()).toBe(true);
    expect(chromeFake.chrome.runtime.onMessage.hasListeners()).toBe(true);
    expect(chromeFake.chrome.notifications.onClicked.hasListeners()).toBe(true);
    await vi.waitFor(() => {
      expect(chromeFake.alarms.get('poll')?.periodInMinutes).toBe(10);
    });
  });
});
