import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

import { AppThemeProvider, type ThemePreference } from '@shared/theme';

import type { ReactElement, ReactNode } from 'react';

export const renderWithTheme = (
  ui: ReactElement,
  { preference = 'light', ...options }: RenderOptions & { preference?: ThemePreference } = {},
): RenderResult =>
  render(ui, {
    wrapper: ({ children }: { children?: ReactNode }) => (
      <AppThemeProvider preference={preference}>{children}</AppThemeProvider>
    ),
    ...options,
  });
