import { THEMES } from './themes';

import type { AppTheme, ColorScheme, ThemePreference } from './theme.types';

export const resolveTheme = (preference: ThemePreference, systemScheme: ColorScheme): AppTheme =>
  preference === 'system' ? THEMES[systemScheme] : THEMES[preference];
