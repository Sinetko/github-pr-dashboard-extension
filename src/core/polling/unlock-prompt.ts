import type { DesktopNotification } from '@core/chrome/notifications';
import { NOTIFICATION_ICON_PATH, UNLOCK_NOTIFICATION_ID } from '@core/events';
import type { SessionEntry } from '@core/storage';

export interface UnlockPromptDependencies {
  lockedPromptShown: SessionEntry<boolean>;
  tryOpenPopup: () => Promise<boolean>;
  showNotification: (id: string, notification: DesktopNotification) => Promise<unknown>;
}

export type UnlockPromptOutcome = 'already-shown' | 'popup' | 'notification';

export const promptUnlockOnce = async ({
  lockedPromptShown,
  tryOpenPopup,
  showNotification,
}: UnlockPromptDependencies): Promise<UnlockPromptOutcome> => {
  if (await lockedPromptShown.read()) {
    return 'already-shown';
  }
  await lockedPromptShown.write(true);
  if (await tryOpenPopup()) {
    return 'popup';
  }
  await showNotification(UNLOCK_NOTIFICATION_ID, {
    title: 'PR Dashboard is locked',
    message: 'Unlock to resume checking your pull requests.',
    iconPath: NOTIFICATION_ICON_PATH,
    requireInteraction: true,
  });
  return 'notification';
};
