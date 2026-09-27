import type { SoundId } from '@core/audio';
import type { DesktopNotification } from '@core/chrome/notifications';
import type { PollingRecord, Repository, SettingsRecord } from '@core/storage';

import { recordEvents, selectNotifiableEvents } from './notification-ledger';

import type { PullRequestEvent } from './pull-request-events';

export const NOTIFICATION_ICON_PATH = 'icons/icon-128.png';
export const MAX_NOTIFICATIONS_PER_CYCLE = 4;
const PULL_REQUEST_PREFIX = 'pr|';
export const UNLOCK_NOTIFICATION_ID = 'unlock';
export const SUMMARY_NOTIFICATION_ID = 'summary';

export const pullRequestNotificationId = (event: PullRequestEvent): string =>
  `${PULL_REQUEST_PREFIX}${event.key}|${event.pullRequest.htmlUrl}`;

export const urlFromNotificationId = (notificationId: string): string | null => {
  if (!notificationId.startsWith(PULL_REQUEST_PREFIX)) {
    return null;
  }
  const url = notificationId.slice(notificationId.lastIndexOf('|') + 1);
  return url.startsWith('https://') ? url : null;
};

export interface NotifierDependencies {
  settings: Pick<Repository<SettingsRecord>, 'read'>;
  polling: Pick<Repository<PollingRecord>, 'update'>;
  showNotification: (id: string, notification: DesktopNotification) => Promise<unknown>;
  playSound: (sound: SoundId) => Promise<void>;
  now?: () => Date;
}

export const notifyEvents = async (
  { settings, polling, showNotification, playSound, now = () => new Date() }: NotifierDependencies,
  events: readonly PullRequestEvent[],
): Promise<number> => {
  if (events.length === 0) {
    return 0;
  }
  const { notifications } = await settings.read();
  let notifiable: PullRequestEvent[] = [];
  await polling.update((current) => {
    notifiable = selectNotifiableEvents(events, current.notified, notifications);
    return { ...current, notified: recordEvents(current.notified, events, now()) };
  });

  const shown = notifiable.slice(0, MAX_NOTIFICATIONS_PER_CYCLE);
  for (const event of shown) {
    await showNotification(pullRequestNotificationId(event), {
      title: event.title,
      message: event.message,
      contextMessage: `${event.pullRequest.repository.owner}/${event.pullRequest.repository.name}`,
      iconPath: NOTIFICATION_ICON_PATH,
    });
  }
  const overflow = notifiable.length - shown.length;
  if (overflow > 0) {
    await showNotification(SUMMARY_NOTIFICATION_ID, {
      title: `${overflow} more pull request update${overflow === 1 ? '' : 's'}`,
      message: 'Open PR Dashboard to see everything.',
      iconPath: NOTIFICATION_ICON_PATH,
    });
  }
  if (notifiable.length > 0 && notifications.sound !== null) {
    await playSound(notifications.sound).catch(() => undefined);
  }
  return notifiable.length;
};
