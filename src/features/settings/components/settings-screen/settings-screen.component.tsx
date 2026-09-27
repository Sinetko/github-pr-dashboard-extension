import { Button, IconButton, Screen, Stack, TabPanel, Tabs } from '@shared/ui';
import { assertNever } from '@shared/utils';

import { AppearanceSettings } from '../appearance-settings';
import { GeneralSettingsForm } from '../general-settings-form';
import { NotificationSettings } from '../notification-settings';
import { SETTINGS_ID_PREFIX, SETTINGS_TAB_ITEMS } from './settings-screen.model';

import type { SettingsScreenProps } from './settings-screen.types';
import type { FC, ReactNode } from 'react';

export const SettingsScreen: FC<SettingsScreenProps> = ({
  services,
  tab,
  onSelectTab,
  onClose,
  onOpenAbout,
  securityPanel,
}) => {
  const renderTab = (): ReactNode => {
    switch (tab) {
      case 'general':
        return <GeneralSettingsForm services={services} mode="settings" />;
      case 'notifications':
        return <NotificationSettings services={services} />;
      case 'appearance':
        return <AppearanceSettings services={services} />;
      case 'security':
        return securityPanel;
      default:
        return assertNever(tab, 'Unknown settings tab');
    }
  };

  return (
    <Screen
      title="Settings"
      headerAction={
        <Stack direction="row" gap="xs">
          <Button size="sm" variant="ghost" onClick={onOpenAbout}>
            About
          </Button>
          <IconButton label="Close settings" icon="✕" onClick={onClose} />
        </Stack>
      }
    >
      <Tabs
        items={SETTINGS_TAB_ITEMS}
        value={tab}
        onChange={onSelectTab}
        label="Settings sections"
        idPrefix={SETTINGS_ID_PREFIX}
      />
      <TabPanel idPrefix={SETTINGS_ID_PREFIX} value={tab}>
        {renderTab()}
      </TabPanel>
    </Screen>
  );
};
