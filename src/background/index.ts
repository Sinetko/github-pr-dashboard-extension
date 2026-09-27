import { setBadge, tryOpenPopup } from '@core/chrome/action-badge';
import { getAlarm, onAlarm, scheduleRepeatingAlarm } from '@core/chrome/alarms';
import { onMessage, sendMessage } from '@core/chrome/messaging';
import {
  clearNotification,
  onNotificationClicked,
  showNotification,
} from '@core/chrome/notifications';
import { createOffscreenDocumentManager } from '@core/chrome/offscreen';
import { getExtensionId, onLifecycle } from '@core/chrome/runtime';
import { createStorageArea } from '@core/chrome/storage';
import { openTab } from '@core/chrome/tabs';
import { createPoller } from '@core/polling';
import { collectFingerprintSources, computeFingerprint, createTokenVault } from '@core/security';
import {
  createLocalRepositories,
  createSessionRepositories,
  runMigrations,
  type LocalKey,
} from '@core/storage';

import { createBackgroundController, POLL_ALARM } from './background.controller';

const repositories = createLocalRepositories();
const session = createSessionRepositories();
const vault = createTokenVault({
  security: repositories.security,
  session,
  getFingerprint: async () =>
    computeFingerprint(await collectFingerprintSources(navigator, getExtensionId())),
});
const poller = createPoller({ repositories, vault });
const offscreen = createOffscreenDocumentManager({
  path: 'src/offscreen/index.html',
  justification: 'Play the notification sound the user selected.',
});

const controller = createBackgroundController({
  repositories,
  session,
  vault,
  poll: (options) => poller.run(options),
  migrate: () => runMigrations(createStorageArea<LocalKey>('local')),
  scheduleAlarm: (periodInMinutes, delayInMinutes) =>
    scheduleRepeatingAlarm(POLL_ALARM, { periodInMinutes, delayInMinutes }),
  setBadge,
  showNotification,
  clearNotification,
  playSound: async (sound) => {
    await offscreen.ensure();
    await sendMessage({ type: 'play-sound', sound });
  },
  tryOpenPopup,
  openTab,
});

const logFailure =
  (label: string) =>
  (error: unknown): void => {
    console.error(`[background] ${label} failed`, error);
  };

onLifecycle({ onInstalled: controller.onInstalled, onStartup: controller.onStartup });
onAlarm(POLL_ALARM, controller.onAlarm);
onMessage(controller.onMessage);
onNotificationClicked((notificationId) => {
  void controller.onNotificationClicked(notificationId).catch(logFailure('notification click'));
});

void (async () => {
  if ((await getAlarm(POLL_ALARM)) === undefined) {
    const { pollIntervalMinutes } = await repositories.settings.read();
    await scheduleRepeatingAlarm(POLL_ALARM, {
      periodInMinutes: pollIntervalMinutes,
      delayInMinutes: 0,
    });
  }
  await controller.updateBadge();
})().catch(logFailure('wake-up'));
