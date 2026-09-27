import { useCallback, useReducer, type FC } from 'react';
import { useStore } from 'zustand';

import { DashboardScreen } from '@features/dashboard';
import { SecuritySettingsPanel } from '@features/security';
import {
  AboutPanel,
  INITIAL_PANEL_STATE,
  panelReducer,
  SettingsScreen,
  type SettingsTab,
} from '@features/settings';

import type { ReadyShellProps } from './ready-shell.types';

export const ReadyShell: FC<ReadyShellProps> = ({
  services,
  biometricAvailable,
  onLock,
  onReset,
}) => {
  const [panel, dispatch] = useReducer(panelReducer, INITIAL_PANEL_STATE);
  const hasBiometric = useStore(services.vaultState.store, (state) => state.hasBiometric);

  const openSettings = useCallback(() => {
    dispatch({ type: 'open-settings' });
  }, []);
  const openAbout = useCallback(() => {
    dispatch({ type: 'open-about' });
  }, []);
  const close = useCallback(() => {
    dispatch({ type: 'close' });
  }, []);
  const selectTab = useCallback((tab: SettingsTab) => {
    dispatch({ type: 'select-tab', tab });
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await services.vault.changePassword(currentPassword, newPassword);
      await services.vaultState.refresh();
    },
    [services],
  );
  const enrollBiometric = useCallback(async () => {
    await services.vault.enrollBiometric(services.credentials);
    await services.vaultState.refresh();
  }, [services]);
  const removeBiometric = useCallback(async () => {
    await services.vault.removeBiometric();
    await services.vaultState.refresh();
  }, [services]);

  switch (panel.panel) {
    case 'settings':
      return (
        <SettingsScreen
          services={services.settingsServices}
          tab={panel.tab}
          onSelectTab={selectTab}
          onClose={close}
          onOpenAbout={openAbout}
          securityPanel={
            <SecuritySettingsPanel
              hasBiometric={hasBiometric}
              biometricAvailable={biometricAvailable}
              onChangePassword={changePassword}
              onEnrollBiometric={enrollBiometric}
              onRemoveBiometric={removeBiometric}
              onLock={onLock}
              onReset={onReset}
            />
          }
        />
      );
    case 'about':
      return <AboutPanel version={services.settingsServices.extensionVersion} onClose={close} />;
    case 'none':
      return (
        <DashboardScreen
          services={services.dashboardServices}
          onOpenSettings={openSettings}
          onOpenAbout={openAbout}
        />
      );
  }
};
