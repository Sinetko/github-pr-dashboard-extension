import type { AppTheme, ThemeName, ToneColors } from './theme.types';

type Palette = Pick<AppTheme, 'name' | 'scheme' | 'colors'>;

const base: Omit<AppTheme, keyof Palette> = {
  space: { xxs: '2px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  radii: { sm: '4px', md: '8px', pill: '999px' },
  font: {
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
    size: { xs: '11px', sm: '12px', md: '14px', lg: '16px' },
    weight: { regular: 400, medium: 500, bold: 600 },
  },
  shadow: { popover: '0 8px 24px rgba(0, 0, 0, 0.2)' },
  motion: { fast: '120ms ease-out' },
};

const tone = (foreground: string, subtle: string, border: string): ToneColors => ({
  foreground,
  subtle,
  border,
});

const light: Palette = {
  name: 'light',
  scheme: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f6f8fa',
    surfaceHover: '#eaeef2',
    border: '#d0d7de',
    text: '#1f2328',
    textMuted: '#59636e',
    textOnEmphasis: '#ffffff',
    focusRing: '#0969da',
    overlay: 'rgba(31, 35, 40, 0.5)',
    tones: {
      neutral: tone('#59636e', '#eff2f5', '#d0d7de'),
      accent: tone('#0969da', '#ddf4ff', '#54aeff'),
      success: tone('#1a7f37', '#dafbe1', '#4ac26b'),
      danger: tone('#d1242f', '#ffebe9', '#ff8182'),
      warning: tone('#bc4c00', '#fff1e5', '#fb8f44'),
      attention: tone('#9a6700', '#fff8c5', '#d4a72c'),
    },
  },
};

const dark: Palette = {
  name: 'dark',
  scheme: 'dark',
  colors: {
    background: '#0d1117',
    surface: '#151b23',
    surfaceHover: '#212830',
    border: '#3d444d',
    text: '#f0f6fc',
    textMuted: '#9198a1',
    textOnEmphasis: '#ffffff',
    focusRing: '#1f6feb',
    overlay: 'rgba(1, 4, 9, 0.7)',
    tones: {
      neutral: tone('#9198a1', '#212830', '#3d444d'),
      accent: tone('#4493f8', '#121d2f', '#1f6feb'),
      success: tone('#3fb950', '#12261e', '#238636'),
      danger: tone('#f85149', '#25171c', '#da3633'),
      warning: tone('#db6d28', '#221a19', '#bd561d'),
      attention: tone('#d29922', '#272115', '#9e6a03'),
    },
  },
};

const dimmed: Palette = {
  name: 'dimmed',
  scheme: 'dark',
  colors: {
    background: '#212830',
    surface: '#262c36',
    surfaceHover: '#2f3742',
    border: '#3d444d',
    text: '#d1d7e0',
    textMuted: '#9198a1',
    textOnEmphasis: '#ffffff',
    focusRing: '#316dca',
    overlay: 'rgba(21, 27, 35, 0.7)',
    tones: {
      neutral: tone('#9198a1', '#2f3742', '#3d444d'),
      accent: tone('#478be6', '#1f2c3d', '#316dca'),
      success: tone('#57ab5a', '#1f2c26', '#347d39'),
      danger: tone('#e5534b', '#2d2226', '#c93c37'),
      warning: tone('#cc6b2c', '#2c2525', '#ae5622'),
      attention: tone('#c69026', '#2e2a1f', '#966600'),
    },
  },
};

const highContrastDark: Palette = {
  name: 'high-contrast-dark',
  scheme: 'dark',
  colors: {
    background: '#010409',
    surface: '#0a0c10',
    surfaceHover: '#272b33',
    border: '#9ea7b3',
    text: '#ffffff',
    textMuted: '#d9dee3',
    textOnEmphasis: '#0a0c10',
    focusRing: '#71b7ff',
    overlay: 'rgba(0, 0, 0, 0.8)',
    tones: {
      neutral: tone('#d9dee3', '#272b33', '#9ea7b3'),
      accent: tone('#71b7ff', '#0a1a2e', '#409eff'),
      success: tone('#26cd4d', '#081c10', '#09b43a'),
      danger: tone('#ff9492', '#2a0d0f', '#ff6a69'),
      warning: tone('#ffb757', '#261708', '#fe9a2d'),
      attention: tone('#f0b72f', '#231c07', '#e09b13'),
    },
  },
};

export const THEMES: Record<ThemeName, AppTheme> = {
  light: { ...base, ...light },
  dark: { ...base, ...dark },
  dimmed: { ...base, ...dimmed },
  'high-contrast-dark': { ...base, ...highContrastDark },
};

export const THEME_LABELS: Record<ThemeName | 'system', string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  dimmed: 'Dark dimmed',
  'high-contrast-dark': 'High contrast dark',
};
