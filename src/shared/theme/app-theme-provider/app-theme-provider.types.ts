import type { ThemePreference } from '../theme.types';
import type { ReactNode } from 'react';

export interface AppThemeProviderProps {
  preference: ThemePreference;
  children?: ReactNode;
}
