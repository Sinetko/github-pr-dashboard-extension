import type { SettingsTab } from '../../model/panel-state.model';
import type { SettingsServices } from '../../model/settings-services.types';
import type { ReactNode } from 'react';

export interface SettingsScreenProps {
  services: SettingsServices;
  tab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  onClose: () => void;
  onOpenAbout: () => void;
  securityPanel: ReactNode;
}
