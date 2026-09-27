import type { SettingsServices } from '../../model/settings-services.types';

export interface NotificationSettingsProps {
  services: Pick<SettingsServices, 'settings' | 'sendMessage'>;
}
