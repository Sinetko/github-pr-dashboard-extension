import type { TabItem } from '@shared/ui';

import type { SettingsTab } from '../../model/panel-state.model';

export const SETTINGS_TAB_ITEMS: readonly TabItem<SettingsTab>[] = [
  { value: 'general', label: 'General' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'security', label: 'Security' },
];

export const SETTINGS_ID_PREFIX = 'settings';
