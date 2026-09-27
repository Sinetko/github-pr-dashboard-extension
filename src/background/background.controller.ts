import { isSoundId, type SoundId } from '@core/audio';
import { refreshBadge } from '@core/badge';
import type { BadgeAppearance } from '@core/chrome/action-badge';
import type { ExtensionMessage } from '@core/chrome/messaging';
import type { DesktopNotification } from '@core/chrome/notifications';
import {
  NOTIFICATION_ICON_PATH,
  notifyEvents,
  UNLOCK_NOTIFICATION_ID,
  urlFromNotificationId,
} from '@core/events';
import { promptUnlockOnce, type PollOutcome } from '@core/polling';
import type { TokenVault } from '@core/security';
import type { LocalRepositories, SessionRepositories } from '@core/storage';

export const POLL_ALARM = 'poll';

export interface BackgroundDependencies {
  repositories: Pick<LocalRepositories, 'settings' | 'polling' | 'cache'>;
  session: Pick<SessionRepositories, 'lockedPromptShown'>;
  vault: Pick<TokenVault, 'getStatus' | 'hasToken'>;
  poll: (options: { force: boolean }) => Promise<PollOutcome>;
  migrate: () => Promise<unknown>;
  scheduleAlarm: (periodInMinutes: number, delayInMinutes: number) => Promise<void>;
  setBadge: (appearance: BadgeAppearance) => Promise<void>;
  showNotification: (id: string, notification: DesktopNotification) => Promise<unknown>;
  clearNotification: (id: string) => Promise<unknown>;
  playSound: (sound: SoundId) => Promise<void>;
  tryOpenPopup: () => Promise<boolean>;
  openTab: (url: string) => Promise<void>;
}

export const createBackgroundController = (dependencies: BackgroundDependencies) => {
  const { repositories } = dependencies;

  const updateBadge = (): Promise<unknown> =>
    refreshBadge({ ...repositories, vault: dependencies.vault, setBadge: dependencies.setBadge });

  const schedulePolling = async (delayInMinutes?: number): Promise<void> => {
    const { pollIntervalMinutes } = await repositories.settings.read();
    await dependencies.scheduleAlarm(pollIntervalMinutes, delayInMinutes ?? pollIntervalMinutes);
  };

  const runPoll = async (force: boolean): Promise<PollOutcome> => {
    const outcome = await dependencies.poll({ force });
    if (outcome.kind === 'completed') {
      await notifyEvents(
        {
          settings: repositories.settings,
          polling: repositories.polling,
          showNotification: dependencies.showNotification,
          playSound: dependencies.playSound,
        },
        outcome.events,
      );
    } else if (outcome.kind === 'locked') {
      await promptUnlockOnce({
        lockedPromptShown: dependencies.session.lockedPromptShown,
        tryOpenPopup: dependencies.tryOpenPopup,
        showNotification: dependencies.showNotification,
      });
    }
    await updateBadge();
    return outcome;
  };

  return {
    updateBadge,
    runPoll,
    onInstalled: async (): Promise<void> => {
      await dependencies.migrate();
      await schedulePolling();
      await runPoll(true);
    },
    onStartup: async (): Promise<void> => {
      await dependencies.migrate();
      await schedulePolling();
      await runPoll(false);
    },
    onAlarm: async (): Promise<void> => {
      await runPoll(false);
    },
    onMessage: async (message: ExtensionMessage): Promise<void> => {
      switch (message.type) {
        case 'poll-now':
          await schedulePolling();
          await runPoll(false);
          return;
        case 'unlock-changed':
          await updateBadge();
          if ((await dependencies.vault.getStatus()) === 'unlocked') {
            await dependencies.clearNotification(UNLOCK_NOTIFICATION_ID);
            await runPoll(false);
          }
          return;
        case 'test-sound':
          if (isSoundId(message.sound)) {
            await dependencies.playSound(message.sound);
          }
          return;
        case 'test-notification': {
          const { notifications } = await repositories.settings.read();
          await dependencies.showNotification(`test-${Date.now()}`, {
            title: 'PR Dashboard test notification',
            message: 'Notifications are working.',
            iconPath: NOTIFICATION_ICON_PATH,
          });
          if (notifications.sound !== null) {
            await dependencies.playSound(notifications.sound);
          }
          return;
        }
        case 'play-sound':
          return;
      }
    },
    onNotificationClicked: async (notificationId: string): Promise<void> => {
      await dependencies.clearNotification(notificationId);
      const url = urlFromNotificationId(notificationId);
      if (url !== null) {
        await dependencies.openTab(url);
        return;
      }
      await dependencies.tryOpenPopup();
    },
  };
};

export type BackgroundController = ReturnType<typeof createBackgroundController>;
