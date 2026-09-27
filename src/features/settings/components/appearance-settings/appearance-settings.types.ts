import type { SettingsServices } from '../../model/settings-services.types';

export interface AppearanceSettingsProps {
  services: Pick<SettingsServices, 'settings'>;
}
