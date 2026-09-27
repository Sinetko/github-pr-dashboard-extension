import { useCallback, useMemo, type FC } from 'react';
import { useStore } from 'zustand';

import { isSoundId, SOUND_IDS, SOUND_LABELS } from '@core/audio';
import { NOTIFICATION_TYPES, type NotificationType } from '@core/storage';
import { Button, Select, Stack, Switch } from '@shared/ui';

import { NO_SOUND, NOTIFICATION_TYPE_COPY } from './notification-settings.model';

import type { NotificationSettingsProps } from './notification-settings.types';

export const NotificationSettings: FC<NotificationSettingsProps> = ({ services }) => {
  const notifications = useStore(services.settings.store, (state) => state.value.notifications);

  const soundOptions = useMemo(
    () => [
      { value: NO_SOUND, label: 'No sound' },
      ...SOUND_IDS.map((sound) => ({ value: sound, label: SOUND_LABELS[sound] })),
    ],
    [],
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      void services.settings.update((settings) => ({
        ...settings,
        notifications: { ...settings.notifications, enabled },
      }));
    },
    [services],
  );
  const setType = useCallback(
    (type: NotificationType, enabled: boolean) => {
      void services.settings.update((settings) => ({
        ...settings,
        notifications: {
          ...settings.notifications,
          types: { ...settings.notifications.types, [type]: enabled },
        },
      }));
    },
    [services],
  );
  const setSound = useCallback(
    (value: string) => {
      const sound = isSoundId(value) ? value : null;
      void services.settings.update((settings) => ({
        ...settings,
        notifications: { ...settings.notifications, sound },
      }));
      if (sound !== null) {
        void services.sendMessage({ type: 'test-sound', sound });
      }
    },
    [services],
  );
  const testSound = useCallback(() => {
    if (notifications.sound !== null) {
      void services.sendMessage({ type: 'test-sound', sound: notifications.sound });
    }
  }, [notifications.sound, services]);
  const testNotification = useCallback(() => {
    void services.sendMessage({ type: 'test-notification' });
  }, [services]);

  return (
    <Stack gap="lg">
      <Switch
        id="notifications-enabled"
        label="Desktop notifications"
        description="Shown by the browser; each event notifies once."
        checked={notifications.enabled}
        onChange={setEnabled}
      />
      <Stack gap="md">
        {NOTIFICATION_TYPES.map((type) => (
          <Switch
            key={type}
            id={`notification-${type}`}
            label={NOTIFICATION_TYPE_COPY[type].label}
            description={NOTIFICATION_TYPE_COPY[type].description}
            checked={notifications.types[type]}
            disabled={!notifications.enabled}
            onChange={(enabled) => {
              setType(type, enabled);
            }}
          />
        ))}
      </Stack>
      <Stack direction="row" gap="sm" align="end" wrap>
        <Select
          id="notification-sound"
          label="Sound"
          options={soundOptions}
          value={notifications.sound ?? NO_SOUND}
          onChange={setSound}
          disabled={!notifications.enabled}
        />
        <Button size="sm" onClick={testSound} disabled={notifications.sound === null}>
          Play
        </Button>
        <Button size="sm" onClick={testNotification}>
          Send test notification
        </Button>
      </Stack>
    </Stack>
  );
};
