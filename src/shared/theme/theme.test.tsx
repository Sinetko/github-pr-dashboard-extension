import { act, render, screen } from '@testing-library/react';
import styled from 'styled-components';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installMatchMedia } from '@test/match-media';

import { AppThemeProvider, resolveTheme, THEME_LABELS, THEMES } from '.';

const Probe = styled.div`
  color: ${({ theme }) => theme.colors.text};
`;
const ThemeName = styled.span.attrs(({ theme }) => ({ children: theme.name }))``;

describe('resolveTheme', () => {
  it('follows the system scheme only for "system"', () => {
    expect(resolveTheme('system', 'dark').name).toBe('dark');
    expect(resolveTheme('system', 'light').name).toBe('light');
    expect(resolveTheme('dimmed', 'light').name).toBe('dimmed');
  });

  it('defines a label and complete tone set for every theme', () => {
    for (const theme of Object.values(THEMES)) {
      expect(THEME_LABELS[theme.name]).toBeTruthy();
      expect(Object.keys(theme.colors.tones)).toHaveLength(6);
    }
  });
});

describe('AppThemeProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('switches live with the OS preference when set to system', () => {
    const setPrefersDark = installMatchMedia(false);
    render(
      <AppThemeProvider preference="system">
        <Probe>
          <ThemeName />
        </Probe>
      </AppThemeProvider>,
    );
    expect(screen.getByText('light')).toBeInTheDocument();
    act(() => {
      setPrefersDark(true);
    });
    expect(screen.getByText('dark')).toBeInTheDocument();
  });

  it('ignores the OS preference for an explicit theme', () => {
    installMatchMedia(true);
    render(
      <AppThemeProvider preference="light">
        <ThemeName />
      </AppThemeProvider>,
    );
    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(
      <AppThemeProvider preference="system">
        <ThemeName />
      </AppThemeProvider>,
    );
    expect(screen.getByText('light')).toBeInTheDocument();
  });
});
