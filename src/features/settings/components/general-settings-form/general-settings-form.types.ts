import type { SettingsServices } from '../../model/settings-services.types';

export interface GeneralSettingsFormProps {
  services: SettingsServices;
  mode: 'onboarding' | 'settings';
  onSaved?: () => void;
}
