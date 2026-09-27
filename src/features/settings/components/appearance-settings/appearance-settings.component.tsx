import { useCallback, type FC } from 'react';
import { useStore } from 'zustand';

import { THEME_PREFERENCES } from '@core/storage';
import { THEME_LABELS, type ThemePreference } from '@shared/theme';
import { Select, Stack } from '@shared/ui';

import type { AppearanceSettingsProps } from './appearance-settings.types';

const THEME_OPTIONS = THEME_PREFERENCES.map((value) => ({ value, label: THEME_LABELS[value] }));

export const AppearanceSettings: FC<AppearanceSettingsProps> = ({ services }) => {
  const theme = useStore(services.settings.store, (state) => state.value.theme);
  const setTheme = useCallback(
    (value: ThemePreference) => {
      void services.settings.update((settings) => ({ ...settings, theme: value }));
    },
    [services],
  );
  return (
    <Stack gap="sm">
      <Select id="theme" label="Theme" options={THEME_OPTIONS} value={theme} onChange={setTheme} />
    </Stack>
  );
};
