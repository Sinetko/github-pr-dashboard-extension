import { useMemo, type FC } from 'react';
import { ThemeProvider } from 'styled-components';

import { useMediaQuery } from '../../hooks/use-media-query';
import { GlobalStyle } from '../global-style';
import { resolveTheme } from '../resolve-theme';

import type { AppThemeProviderProps } from './app-theme-provider.types';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export const AppThemeProvider: FC<AppThemeProviderProps> = ({ preference, children }) => {
  const prefersDark = useMediaQuery(DARK_SCHEME_QUERY);
  const theme = useMemo(
    () => resolveTheme(preference, prefersDark ? 'dark' : 'light'),
    [preference, prefersDark],
  );
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
};
